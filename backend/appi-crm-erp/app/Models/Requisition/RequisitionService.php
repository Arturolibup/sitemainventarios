<?php

namespace App\Models\Requisition;

use Carbon\Carbon;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use App\Models\Requisition\Requisition;
use App\Models\Requisition\RequisitionCall;
use App\Models\Requisition\RequisitionItem;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Validation\ValidationException;
use App\Models\Requisition\RequisitionCallProduct;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Http\Controllers\Product\ProductExitController;

class RequisitionService
{

    use HasFactory, SoftDeletes;
    /**
     * Crea borrador de requisición para el usuario autenticado.
     * Solo permitido si existe convocatoria activa (por call_id) o por (year, month).
     */
    public function createDraft(array $data): Requisition
    {
        // data: requisition_call_id, area_id, subarea_id
        $call = RequisitionCall::findOrFail($data['requisition_call_id']);

        // Validar ventana de captura para solicitante (Área/Subárea)
        $now = Carbon::now();
        if ($now->lt(Carbon::parse($call->open_at)) || $now->gt(Carbon::parse($call->close_at))) {
            throw ValidationException::withMessages([
                'requisition_call_id' => 'Fuera de la ventana de captura para esta convocatoria.',
            ]);
        }

        return DB::transaction(function () use ($data) {
            /** @var Requisition $req */
            $req = Requisition::create([
                'requisition_call_id' => $data['requisition_call_id'],
                'area_id'             => $data['area_id'],
                'subarea_id'          => $data['subarea_id'],
                'requested_by'        => Auth::id(),
                'status'              => 'draft',
                'created_by'          => Auth::id(),
                'updated_by'          => Auth::id(),
            ]);

            // Opcional: precargar items con requested_qty = 0 según productos de la convocatoria
            $rcps = RequisitionCallProduct::where('requisition_call_id', $data['requisition_call_id'])
                ->where('is_enabled', true)
                ->get();

            foreach ($rcps as $i => $rcp) {
                RequisitionItem::create([
                    'requisition_id'             => $req->id,
                    'requisition_call_product_id'=> $rcp->id,
                    'product_id'                 => $rcp->product_id,
                    'unit_id'                    => $rcp->default_unit_id, // el solicitante podrá cambiar
                    'requested_qty'              => 0,
                ]);
            }

            return $req;
        });
    }

    /**
     * Guarda borrador (solo solicitante). No cambia status.
     * items: [{item_id, requested_qty, unit_id}, ...]
     */
    public function saveDraft(int $requisitionId, array $items): Requisition
    {
        $req = Requisition::findOrFail($requisitionId);

        // Policy/Ownership: debe ser suya y estar en 'draft'
        if ($req->requested_by !== Auth::id() || $req->status !== 'draft') {
            throw ValidationException::withMessages([
                'requisition' => 'No autorizado para modificar este borrador.',
            ]);
        }

        DB::transaction(function () use ($items) {
            foreach ($items as $row) {
                $item = RequisitionItem::findOrFail($row['item_id']);
                $rq   = max(0, (int)($row['requested_qty'] ?? 0)); // enteros >= 0
                $unit = $row['unit_id'] ?? null;

                $item->update([
                    'requested_qty' => $rq,
                    'unit_id'       => $unit,
                    'notes'         => $row['notes'] ?? $item->notes,
                ]);
            }
        });

        $req->updated_by = Auth::id();
        $req->save();

        return $req->refresh();
    }

    /**
     * Envía la requisición el area (genera PDF y notifica).
     */
    public function send(int $requisitionId): Requisition
    {
        $req = Requisition::findOrFail($requisitionId);

        if ($req->requested_by !== Auth::id() || !in_array($req->status, ['draft','sent'])) {
            throw ValidationException::withMessages([
                'requisition' => 'No autorizado o estatus no válido para enviar.',
            ]);
        }

        // Validar ventana de captura aún vigente
        $call = RequisitionCall::findOrFail($req->requisition_call_id);
        $now  = Carbon::now();

        $openAt = Carbon::parse($call->open_at);
        $closeAt = Carbon::parse($call->close_at);

        // 👉 NUEVO: incluye is_active en la validación
        if (!$call->is_active) {
            throw ValidationException::withMessages([
                'requisition' => 'La convocatoria fue desactivada por el administrador.',
            ]);
        }

        // 👉 Ajusta comparación de fechas para evitar falsos negativos
        if ($now->lt($openAt->startOfDay()) || $now->gt($closeAt->endOfDay())) {
            throw ValidationException::withMessages([
                'requisition' => 'La convocatoria ya no está abierta para enviar.',
            ]);
        }

        return DB::transaction(function () use ($req) {
            // TODO: Generar PDF (DomPDF) y asignar ruta a $req->pdf_path
            $req->status       = 'sent';
            $req->requested_at = Carbon::now();
            $req->updated_by   = Auth::id();
            $req->save();

            // TODO: Notificar a Almacén (notifications con type='requisition' y requisition_id)
            return $req->refresh();
        });
    }

    public function listMine(array $filters)
    {
        $q = Requisition::query()
            ->where('requested_by', Auth::id());

        if (!empty($filters['year']))  $q->whereHas('call', fn($c) => $c->where('year', (int)$filters['year']));
        if (!empty($filters['month'])) $q->whereHas('call', fn($c) => $c->where('month', (int)$filters['month']));
        if (!empty($filters['status']))$q->where('status', $filters['status']);

        return $q->latest()->paginate($filters['per_page'] ?? 15);
    }

    /**
     * Lista general (Área 3).
     */
    public function listAll(array $filters)
    {
        $q = Requisition::query();

        if (!empty($filters['year']))     $q->whereHas('call', fn($c) => $c->where('year', (int)$filters['year']));
        if (!empty($filters['month']))    $q->whereHas('call', fn($c) => $c->where('month', (int)$filters['month']));
        if (!empty($filters['area_id']))  $q->where('area_id', (int)$filters['area_id']);
        if (!empty($filters['subarea_id'])) $q->where('subarea_id', (int)$filters['subarea_id']);
        if (!empty($filters['status']))   $q->where('status', $filters['status']);
        if (!empty($filters['user_id']))  $q->where('requested_by', (int)$filters['user_id']);

        return $q->latest()->paginate($filters['per_page'] ?? 15);
    }


    /**
 * Aprobación (solo Almacén): llena approved_qty en todos los items (>=0),
 * cambia status a 'approved'.
 */
public function approve(int $requisitionId, array $approval): Requisition
{
    $req = Requisition::with(['items.product', 'area', 'subarea', 'call'])->findOrFail($requisitionId);

    // 🔒 Validar estado actual
    if ($req->status !== 'sent') {
        throw ValidationException::withMessages([
            'requisition' => 'Solo se pueden aprobar requisiciones en estatus "sent".',
        ]);
    }

    // 🔍 Validar cantidades
    foreach ($approval['items'] as $row) {
        if (!isset($row['approved_qty']) || $row['approved_qty'] < 0) {
            throw ValidationException::withMessages([
                'approved_qty' => 'Todos los productos deben tener cantidad aprobada (0 o más).',
            ]);
        }
    }

    return DB::transaction(function () use ($req, $approval) {
        // 1️⃣ Actualizar items aprobados
        foreach ($approval['items'] as $row) {
            /** @var RequisitionItem $item */
            $item = RequisitionItem::findOrFail($row['item_id']);
            $item->update([
                'approved_qty' => (int) $row['approved_qty'],
                'unit_id' => $row['unit_id'] ?? $item->unit_id,
            ]);
        }

        // 2️⃣ Actualizar requisición (estatus, observaciones, auditoría)
        $req->status = 'approved';
        $req->approved_by = Auth::id();
        $req->approved_at = now();
        $req->observations = $approval['observations'] ?? $req->observations;
        $req->updated_by = Auth::id();
        $req->save();

        // 3️⃣ Retornar requisición
        $req->refresh();
        return $req;
    });
}


/**
 * Crea la requisición base general (solo administradores)
 * Ignora validaciones de fecha y estado activo
 */
public function createGeneralBase(int $callId, ?int $areaId = null, ?int $subareaId = null): Requisition
{
    $call = RequisitionCall::findOrFail($callId);

    // 🔹 Solo admins pueden crear base general
    $user = Auth::user();
    if (!$user->hasRole(['admin', 'Almacen']) && !$user->can('manage requisition calls')) {
        throw ValidationException::withMessages([
            'requisition_call_id' => 'No tienes permisos para crear la requisición base.',
        ]);
    }

    // 🔹 Evitar duplicados
    if ($call->general_requisition_id) {
        throw ValidationException::withMessages([
            'requisition_call_id' => 'Ya existe una requisición base para esta convocatoria.',
        ]);
    }

    return DB::transaction(function () use ($call, $areaId, $subareaId) {
        $req = Requisition::create([
            'requisition_call_id' => $call->id,
            'area_id'             => $areaId,
            'subarea_id'          => $subareaId,
            'requested_by'        => Auth::id(),
            'status'              => 'draft',
            'title'               => "BASE - {$call->title}",
            'type'                => 'general',
            'created_by'          => Auth::id(),
            'updated_by'          => Auth::id(),
        ]);

        // Copiar todos los productos habilitados
        $products = RequisitionCallProduct::where('requisition_call_id', $call->id)
            ->where('is_enabled', true)
            ->get();

        foreach ($products as $rcp) {
            RequisitionItem::create([
                'requisition_id'             => $req->id,
                'requisition_call_product_id'=> $rcp->id,
                'product_id'                 => $rcp->product_id,
                'unit_id'                    => $rcp->default_unit_id,
                'requested_qty'              => 0,
                'approved_qty'               => 0,
            ]);
        }

        // Relacionar como base
        $call->general_requisition_id = $req->id;
        $call->save();

        return $req->load('items.product');
    });
}

}


        /*
     * Aprobación (solo Almacén): llena approved_qty en todos los items (>=0),
     * genera Salidas (product_exits + exit_products) y cambia status a 'approved'.
     
    public function approve(int $requisitionId, array $approval): Requisition
    {
        $req = Requisition::with(['items.product', 'area', 'subarea', 'call'])->findOrFail($requisitionId);

        // 🔒 Validar estado actual
        if ($req->status !== 'sent') {
            throw ValidationException::withMessages([
                'requisition' => 'Solo se pueden aprobar requisiciones en estatus "sent".',
            ]);
        }

        // 🔍 Validar cantidades
        foreach ($approval['items'] as $row) {
            if (!isset($row['approved_qty']) || $row['approved_qty'] < 0) {
                throw ValidationException::withMessages([
                    'approved_qty' => 'Todos los productos deben tener cantidad aprobada (0 o más).',
                ]);
            }
        }

        return DB::transaction(function () use ($req, $approval) {
            // 1️⃣ Actualizar items aprobados
            foreach ($approval['items'] as $row) {
                
                $item = RequisitionItem::findOrFail($row['item_id']);
                $item->update([
                    'approved_qty' => (int) $row['approved_qty'],
                    'unit_id'      => $row['unit_id'] ?? $item->unit_id,
                ]);
            }

            // 2️⃣ Crear salida (ProductExit + ExitProducts)
            $exit = ProductExit::create([
                'area_id'             => $req->area_id,
                'subarea_id'          => $req->subarea_id,
                'requisition_id'      => $req->id,
                'requisition_call_id' => $req->requisition_call_id,
                'reference'           => 'REQ-' . str_pad($req->id, 5, '0', STR_PAD_LEFT),
                'folio'               => null,
                'exit_date'           => now(),
                'received_by'         => $req->requested_by ?? '---',
                'authorized_by'       => Auth::user()->name ?? 'Área 3',
                'exit_status'         => 'completed',
                'invoice_mode'        => 'multiple_invoices',
                'created_by'          => Auth::id(),
            ]);

            foreach ($req->items as $item) {
                if ($item->approved_qty > 0) {
                    $exitProduct = ExitProduct::create([
                        'product_exit_id' => $exit->id,
                        'product_id'      => $item->product_id,
                        'quantity'        => $item->approved_qty,
                        'warehouse'       => 'principal',
                        'invoice_number'  => 'REQ-' . $req->id,
                    ]);

                    // Guardar relación directa en item para trazabilidad
                    $item->update(['exit_id' => $exitProduct->product_exit_id]);
                }
            }

            // 3️⃣ Actualizar requisición (estatus, observaciones, auditoría)
            $req->status       = 'approved';
            $req->approved_by  = Auth::id();
            $req->approved_at  = now();
            $req->observations = $approval['observations'] ?? $req->observations;
            $req->updated_by   = Auth::id();
            $req->save();

            // 4️⃣ Generar PDF del vale
            try {
                app(ProductExitController::class)->generateExitPdf($exit->id);
            } catch (Throwable $th) {
                Log::error('❌ Error generando PDF para requisición ' . $req->id . ': ' . $th->getMessage());
            }

            // 5️⃣ Notificar a solicitante (pendiente)
            // TODO: Integrar sistema de notificaciones interno
            // Ejemplo: Notification::create([
            //     'type' => 'requisition',
            //     'title' => 'Requisición aprobada',
            //     'message' => "Tu requisición #{$req->id} ha sido aprobada y se generó el vale #{$exit->id}.",
            //     'user_id' => $req->created_by,
            //     'requisition_id' => $req->id,
            // ]);

            // 6️⃣ Retornar requisición con relación a la salida generada
            $req->refresh();
            $req->exit_generated_id = $exit->id; // Campo virtual para frontend
            return $req;
        });
    }
        */
    /**
     * Lista “Mis Requisiciones” (solicitante).
     */