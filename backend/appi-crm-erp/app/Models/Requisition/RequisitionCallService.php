<?php

namespace App\Models\Requisition;

use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use App\Models\Requisition\RequisitionCall;
use App\Models\Requisition\RequisitionCallProduct;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Validation\ValidationException;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class RequisitionCallService
{

    use HasFactory, SoftDeletes;
    /**
     * Crea una convocatoria (RequisitionCall) validando fechas.
     */
    public function createCall(array $data): RequisitionCall
    {
        // Validaciones de negocio
        $openAt  = Carbon::parse($data['open_at']);
        $closeAt = Carbon::parse($data['close_at']);

        if ($closeAt->lt($openAt)) {
            throw ValidationException::withMessages([
                'close_at' => 'La fecha de cierre no puede ser menor que la de apertura.',
            ]);
        }
        if ($closeAt->gt($openAt->copy()->addDays(10))) {
            throw ValidationException::withMessages([
                'close_at' => 'La ventana de captura no puede superar los 10 días.',
            ]);
        }

        return DB::transaction(function () use ($data) {
            /** @var RequisitionCall $call */
            $call = RequisitionCall::create([
                'year'       => (int) $data['year'],
                'month'      => (int) $data['month'],
                'title'      => $data['title'],
                'open_at'    => $data['open_at'],
                'close_at'   => $data['close_at'],
                'is_active'  => $data['is_active'] ?? true,
                'notes'      => $data['notes'] ?? null,
                'created_by' => Auth::id(),
            ]);

            // Si viene arreglo de productos, los inserta
            if (!empty($data['products']) && is_array($data['products'])) {
                // products: [{product_id, default_unit_id?, sort_order?}, ...]
                foreach ($data['products'] as $i => $p) {
                    RequisitionCallProduct::create([
                        'requisition_call_id' => $call->id,
                        'product_id'          => $p['product_id'],
                        'default_unit_id'     => $p['default_unit_id'] ?? null,
                        'is_enabled'          => true,
                        'sort_order'          => $p['sort_order'] ?? $i,
                    ]);
                }
            }

            return $call;
        });
    }

    /**
     * Actualiza metadatos de la convocatoria (título, fechas, activo, notas).
     */
    public function updateCall(int $id, array $data): RequisitionCall
    {
        $call = RequisitionCall::findOrFail($id);

        if (isset($data['open_at']) && isset($data['close_at'])) {
            $openAt  = Carbon::parse($data['open_at']);
            $closeAt = Carbon::parse($data['close_at']);

            if ($closeAt->lt($openAt)) {
                throw ValidationException::withMessages([
                    'close_at' => 'La fecha de cierre no puede ser menor que la de apertura.',
                ]);
            }
            if ($closeAt->gt($openAt->copy()->addDays(10))) {
                throw ValidationException::withMessages([
                    'close_at' => 'La ventana de captura no puede superar los 10 días.',
                ]);
            }
        }

        $call->fill([
            'title'     => $data['title']     ?? $call->title,
            'open_at'   => $data['open_at']   ?? $call->open_at,
            'close_at'  => $data['close_at']  ?? $call->close_at,
            'is_active' => $data['is_active'] ?? $call->is_active,
            'notes'     => $data['notes']     ?? $call->notes,
        ])->save();

        return $call;
    }

    /**
     * Agrega o quita productos de la convocatoria.
     */
    public function syncProducts(int $callId, array $products): void
    {
        // products: [{product_id, default_unit_id?, is_enabled?, sort_order?}, ...]
        $call = RequisitionCall::findOrFail($callId);

        DB::transaction(function () use ($call, $products) {
            // Estrategia simple: upsert por (requisition_call_id, product_id)
            foreach ($products as $i => $p) {
                RequisitionCallProduct::updateOrCreate(
                    [
                        'requisition_call_id' => $call->id,
                        'product_id'          => $p['product_id'],
                    ],
                    [
                        'default_unit_id'     => $p['default_unit_id'] ?? null,
                        'is_enabled'          => $p['is_enabled'] ?? true,
                        'sort_order'          => $p['sort_order'] ?? $i,
                    ]
                );
            }
        });
    }

    /**
     * Devuelve la convocatoria activa por (año, mes) o null.
     */
    public function findActiveByPeriod(int $year, int $month): ?RequisitionCall
    {
        return RequisitionCall::where('year', $year)
            ->where('month', $month)
            ->where('is_active', true)
            ->first();
    }
}
