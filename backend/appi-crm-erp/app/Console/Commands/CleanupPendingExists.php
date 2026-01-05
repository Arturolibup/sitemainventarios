<?php

namespace App\Console\Commands;

use Exception;
use App\Models\Product\ExitProduct;
use App\Models\Product\ProductExit;
use App\Models\Product\ProductWarehouse;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CleanupPendingExists extends Command
{
    
    protected $signature = 'exits:cleanup-pending';
    protected $description = 'Elimina salidas pendientes que han expirado y restaura el stock de productos';

    public function __construct()
    {
        parent::__construct();
    }

    public function handle()
    {
        Log::info('Ejecutando limpieza de salidas pendientes expiradas');

        try {
            $now = now ('UTC');
            Log::info('Hora actual del servidor (UTC): {$now}');
            //buscar salidas pendientes 
            $expiredExits = ProductExit::where('exit_status', 'pending')
                ->whereNotNull('pending_expires_at')
                ->where('pending_expires_at', '<', now())
                ->with ('products')
                ->get();

                if ($expiredExits->isEmpty()) {
                    Log::info('No se encontraron salidas pendientes expiradas');
                    $this->info('No se encontraron salidas pendientes expiradas');
                    return;
                }
    
                Log::info("Se encontraron {$expiredExits->count()} salidas pendientes expiradas");    

            foreach ($expiredExits as $exit) {
                DB::transaction(function () use ($exit) { // Elimina el try interno
                    Log::info("Procesando salida ID {$exit->id}, referencia: {$exit->reference}, expira: {$exit->pending_expires_at}");
                    
                    // 1. Restaurar stock
                    foreach ($exit->products as $item) {
                        $warehouse = ProductWarehouse::where('product_id', $item->product_id)
                            ->where('warehouse', $item->warehouse)
                            ->lockForUpdate()
                            ->first();

                        if ($warehouse) {
                            $warehouse->increment('stock', $item->quantity);
                            Log::info("Stock restaurado: product_id {$item->product_id}, cantidad: {$item->quantity}");
                        }else {
                            Log::warning("No se encontró registro de almacén para product_id {$item->product_id}, almacén: {$item->warehouse}");
                        }
                    }

                    // 2. Eliminar relaciones
                    ExitProduct::where('product_exit_id', $exit->id)->delete();

                    // 3. Eliminar salida
                    $exit->delete();
                    Log::info("Salida ID {$exit->id} eliminada");
                });
            }
            Log::info('Limpieza de salidas pendientes expiradas completada');    
            $this->info('Salidas pendientes expiradas eliminadas correctamente.');
        } catch (Exception $e) {
            Log::error("Error durante la limpieza de salidas expiradas: " . $e->getMessage());
            $this->error("Error: " . $e->getMessage());
        }
    }
}    
    

