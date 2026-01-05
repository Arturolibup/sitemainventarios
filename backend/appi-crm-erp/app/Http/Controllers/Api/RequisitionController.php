<?php

namespace App\Http\Controllers\Api;

use app;
use App\Models\User;
use Illuminate\Http\Request;
use Barryvdh\DomPDF\Facade\Pdf;
use App\Models\Configuration\Unit;
use Illuminate\Support\Facades\DB;
use App\Models\Product\ExitProduct;
use App\Models\Product\ProductExit;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\Controller;
use App\Models\Product\EntryProduct;
use App\Models\Requisition\Requisition;
use Illuminate\Support\Facades\Storage;
use Exception;



use App\Models\Product\ProductWarehouse;
use App\Models\Requisition\RequisitionCall;
use App\Models\Requisition\RequisitionService;
use App\Http\Controllers\Product\ProductExitController;


class RequisitionController extends Controller
{
    protected RequisitionService $service;

    public function __construct(RequisitionService $service)
    {
        $this->service = $service;
    }

    /*
     * Listado de mis requisiciones (solicitante)*/


    public function myRequisitions(Request $request)
    {
        $user = auth()->user();

        $q = Requisition::query()
            ->with([
                'call:id,title,month,year,open_at,close_at',
                'area:id,name',
                'subarea:id,name',
            ]) ->select([
            'requisitions.*',
            'exit_folio',
            'exit_status',
            'exit_pdf_path',
            'exit_generated',
            //DB::raw('CONCAT("' . url('storage') . '/", exit_pdf_path) as exit_pdf_url')
            ])
            ->orderByDesc('id');

        // 🔹 Antes solo por usuario
        // ->where('requested_by', $user->id)

        // 🔹 Nuevo: mostrar todas las requisiciones de su área/subárea
        if ($user->subarea_id) {
            $q->where('subarea_id', $user->subarea_id);
        } elseif ($user->area_id) {
            $q->where('area_id', $user->area_id);
        } else {
            $q->where('requested_by', $user->id);
        }

        $perPage = $request->integer('per_page', 15);
        $data = $q->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $data
        ]);
    }

    public function index(Request $request)
{
    $filters = $request->only(['year', 'month', 'area_id', 'subarea_id', 'status', 'user_id', 'per_page']);

    $q = Requisition::query()
        ->with(['area:id,name', 'subarea:id,name', 'call:id,title,month,year'])
        ->select(['requisitions.*', 'exit_folio', 'exit_status', 'exit_pdf_path', 'exit_generated',
                    //DB::raw('CONCAT("' . url('storage') . '/", exit_pdf_path) as exit_pdf_url')
                ])
                ->whereIn('status', ['sent', 'approved']) // ← SOLO ESTOS
        ->orderByDesc('id');

    if (!empty($filters['year'])) {
        $q->whereHas('call', fn($c) => $c->where('year', (int)$filters['year']));
    }
    if (!empty($filters['month'])) {
        $q->whereHas('call', fn($c) => $c->where('month', (int)$filters['month']));
    }
    if (!empty($filters['area_id'])) $q->where('area_id', $filters['area_id']);
    if (!empty($filters['subarea_id'])) $q->where('subarea_id', $filters['subarea_id']);
    if (!empty($filters['status'])) $q->where('status', $filters['status']);
    if (!empty($filters['user_id'])) $q->where('requested_by', $filters['user_id']);

    // PAGINACIÓN
    $perPage = $filters['per_page'] ?? 15;
    $data = $q->paginate($perPage);

    return response()->json([
        'success' => true,
        'data' => $data
    ]);
}


    /**
     * Crear borrador de requisición (Área/Subárea)
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'requisition_call_id' => 'required|integer|exists:requisition_calls,id',
            'area_id' => 'required|integer|exists:areas,id',
            'subarea_id' => 'required|integer|exists:subareas,id',
        ]);

        $req = $this->service->createDraft($data);

        return response()->json([
            'message' => 'Borrador de requisición creado correctamente.',
            'data' => $req,
        ], 201);
    }

    public function send($id)
    {
        try {
            // 🔹 Llamar al servicio correcto (que valida fechas y estado)
            $req = $this->service->send($id);

            return response()->json([
                'success' => true,
                'message' => 'Requisición enviada correctamente.',
                'data'    => $req
            ]);
        } catch (ValidationException $e) {
            // ⚠️ Errores de validación controlados (por fechas, permisos, etc.)
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
                'errors'  => $e->errors(),
            ], 422);
        } catch (Throwable $th) {
            // ⚠️ Errores inesperados
            Log::error("Error enviando requisición ID $id: " . $th->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error interno al enviar la requisición.',
            ], 500);
        }
    }

   /**
     * Aprobar requisición (Área 3)
     */
    public function approve(Request $request, int $id)
    {
        try {
            $validated = $request->validate([
                'observations' => 'nullable|string|max:500',
                'items' => 'required|array|min:1',
                'items.*.item_id' => 'required|integer|exists:requisition_items,id',
                'items.*.approved_qty' => 'required|integer|min:0',
                'items.*.unit_id' => 'nullable|integer|exists:units,id',
            ]);

            return DB::transaction(function () use ($request, $id, $validated) {
                $req = Requisition::with(['items.product', 'area', 'subarea', 'call'])
                    ->findOrFail($id);

                if ($req->status !== 'sent') {
                    return response()->json([
                        'success' => false,
                        'message' => 'La requisición ya ha sido procesada o no está en estado enviado.'
                    ], 400);
                }

                // Actualizar requisición
                $req->update([
                    'status' => 'approved',
                    'approved_at' => now(),
                    'approved_by' => auth()->id(),
                    'observations' => $validated['observations'] ?? null,
                ]);

                // Actualizar items cantidades aprobadas
                foreach ($validated['items'] as $item) {
                    $reqItem = $req->items->firstWhere('id', $item['item_id']);
                    if ($reqItem) {
                        $reqItem->update([
                            'approved_qty' => $item['approved_qty'],
                            'unit_id' => $item['unit_id'] ?? $reqItem->unit_id,
                        ]);
                    }
                }

                // Generar salida
                $exitResponse = $this->fromRequisition($request, $id);
                $exitData = json_decode($exitResponse->getContent(), true)['data'] ?? 
                json_decode($exitResponse->getContent(), true);

                if ($exitResponse->getStatusCode() !== 201) {
                    throw new \Exception($exitData['message'] ?? 'Error al generar salida');
                }

               
                // No quiere la nueva que Actualizemos aqui la requisición con salida
                $req->update([
                    'status'=> 'approved'
                ]);
                

                return response()->json([
                    'success' => true,
                    'message' => 'Requisición aprobada y vale de salida generado correctamente.',
                    'data' => $req->load(['items.product', 'items.unit', 'call', 'area', 'subarea']),
                    'exit_id' => $exitData['exit_id'],
                    'exit_folio' => $exitData['folio'],
                    'draft_url' => $exitData['draft_url']  // ← ABRIR AUTOMÁTICO
                ], 200);
            });
        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Errores de validación',
                'errors' => $e->errors(),
            ], 422);
        } catch (Exception $e) {
            DB::rollBack();
            Log::error("Error al aprobar requisición ID {$id}: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    // Mostrar una requisición para edición y vista detallada de created/requisitions/detail
    public function show($id)
    {
        try {
            // Log del ID recibido
            Log::debug('ID de requisición recibido: ' . $id);

            // Ejecutar la consulta
            // ✅ Cargar requisición con TODAS sus relaciones necesarias
        $req = Requisition::with([
            'items.product',   // Productos de cada item
            'items.unit',      // Unidad de medida
            'call',            // Convocatoria asociada
            'area',            // Área solicitante
            'subarea',         // Subárea solicitante
            'requestedBy',     // Usuario que la creó
            'approvedBy'       // Usuario que la aprobó (si aplica)
        ])->find($id);

            Log::info('REQUISICIÓN CARGADA CON ITEMS:', [
            'id' => $req?->id,
            'items_count' => $req?->items->count() ?? 0
        ]);

            // Log del resultado de la consulta
            Log::debug('Resultado de la consulta: ', ['req' => $req]);

            if (!$req) {
                Log::warning('No se encontró requisición para ID: ' . $id);
                return response()->json([
                    'success' => false,
                    'message' => 'No se encontró la requisición solicitada.'
                ], 404);
            }
            Log::debug('Modelo de requisición cargado:', ['class' => get_class($req)]);
            return response()->json([
                'success' => true,
                'data' => $req
            ]);
        } catch (Exception $e) {
            Log::error('Error cargando requisición: ' . $e->getMessage(), ['id' => $id]);
            return response()->json([
                'success' => false,
                'message' => 'Error cargando requisición: ' . $e->getMessage()
            ], 500);
        }
    }


    //crear requisición desde convocatoria y 
    public function generateFromCall(Request $request)
{
    $validated = $request->validate([
        'requisition_call_id' => 'required|exists:requisition_calls,id',
        'area_id'             => 'nullable|integer|exists:areas,id',
        'subarea_id'          => 'nullable|integer|exists:subareas,id',
    ]);

    $call = RequisitionCall::with('products.product.unit')
        ->findOrFail($validated['requisition_call_id']);

    $user = auth()->user();
    // DETERMINAR TIPO
    $isAdmin = $user->hasRole(['Super-Admin', 'Almacen']);
    $type = $isAdmin ? 'general' : 'normal';
    $title = $isAdmin ? 'BASE - ' . $call->title : 'REQUISICIÓN - ' . $call->title;

    $now = now();
    if (!$call->is_active || $call->open_at->greaterThan($now) || $call->close_at->lessThan($now)) {
        return response()->json([
            'success' => false,
            'message' => 'La convocatoria no está activa.'
        ], 400);
    }
    

    $areaId = $validated['area_id'] ?? $user->area_id;
    $subareaId = $validated['subarea_id'] ?? $user->subarea_id;

    if (!$areaId) {
        return response()->json([
            'success' => false,
            'message' => 'No se pudo determinar el área.'
        ], 400);
    }

    // ✅ EVITAR DUPLICADO CON type='general'
    $exists = Requisition::where('requisition_call_id', $call->id)
        //->where('area_id', $areaId)
        ->where('type', $type)
        ->whereNull('deleted_at')
        ->exists();

    if ($exists) {
        $message = $type === 'general' ? 'Ya existe la requisición base.' : 'Ya existe la requisición.';
        return response()->json([
            'success' => false,
            'message' => $message,
        ], 400);
    }

    Log::info('GENERATE FROM CALL', [
    'user_id' => $user->id,
    'roles' => $user->getRoleNames(),
    'isAdmin' => $isAdmin,
    'type' => $type
    ]);

    Log::info('BASE CREATED', ['type' => $type, 'call_id' => $call->id]);

    DB::beginTransaction();
    try {
        $requisition = Requisition::create([
            'requisition_call_id' => $call->id,
            'area_id'             => $areaId,
            'subarea_id'          => $subareaId,
            'title'               => $title,
            'status'              => 'draft',
            'type'                => $type,
            'requested_by'        => $user->id,
            'created_by'          => $user->id,
        ]);

        foreach ($call->products as $p) {
            $unitId = $p->default_unit_id ?? $p->product->unit_id;
            $requisition->items()->create([
                'requisition_call_product_id' => $p->id,
                'product_id'                 => $p->product_id,
                'unit_id'                    => $unitId,
                'requested_qty'              => 0,
                'approved_qty'               => 0,
                'price'                      => $p->product->price_general ?? 0,
            ]);
        }

        DB::commit();

        return response()->json([
            'success' => true,
            'message' => 'Requisición creada correctamente.',
            'data'    => $requisition->load([
                'items.product',
                 'items.unit', 
                 'call', 
                 'area', 
                 'subarea'])
        ], 201);

    } catch (Exception $e) {
        DB::rollBack();
        Log::error('Error: ' . $e->getMessage());
        return response()->json([
            'success' => false,
            'message' => $e->getMessage()
        ], 500);
    }
}

// NUEVA FUNCIÓN: Crear requisición COPIANDO de la BASE GENERAL desde area/subarea del usuario y evitar duplicados
public function generateFromBase(Request $request)
{
    $validated = $request->validate([
        'requisition_call_id' => 'required|exists:requisition_calls,id',
        'area_id'             => 'nullable|integer|exists:areas,id',
        'subarea_id'          => 'nullable|integer|exists:subareas,id',
    ]);

    $call = RequisitionCall::findOrFail($validated['requisition_call_id']);
    $user = auth()->user();

    // ✅ SOLO ÁREAS (NO Almacén ni Super-Admin)
    if ($user->hasRole(['Super-Admin', 'Almacen'])) {
        return response()->json([
            'success' => false,
            'message' => 'No tienes permiso para crear requisiciones desde aquí.'
        ], 403);
    }

    $now = now();
    if (!$call->is_active || $call->open_at->greaterThan($now) || $call->close_at->lessThan($now)) {
        return response()->json([
            'success' => false,
            'message' => 'La convocatoria no está activa.'
        ], 400);
    }

    $areaId = $validated['area_id'] ?? $user->area_id;
    $subareaId = $validated['subarea_id'] ?? $user->subarea_id;

    if (!$areaId) {
        return response()->json([
            'success' => false,
            'message' => 'No se pudo determinar el área.'
        ], 400);
    }

    // ✅ EVITAR DUPLICADO: solo una por área
    $exists = Requisition::where('requisition_call_id', $call->id)
        ->where('area_id', $areaId)
        ->where('type', 'normal')
        ->whereNull('deleted_at')
        ->exists();

    if ($exists) {
        return response()->json([
            'success' => false,
            'message' => 'Ya tienes una requisición para esta convocatoria.'
        ], 400);
    }

    // ✅ BUSCAR BASE GENERAL
    $base = Requisition::where('requisition_call_id', $call->id)
        ->where('type', 'general')
        ->with(['items.product', 'items.unit'])
        ->first();

    if (!$base) {
        return response()->json([
            'success' => false,
            'message' => 'No existe la requisición base. Contacta a Almacén.'
        ], 400);
    }

    DB::beginTransaction();
    try {
        $requisition = Requisition::create([
            'requisition_call_id' => $call->id,
            'area_id'             => $areaId,
            'subarea_id'          => $subareaId,
            'title'               => 'REQUISICIÓN - ' . $call->title,
            'status'              => 'draft',
            'type'                => 'normal',
            'requested_by'        => $user->id,
            'created_by'          => $user->id,
        ]);

        $requisition = $requisition->fresh();
        // COPIAR PRODUCTOS DE LA BASE
        foreach ($base->items as $item) {
            $requisition->items()->create([
                'requisition_call_product_id' => $item->requisition_call_product_id,
                'product_id'                 => $item->product_id,
                'unit_id'                    => $item->unit_id,
                'requested_qty'              => 0,
                'approved_qty'               => 0,
                'price'                      => $item->price,
            ]);
        }

        DB::commit();

        // 🔹 LOG: VER QUÉ SE DEVUELVE
        Log::info('REQUISICIÓN CREADA DESDE BASE', [
            'requisition_id' => $requisition->id,
            'items_count' => $requisition->items()->count(),
            'items' => $requisition->items()->with(['product', 'unit'])->get()->toArray()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Requisición creada correctamente.',
            'data'    => $requisition->fresh()->load(['items.product', 'items.unit', 'call', 'area', 'subarea'])
        ], 201);

    } catch (Exception $e) {
        DB::rollBack();
        return response()->json([
            'success' => false,
            'message' => 'Error interno del servidor.'
        ], 500);
    }
}

    public function updateDraft(Request $request, $id)
    {
        try {
            Log::debug('Actualizando borrador para requisición ID:', ['id' => $id, 'payload' => $request->all()]);

            $requisition = Requisition::find($id);
            if (!$requisition) {
                Log::warning('No se encontró requisición para actualizar:', ['id' => $id]);
                return response()->json([
                    'success' => false,
                    'message' => 'No se encontró la requisición.'
                ], 404);
            }

            if ($requisition->status !== 'draft') {
                Log::warning('La requisición no está en estado borrador:', ['id' => $id, 'status' => $requisition->status]);
                return response()->json([
                    'success' => false,
                    'message' => 'Solo se pueden actualizar requisiciones en estado borrador.'
                ], 400);
            }

            $validated = $request->validate([
                'requisition_call_id' => 'required|exists:requisition_calls,id',
                'area_id' => 'required|exists:areas,id',
                'subarea_id' => 'required|exists:subareas,id',
                'items' => 'required|array',
                'items.*.product_id' => 'required|exists:products,id',
                'items.*.requested_qty' => 'required|integer|min:0',
                'items.*.notes' => 'nullable|string|max:255'
            ]);

            $requisition->update([
                'requisition_call_id' => $validated['requisition_call_id'],
                'area_id' => $validated['area_id'],
                'subarea_id' => $validated['subarea_id'],
                'updated_by' => auth()->id(),
            ]);

            foreach ($validated['items'] as $itemData) {
                $requisition->items()->updateOrCreate(
                    ['product_id' => $itemData['product_id']],
                    [
                        'requested_qty' => $itemData['requested_qty'],
                        'notes' => $itemData['notes'] ?? null,
                        'updated_at' => now()
                    ]
                );
            }

            Log::info('Borrador actualizado exitosamente:', ['id' => $requisition->id]);
            return response()->json([
                'success' => true,
                'data' => $requisition->load(['items.product', 'items.unit', 'call', 'area', 'subarea']),
                'message' => 'Borrador actualizado exitosamente.'
            ]);
        } catch (\Exception $e) {
            Log::error('Error actualizando borrador:', ['id' => $id, 'error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar el borrador: ' . $e->getMessage()
            ], 500);
        }
    }

    public function destroy($id)
    {
        $requisition = \App\Models\Requisition\Requisition::findOrFail($id);

        // NO PERMITIR BORRAR SI YA TIENE SALIDA
        if ($requisition->exit_generated) {
            return response()->json([
                'message' => 'No se puede eliminar: ya se generó una salida de almacén (Folio: ' . $requisition->exit_folio . ')'
            ], 403);
        }

        // Si está en borrador o enviada, permitir borrar
        if (in_array($requisition->status, ['draft', 'sent'])) {
            $requisition->delete();
            return response()->json(['message' => 'Requisición eliminada correctamente']);
        }

        return response()->json(['message' => 'Estado no permite eliminación'], 403);
    }


       /**
 * Aplica FIFO + Valida y descuenta stock en product_warehouses
 * Usa: product_warehouses.stock como stock real
 * FIFO: por product_entries.entry_date
 * Inserta en exit_products con factura y almacén
 */
protected function applyFifoAndValidateStock($exitId, $products)
{
    $exitProductsData = [];
    $warehouseName = 'Central Aguamilpa';

    foreach ($products as $item) {
        $productId = $item['product_id'];
        $quantityNeeded = $item['quantity'];

        // 1. OBTENER REGISTRO DE STOCK EN product_warehouses
        $warehouseStock = \App\Models\Product\ProductWarehouse::where('product_id', $productId)
            ->where('warehouse', $warehouseName)
            ->first();

        if (!$warehouseStock) {
            return ['error' => "Producto ID {$productId} no tiene registro en almacén {$warehouseName}"];
        }

        if ($warehouseStock->stock < $quantityNeeded) {
            return [
                'error' => "Stock insuficiente para producto ID {$productId}",
                'available' => $warehouseStock->stock,
                'needed' => $quantityNeeded
            ];
        }

        // 2. APLICAR FIFO: ordenar por product_entries.entry_date
        $entries = \App\Models\Product\EntryProduct::select('entry_product.*')
            ->join('product_entries', 'entry_product.entry_id', '=', 'product_entries.id')
            ->where('entry_product.product_id', $productId)
            ->whereNull('entry_product.deleted_at')
            ->whereNull('product_entries.deleted_at')
            ->whereNotNull('product_entries.entry_date')  // ← NUEVO
            ->orderBy('product_entries.entry_date', 'asc')
            ->get();

        $remaining = $quantityNeeded;

        foreach ($entries as $entry) {
            if ($remaining <= 0) break;

            // Calcular cuánto ya salió de esta entrada
            $alreadyExited = \App\Models\Product\ExitProduct::where('entry_id', $entry->id)->sum('quantity');
            $availableInEntry = $entry->quantity - $alreadyExited;

            if ($availableInEntry <= 0) continue;

            $take = min($availableInEntry, $remaining);

            $exitProductsData[] = [
                'product_exit_id' => $exitId,
                'entry_id' => $entry->id,
                'product_id' => $productId,
                'quantity' => $take,
                'warehouse' => $warehouseName,
                'invoice_number' => $entry->invoice_number ?? 'REQ-' . $exitId,
                'created_at' => now(),
                'updated_at' => now(),
            ];

            $remaining -= $take;
        }

        if ($remaining > 0) {
            return [
                'error' => "No hay entradas suficientes para producto ID {$productId}",
                'available_fifo' => $quantityNeeded - $remaining,
                'needed' => $quantityNeeded
            ];
        }

        // 3. DESCONTAR STOCK EN product_warehouses
        $warehouseStock->decrement('stock', $quantityNeeded);
        Log::info("Stock descontado: -{$quantityNeeded} para producto ID {$productId} en {$warehouseName}");
    }

    return $exitProductsData;
}


/*
    * Generar salida automáticamente desde una requisición aprobada
    */
    public function fromRequisition(Request $request, $requisition_id)
    {
        Log::info("Generando salida desde requisición ID: {$requisition_id}");

        try {
            return DB::transaction(function () use ($requisition_id) {
                $requisition = Requisition::with([
                    'area:id,name',
                    'subarea:id,name',
                    'items' => fn($q) => $q->where('approved_qty', '>', 0)
                                        ->with('product:id,title')
                ])->findOrFail($requisition_id);

                if ($requisition->items->isEmpty()) {
                    return response()->json(['message' => 'No hay productos con cantidad aprobada > 0'], 422);
                }

                if ($requisition->exit_generated ?? false) {
                    return response()->json(['message' => 'La salida ya fue generada'], 409);
                }

                $folio = 'REQ_EXIT_' . str_pad($requisition->id, 6, '0', STR_PAD_LEFT);
                // === 1. CREAR SALIDA REAL ===
                $exit = ProductExit::create([
                    'area_id' => $requisition->area_id,
                    'requisition_id' => $requisition_id,
                    'subarea_id' => $requisition->subarea_id,
                    'exit_date' => now()->format('Y-m-d'),
                    'exit_type' => 'requisition',
                    'exit_status' => 'completed',
                    'reference' => "Requisición #{$requisition->id}",  // ← AÑADIDO
                    'folio'=>$folio,
                    'received_by' => 'Por requisición',
                    'delivered_by' => auth()->user()->name,
                    'authorized_by' => 'Almacén',
                    'invoice_mode' => 'multiple_invoices',  // ← OBLIGATORIO
                    'created_by' => auth()->id(),
                ]);

                
                $exit->update(['folio' => $folio]);

                // === 2. APLICAR FIFO ===
                $productsForExit = $requisition->items->map(function ($item) {
                    return [
                        'product_id' => $item->product_id,
                        'quantity' => $item->approved_qty,
                    ];
                })->toArray();

                $exitProductsData = $this->applyFifoAndValidateStock($exit->id, $productsForExit);
                if (isset($exitProductsData['error'])) {
                    throw new \Exception($exitProductsData['error']);
                }

                DB::table('exit_products')->insert($exitProductsData);

                // === 3. GENERAR BORRADOR EXCLUSIVO ===
                $draftPath = $this->generateRequisitionExitDraft($requisition, $exit);

                // === 4. ACTUALIZAR REQUISICIÓN ===
                $requisition->update([
                    'status'=> 'approved',
                    'exit_generated' => true,
                    'exit_id' => $exit->id,
                    'exit_folio' => $folio,
                    //'draft_url' => Storage::url($draftPath),
                    'exit_draft_path' => $draftPath,  //quite el storage /storage/
                    'exit_status' => 'pending_pdf'
                ]);

                return response()->json([
                    'message' => 'Salida generada',
                    'exit_id' => $exit->id,
                    'folio' => $folio,
                    'draft_url' => Storage::url($draftPath)  // ← ABRIR EN ANGULAR
                ], 201);
            });
        } catch (\Exception $e) {
            Log::error("Error: " . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

// === GENERAR BORRADOR AL APROBAR ===
private function generateRequisitionExitDraft($requisition, $exit = null)
{
    if (!$exit) {
        $exit = ProductExit::with([
            'products' => fn($q) => $q->with(['product:id,title,unit_id', 'entry'])
        ])->find($requisition->exit_id);

        if (!$exit) {
            throw new \Exception("No se encontró la salida para la requisición #{$requisition->id}");
        }
    }

    $productList = $exit->products->map(function ($item) {
        return [
            'product_title' => $item->product->title,
            'unit' => $item->product->unit?->name ?? 'Unidad',
            'quantity' => $item->quantity,
            'invoice' => $item->invoice_number ?? 'N/A'
        ];
    })->toArray();

    $pdf = Pdf::loadView('pdf.requi_exit', [
        'exit' => $exit,
        'requisition' => $requisition,
        'productList' => $productList
    ]);

    $filename = "borrador_{$exit->folio}.pdf";
    $path = "requisition_exits/{$filename}";

    Storage::disk('public')->put($path, $pdf->output());

    // GUARDA CON /storage/
    $requisition->exit_draft_path = $path;  //le quite storage "/storage/{$path}"
    $requisition->save();

    return $path;
}


public function printRequisitionDraft($id)
{
    $requisition = Requisition::findOrFail($id);

    // Verifica que el borrador exista
    if (!$requisition->exit_draft_path) {
        abort(404, 'Borrador no generado');
    }

    // Ruta relativa guardada en BD
    $relativePath = $requisition->exit_draft_path;

    // Ruta real en disco a través del disk "public"
    $fullPath = Storage::disk('public')->path($relativePath);

    if (!file_exists($fullPath)) {
        abort(404, 'Archivo no encontrado: ' . $fullPath);
    }

    // Descargar con nombre legible
    $filename = "Borrador_Requisicion_{$requisition->id}.pdf";

    return response()->download($fullPath, $filename);
}

// === SUBIR VALE FIRMADO ===
public function uploadRequisitionExitPdf(Request $request, $id)
{
    $request->validate(['file' => 'required|mimes:pdf|max:10240']);

    $req = Requisition::findOrFail($id);

    if ($req->exit_status === 'completed') {
        return response()->json(['message' => 'Ya tiene vale firmado'], 400);
    }

    $file = $request->file('file');
    $filename = "{$req->exit_folio}.pdf";
    $path = $file->storeAs('requisition_exits', $filename, 'public');

    $req->update([
        'exit_pdf_path' => $path,
        'exit_status' => 'completed'
    ]);

    return response()->json([
        'message' => 'Vale firmado subido',
        'url' => $req->exit_pdf_url
    ]);
}

// === VER VALE ===
public function getRequisitionExitPdf($id)
{
    $req = Requisition::findOrFail($id);

    if (!$req->exit_pdf_path) {
        return response()->json(['message' => 'Sin vale'], 404);
    }
    return response()->json([
        'url' => $req->exit_pdf_url]);
}


public function getPrintDraftPdf($id)
{
    $requisition = Requisition::findOrFail($id);

    // SI NO TIENE exit_draft_path → GENERARLO AHORA
    if (!$requisition->exit_draft_path) {
        $exit = ProductExit::with(['products.product.unit'])->find($requisition->exit_id);
        if (!$exit) {
            return response()->json(['error' => 'No hay salida asociada'], 404);
        }

        $productList = $exit->products->map(fn($item) => [
            'product_title' => $item->product->title,
            'unit' => $item->product->unit?->name ?? 'Unidad',
            'quantity' => $item->quantity,
            'invoice' => $item->invoice_number ?? 'N/A'
        ])->toArray();

        $pdf = Pdf::loadView('pdf.requi_exit', compact('exit', 'requisition', 'productList'));
        $filename = "borrador_{$exit->folio}.pdf";

        $path = "requisition_exits/{$filename}";
        Storage::disk('public')->put($path, $pdf->output());

        $requisition->exit_draft_path = $path;  //asi estaba "/storage/{$path}";
        $requisition->save();
    }

    $relativePath = $requisition->exit_draft_path;
    $fullPath     = Storage::disk('public')->path($relativePath);

    
    if (!file_exists($fullPath)) {
        return response()->json(['error' => 'PDF no encontrado en el servidor'], 404);
    }

    $pdfContent = file_get_contents($fullPath);
    $base64 = base64_encode($pdfContent);

    return response()->json([
        'success' => true,
        'pdf' => $base64,
        'filename' => "Borrador_Requisicion_{$id}.pdf"
    ]);
}


/**
 * 🔹 Actualiza un borrador existente (desde Angular)
 * Ruta: PUT /api/requisitions/{id}/save-draft
 */
public function saveDraft(Request $request, $id)
{
    Log::info("📝 [saveDraft] Actualizando borrador de requisición ID: {$id}");

    try {
        $requisition = Requisition::with('items')->findOrFail($id);

        if ($requisition->status !== 'draft') {
            return response()->json([
                'success' => false,
                'message' => 'Solo se pueden actualizar requisiciones en estado borrador.'
            ], 400);
        }

        // ✅ Validar estructura básica del payload
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.item_id' => 'required|integer|exists:requisition_items,id',
            'items.*.requested_qty' => 'required|integer|min:0',
            'items.*.unit_id' => 'nullable|integer|exists:units,id',
            'items.*.notes' => 'nullable|string|max:255',
        ]);

        DB::beginTransaction();

        // 🔹 Actualizar cada item
        foreach ($validated['items'] as $itemData) {
            $item = $requisition->items->firstWhere('id', $itemData['item_id']);
            if ($item) {
                $item->update([
                    'requested_qty' => $itemData['requested_qty'],
                    'unit_id'       => $itemData['unit_id'] ?? $item->unit_id,
                    'notes'         => $itemData['notes'] ?? null,
                    'updated_at'    => now(),
                ]);
            } else {
                Log::warning("Item no encontrado en requisición ID {$id}", $itemData);
            }
        }

        // 🔹 Registrar quién lo modificó
        $requisition->update([
            'updated_by' => auth()->id(),
        ]);

        DB::commit();

        Log::info("✅ [saveDraft] Borrador actualizado correctamente", [
            'id' => $requisition->id,
            'items_count' => $requisition->items()->count(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Borrador guardado correctamente.',
            'data'    => $requisition->fresh()->load([
                'items.product',
                'items.unit',
                'call',
                'area',
                'subarea'
            ]),
        ], 200);

    } catch (ValidationException $e) {
        Log::warning('⚠️ Error de validación en saveDraft', $e->errors());
        return response()->json([
            'success' => false,
            'message' => 'Datos inválidos.',
            'errors'  => $e->errors()
        ], 422);
    } catch (Exception $e) {
        DB::rollBack();
        Log::error("❌ Error guardando borrador: {$e->getMessage()}", ['trace' => $e->getTraceAsString()]);
        return response()->json([
            'success' => false,
            'message' => 'Error al guardar borrador: ' . $e->getMessage(),
        ], 500);
    }
}




}

/*
public function saveDraft(Request $request, $id)
{
    $requisition = Requisition::findOrFail($id);

    if ($requisition->status !== 'draft') {
        return response()->json([
            'success' => false,
            'message' => 'Solo se pueden editar requisiciones en borrador.'
        ], 400);
    }

    $validated = $request->validate([
        'items' => 'required|array|min:1',
        'items.*.item_id' => 'required|integer|exists:requisition_items,id',
        'items.*.requested_qty' => 'required|integer|min:0',
        'items.*.unit_id' => 'nullable|integer|exists:units,id',
        'items.*.notes' => 'nullable|string|max:255',
    ]);

    DB::transaction(function () use ($requisition, $validated) {
        foreach ($validated['items'] as $itemData) {
            $item = $requisition->items()->findOrFail($itemData['item_id']);
            $item->update([
                'requested_qty' => $itemData['requested_qty'],
                'unit_id' => $itemData['unit_id'] ?? $item->unit_id,
                'notes' => $itemData['notes'] ?? $item->notes,
            ]);
        }
    });

    return response()->json([
        'success' => true,
        'message' => 'Borrador actualizado correctamente.',
        'data' => $requisition->load(['items.product', 'items.unit', 'call', 'area', 'subarea'])
    ]);
}





     * Guardar borrador (actualizar cantidades solicitadas)
     //llamando al servicio RequisitionService.php para actualizar el borrador
    public function saveDraft(Request $request, int $id)
    {
        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.item_id' => 'required|integer|exists:requisition_items,id',
            'items.*.requested_qty' => 'required|integer|min:0',
            'items.*.unit_id' => 'nullable|integer|exists:units,id',
            'items.*.notes' => 'nullable|string|max:255',
        ]);

        $req = $this->service->saveDraft($id, $validated['items']);  
        //llamando al servicio RequisitionService.php para actualizar el borrador 

        return response()->json([
            'message' => 'Requisición actualizada correctamente.',
            'data' => $req,
        ]);
    }
    */

    