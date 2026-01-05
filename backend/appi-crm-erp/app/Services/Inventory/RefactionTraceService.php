<?php

namespace App\Services\Inventory;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Models\Product\VehicleRefactionTrace;
use App\Models\Product\ExitProduct;
use App\Models\Product\ProductExit;
use App\Models\Product\Product;
use App\Models\Vehiculos;

class RefactionTraceService
{
    
    
    /**
     * Registra trazabilidad automática al crear una salida.
     * Se llama DESPUÉS de insertar en exit_products.
     */
    public function registerTrace(ExitProduct $exitProduct): void
    {
        try {
            // 1) Salida principal (product_exits)
            $productExit = ProductExit::find($exitProduct->product_exit_id);
            if (!$productExit) {
                Log::warning("🔎 [Trace] product_exit no encontrado para exit_product_id {$exitProduct->id}");
                return;
            }

            if (empty($exitProduct->entry_id)) {
                Log::warning("🔎 [Trace] exit_product_id {$exitProduct->id} no tiene entry_id, no se puede trazar");
                return;
            }

            // 2) Traer toda la “cadena” desde entry_product → product_entries → order_requests → order_products
            $row = DB::table('entry_product as ep')
                ->join('product_entries as pe', 'pe.id', '=', 'ep.entry_id')
                // order_requests por order_number de product_entries
                ->leftJoin('order_requests as orq', function ($join) {
                    $join->on('orq.order_number', '=', 'pe.order_number')
                         ->whereNull('orq.deleted_at');
                })
                // order_products para ese pedido y ese producto
                ->leftJoin('order_products as op', function ($join) use ($exitProduct) {
                    $join->on('op.order_request_id', '=', 'orq.id')
                         ->where('op.product_id', '=', $exitProduct->product_id)
                         ->whereNull('op.deleted_at');
                })
                ->where('ep.id', $exitProduct->entry_id)
                ->whereNull('ep.deleted_at')
                ->selectRaw("
                    ep.id              as entry_product_id,
                    ep.invoice_number  as ep_invoice_number,
                    ep.partida         as ep_partida,

                    pe.id              as product_entry_id,
                    pe.order_number    as pe_order_number,
                    pe.partida         as pe_partida,

                    orq.id             as order_request_id,
                    orq.order_number   as orq_order_number,

                    op.id              as order_product_id,
                    op.vehicle_id      as op_vehicle_id,
                    op.placa           as op_placa,
                    op.modelo          as op_modelo,
                    op.marca_id        as op_marca_id,
                    op.tipo_id         as op_tipo_id,
                    op.cilindro        as op_cilindro,
                    op.partida         as op_partida
                ")
                ->first();

            if (!$row) {
                Log::warning("🔎 [Trace] No se encontró cadena entry_product → product_entries → order_requests → order_products para exit_product_id {$exitProduct->id}");
                return;
            }

            // 3) Extraer datos con prioridades claras

            // Factura REAL de la entrada (entry_product.invoice_number)
            $invoiceNumber = $row->ep_invoice_number ?? null;

            // Orden de compra: preferimos order_requests.order_number,
            // si no existe, usamos pe.order_number (de product_entries)
            $orderNumber = $row->orq_order_number
                ?? $row->pe_order_number
                ?? null;

            // Partida: prioridad
            // 1) order_products.partida
            // 2) entry_product.partida
            // 3) product_entries.partida
            $partida = $row->op_partida
                ?? $row->ep_partida
                ?? $row->pe_partida
                ?? null;

            // Vehículo y datos relacionados desde order_products
            $vehicleId = $row->op_vehicle_id ?? null;
            $placa     = $row->op_placa ?? null;
            $modelo    = $row->op_modelo ?? null;
            $marcaId   = $row->op_marca_id ?? null;
            $tipoId    = $row->op_tipo_id ?? null;
            $cilindro  = $row->op_cilindro ?? null;

            // 4) Producto (por si necesitas validar algo futuro)
            $product = Product::find($exitProduct->product_id);

            // 5) Insertar registro en vehicle_refaction_trace
            VehicleRefactionTrace::create([
                'product_id'       => $exitProduct->product_id,
                'exit_product_id'  => $exitProduct->id,
                'product_exit_id'  => $productExit->id,
                'entry_product_id' => $row->entry_product_id,
                'cantidad'         => $exitProduct->quantity,
                'invoice_number'   => $invoiceNumber,
                'order_number'     => $orderNumber,
                'partida'          => $partida,
                'vehicle_id'       => $vehicleId,
                'placa'            => $placa,
                'modelo'           => $modelo,
                'marca_id'         => $marcaId,
                'tipo_id'          => $tipoId,
                'cilindro'         => $cilindro,
                'fecha_salida'     => $productExit->exit_date,
            ]);

            Log::info("✅ [Trace] Trazabilidad registrada para exit_product_id {$exitProduct->id} (salida {$productExit->id})", [
                'product_id'     => $exitProduct->product_id,
                'invoice_number' => $invoiceNumber,
                'order_number'   => $orderNumber,
                'vehicle_id'     => $vehicleId,
                'placa'          => $placa,
            ]);
        } catch (\Throwable $e) {
            Log::error("❌ [Trace] Error registrando trazabilidad para exit_product_id {$exitProduct->id}: " . $e->getMessage());
        }
    }

    /**
     * Elimina trazabilidad si una salida se cancela.
     */
    public function deleteTraceByExit(int $productExitId): void
    {
        VehicleRefactionTrace::where('product_exit_id', $productExitId)->delete();
    }
}
    


    
