<?php

namespace App\Http\Controllers\Product;

use DateTime;
use Exception;
use Carbon\Carbon;
//use Barryvdh\DomPDF\PDF;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use App\Models\Product\Product;
use Barryvdh\DomPDF\Facade\Pdf;
use App\Models\Configuration\Area;
use Illuminate\Support\Facades\DB;
use App\Models\Product\ExitProduct;
use App\Models\Product\ProductExit;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\Controller;
use App\Models\Product\EntryProduct;
use App\Models\Product\ProductEntry;
use App\Models\Configuration\Subarea;
use App\Models\Requisition\Requisition;
use Illuminate\Support\Facades\Storage;
use App\Models\Product\ProductWarehouse;
use App\Models\Product\PurchaseDocument;
use Illuminate\Support\Facades\Validator;
use App\Services\Inventory\RefactionTraceService;

class ProductExitController extends Controller
{
    public function __construct()
    {
       
    $this->middleware('auth:api');
    $this->middleware('permission:product_exits.list')->only(['index']);
    $this->middleware('permission:product_exits.view')->only(['show']);
    $this->middleware('permission:product_exits.create')->only(['store']);
    $this->middleware('permission:product_exits.update')->only(['update']);
    $this->middleware('permission:product_exits.delete')->only(['destroy']);
    }
    

    public function index(Request $request)
    {
        try {
            $query = ProductExit::with([
                'area' => fn($q) => $q->select('id', 'name'),
                'subarea' => fn($q) => $q->select('id', 'name'),
                'products.product' => fn($q) => $q->select('id', 'title'),
                'createdBy' => fn($q) => $q->select('id', 'name')
            ]);

            if ($request->has('folio') && !empty($request->folio)) {
                $query->where('reference', 'LIKE', '%' . $request->folio . '%');
            }
            if ($request->has('area') && !empty($request->area)) {
                $query->whereHas('area', fn($q) => $q->where('name', 'LIKE', '%' . $request->area . '%'));
            }
            if ($request->has('subarea') && !empty($request->subarea)) {
                $query->whereHas('subarea', fn($q) => $q->where('name', 'LIKE', '%' . $request->subarea . '%'));
            }
            if ($request->has('exit_date') && !empty($request->exit_date)) {
                $query->whereDate('exit_date', $request->exit_date);
            }
            if ($request->has('exit_status') && !empty($request->exit_status)) {
                $query->where('exit_status', $request->exit_status);
                if ($request->exit_status === 'pending') {
                    $query->whereNotNull('pending_expires_at');
                } else {
                    $query->whereNull('pending_expires_at');
                }
            }

            $perPage = (int) $request->input('per_page', 10);
            $exits = $query->orderBy('id', 'desc')->paginate($perPage);

            $exits->getCollection()->transform(function ($exit) {
                $exit->created_by_name = $exit->createdBy ? $exit->createdBy->name : 'N/A';
                return $exit;
            });

            return response()->json([
                'data' => $exits->items(),
                'total' => $exits->total(),
                'per_page' => $exits->perPage(),
                'current_page' => $exits->currentPage()
            ], 200);
        } catch (Exception $e) {
            Log::error("Error al listar salidas: " . $e->getMessage());
            return response()->json(['message' => 'Error al listar salidas', 'error' => $e->getMessage()], 500);
        }
    }


    public function store(Request $request)
    {
        Log::info("Datos recibidos en store: " . json_encode($request->all()));

        // VALIDACIÓN MEJORADA: usedEntries OPCIONAL
        $validator = Validator::make($request->all(), [
            'area_id' => 'required|integer|exists:areas,id',
            'subarea_id' => 'required|integer|exists:subareas,id',
            'reference' => 'required|string|max:60',
            'exit_date' => 'required|date',
            'received_by' => 'nullable|string|max:255',
            'delivered_by' => 'required|string|max:255',
            'authorized_by' => 'nullable|string|max:255',
            'products' => 'required|array|min:1',
            'products.*.product_id' => 'required|exists:products,id',
            'products.*.quantity' => 'required|integer|min:1',
            'products.*.warehouse' => 'required|string|max:255',
            // usedEntries: OPCIONAL (solo si usuario quiere forzar)
            'products.*.usedEntries' => 'nullable|array',
            'products.*.usedEntries.*.entry_id' => 'required_with:products.*.usedEntries|exists:entry_product,id',
            'products.*.usedEntries.*.quantity' => 'required_with:products.*.usedEntries|integer|min:1',
            'products.*.usedEntries.*.invoice_number' => 'nullable|string|max:255',
            'exit_status' => 'required|in:pending,completed',
            'pending_expires_at' => 'required_if:exit_status,pending|nullable|date',
            'invoice_mode' => 'required|in:multiple_invoices,single_invoice',
            'single_invoice_number' => 'required_if:invoice_mode,single_invoice|nullable|string|max:255'
        ], [
            'exit_status.in' => 'El estado debe ser "pending" o "completed".',
            'pending_expires_at.required_if' => 'La fecha de caducidad es obligatoria para salidas pendientes.',
            'pending_expires_at.date' => 'La fecha de caducidad debe ser una fecha válida.'
        ]);

        if ($validator->fails()) {
            Log::warning("Validación fallida: " . json_encode($validator->errors()->all()));
            return response()->json(['message' => 'Error de validación', 'errors' => $validator->errors()->all()], 422);
        }

        try {
            return DB::transaction(function () use ($request) {
                $lastExit = ProductExit::orderBy('id', 'desc')->first();
                $nextId = $lastExit ? $lastExit->id + 1 : 1;
                $folio = 'EXIT-' . str_pad($nextId, 6, '0', STR_PAD_LEFT);
                Log::info("Generando folio para nueva salida: {$folio}");

                $pendingExpiresAt = null;
                if ($request->exit_status === 'pending' && $request->pending_expires_at) {
                    $dateTime = \Carbon\Carbon::parse($request->pending_expires_at, 'America/Mazatlan');
                    $now = \Carbon\Carbon::now('America/Mazatlan');
                    $minFutureTime = $now->copy()->addMinutes(5);
                    if ($dateTime->lessThanOrEqualTo($minFutureTime)) {
                        return response()->json([
                            'message' => 'Error de validación',
                            'errors' => ['La fecha de caducidad debe ser al menos 5 minutos en el futuro.']
                        ], 422);
                    }
                    $pendingExpiresAt = $dateTime->setTimezone('UTC')->format('Y-m-d H:i:s');
                }

                $exitData = [
                    'area_id' => $request->area_id,
                    'subarea_id' => $request->subarea_id,
                    'folio' => $folio,
                    'reference' => $request->reference,
                    'exit_date' => $request->exit_date,
                    'received_by' => $request->received_by ?? 'Pendiente',
                    'delivered_by' => $request->delivered_by,
                    'authorized_by' => $request->authorized_by ?? 'Pendiente',
                    'created_by' => auth()->id(),
                    'exit_status' => $request->exit_status,
                    'pending_expires_at' => $pendingExpiresAt,
                    'pending_products' => null,
                    'invoice_mode' => $request->invoice_mode,
                    'single_invoice_number' => $request->single_invoice_number
                ];

                $exit = ProductExit::create($exitData);
                Log::info("Salida creada: {$folio}");

                $exitProductsData = [];

                foreach ($request->products as $productData) {
                    $productId = $productData['product_id'];
                    $quantityRequested = $productData['quantity'];
                    $warehouse = $productData['warehouse'];

                    // VALIDAR STOCK GLOBAL
                    $warehouseRecord = ProductWarehouse::where('product_id', $productId)
                        ->where('warehouse', $warehouse)
                        ->lockForUpdate()
                        ->first();

                    if (!$warehouseRecord || $warehouseRecord->stock < $quantityRequested) {
                        throw new \Exception("Stock insuficiente en almacén {$warehouse} para producto ID {$productId}. Disponible: " . ($warehouseRecord->stock ?? 0));
                    }

                    // SI HAY usedEntries → USUARIO FORZÓ ENTRADAS
                    if (!empty($productData['usedEntries'])) {
                        foreach ($productData['usedEntries'] as $entryData) {
                            $entryId = $entryData['entry_id'];
                            $entryQty = $entryData['quantity'];
                            $invoiceNumber = $entryData['invoice_number'] ?? 'N/A';

                            $entry = EntryProduct::where('id', $entryId)
                                ->where('product_id', $productId)
                                ->firstOrFail();

                            $totalExited = ExitProduct::where('entry_id', $entryId)->sum('quantity');
                            $available = $entry->quantity - $totalExited;

                            if ($available < $entryQty) {
                                throw new \Exception("Cantidad insuficiente en entrada ID {$entryId}. Disponible: {$available}");
                            }

                            $exitProductsData[] = [
                                'product_exit_id' => $exit->id,
                                'product_id' => $productId,
                                'quantity' => $entryQty,
                                'warehouse' => $warehouse,
                                'invoice_number' => $invoiceNumber,
                                'entry_id' => $entryId,
                                'created_at' => now(),
                                'updated_at' => now(),
                            ];
                        }
                    } else {
                        // FIFO AUTOMÁTICO
                        $entries = EntryProduct::select(
                                'entry_product.*',
                                'product_entries.invoice_number as pe_invoice'
                            )
                            ->join('product_entries', 'entry_product.entry_id', '=', 'product_entries.id')
                            ->where('entry_product.product_id', $productId);

                        // FILTRO POR FACTURA (single_invoice)
                        if ($request->invoice_mode === 'single_invoice') {
                            $entries->where('product_entries.invoice_number', $request->single_invoice_number);
                        }

                        $entries = $entries->orderBy('entry_product.created_at', 'asc')->get();

                        if ($entries->isEmpty()) {
                            throw new \Exception("No hay entradas disponibles para producto ID {$productId}");
                        }

                        $remaining = $quantityRequested;
                        foreach ($entries as $entry) {
                            if ($remaining <= 0) break;

                            $totalExited = ExitProduct::where('entry_id', $entry->id)->sum('quantity');
                            $available = $entry->quantity - $totalExited;
                            if ($available <= 0) continue;

                            $take = min($available, $remaining);
                            $invoiceNumber = $entry->invoice_number ?? $entry->pe_invoice ?? 'N/A';

                            $exitProductsData[] = [
                                'product_exit_id' => $exit->id,
                                'product_id' => $productId,
                                'quantity' => $take,
                                'warehouse' => $warehouse,
                                'invoice_number' => $invoiceNumber,
                                'entry_id' => $entry->id,
                                'created_at' => now(),
                                'updated_at' => now(),
                            ];

                            $remaining -= $take;
                        }

                        if ($remaining > 0) {
                            throw new \Exception("No hay entradas suficientes para producto ID {$productId}. Faltan: {$remaining}");
                        }
                    }

                    // DESCONTAR STOCK GLOBAL
                    $warehouseRecord->decrement('stock', $quantityRequested);
                    Log::info("Stock descontado: -{$quantityRequested} para producto ID {$productId} en {$warehouse}");

                    // VERIFICAR STOCK BAJO
                    $this->verifyLowStock($productId, $warehouse);
                }

                // INSERTAR TODOS LOS PRODUCTOS
                if (!empty($exitProductsData)) {
                    DB::table('exit_products')->insert($exitProductsData);
                    Log::info("Insertados " . count($exitProductsData) . " registros en exit_products");
                }


                //AÑADIDO PARA VINCULAR VEHICULOS Y TRAZABILIDAD
                // =============================================
                // 🔵 TRAZABILIDAD AUTOMÁTICA PARA NUEVAS SALIDAS
                // =============================================
                try {
                    /** @var RefactionTraceService $traceService */
                    $traceService = app(RefactionTraceService::class);

                    // Cargar todos los exit_products recién creados para esta salida
                    $exitProducts = ExitProduct::where('product_exit_id', $exit->id)->get();

                    foreach ($exitProducts as $exitProduct) {
                        $traceService->registerTrace($exitProduct);
                    }

                    Log::info("Trazabilidad registrada para salida ID {$exit->id} (store)");
                } catch (\Throwable $e) {
                    Log::error("Error al registrar trazabilidad en store para salida ID {$exit->id}: " . $e->getMessage());
                    // No hacemos rollback por trazabilidad, solo dejamos log
                }
                //HASTA AQUI EL CODIGO DE TRAZABILIDAD DEL VEHICULO


                // RECARGAR SALIDA CON DETALLE
                $exit = ProductExit::with([
                    'area:id,name',
                    'subarea:id,name',
                    'products' => fn($q) => $q->with(['product:id,title', 'entry'])
                ])->findOrFail($exit->id);

                // GENERAR PDF
                $this->generateExitPdf($exit->id);

                return response()->json([
                    'message' => 'Salida registrada correctamente',
                    'exit_id' => $exit->id,
                    'folio' => $folio,
                    'reference' => $exit->reference,
                    'pending_expires_at' => $exit->pending_expires_at,
                    'single_invoice_number' => $exit->single_invoice_number
                ], 201);
            });
        } catch (\Exception $e) {
            Log::error("Error al registrar salida: " . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function update(Request $request, $id)
    {
        Log::info("Actualizando salida ID {$id}: " . json_encode($request->all()));

        $validator = Validator::make($request->all(), [
            'area_id' => 'required|integer|exists:areas,id',
            'subarea_id' => 'required|integer|exists:subareas,id',
            'reference' => 'required|string|max:60',
            'exit_date' => 'required|date',
            'received_by' => 'nullable|string|max:255',
            'delivered_by' => 'required|string|max:255',
            'authorized_by' => 'nullable|string|max:255',
            'products' => 'required|array|min:1',
            'products.*.product_id' => 'required|exists:products,id',
            'products.*.quantity' => 'required|integer|min:1',
            'products.*.warehouse' => 'required|string|max:255',
            'products.*.entry_id' => 'required_if:invoice_mode,single_invoice|exists:entry_product,id',
            'products.*.usedEntries' => 'nullable|array',
            'products.*.usedEntries.*.entry_id' => 'required_if:invoice_mode,multiple_invoices|exists:entry_product,id',
            'products.*.usedEntries.*.quantity' => 'required_if:invoice_mode,multiple_invoices|integer|min:1',
            'products.*.usedEntries.*.invoice_number' => 'nullable|string|max:255',
            'exit_status' => 'required|in:pending,completed',
            'pending_expires_at' => 'required_if:exit_status,pending|nullable|date|after:now',
            'invoice_mode' => 'required|in:multiple_invoices,single_invoice',
            'single_invoice_number' => 'required_if:invoice_mode,single_invoice|nullable|string|max:255'
        ], [
            'exit_status.in' => 'El estado debe ser "pending" o "completed".',
            'pending_expires_at.required_if' => 'La fecha de caducidad es obligatoria para salidas pendientes.',
            'pending_expires_at.after' => 'La fecha de caducidad debe ser futura.'
        ]);

        if ($validator->fails()) {
            Log::warning("Validación fallida para salida ID {$id}: " . json_encode($validator->errors()->all()));
            return response()->json(['message' => 'Error de validación', 'errors' => $validator->errors()->all()], 422);
        }

        try {
            return DB::transaction(function () use ($request, $id) {
                $exit = ProductExit::findOrFail($id);

                $pendingExpiresAt = null;
                if ($request->exit_status === 'pending' && $request->pending_expires_at) {
                    $dateTime = \Carbon\Carbon::parse($request->pending_expires_at, 'America/Mazatlan');
                    $now = \Carbon\Carbon::now('America/Mazatlan');
                    $minFutureTime = $now->copy()->addMinutes(5);
                    if ($dateTime->lessThanOrEqualTo($minFutureTime)) {
                        Log::warning("Fecha de caducidad no futura: {$request->pending_expires_at}, debe ser posterior a {$minFutureTime}");
                        return response()->json([
                            'message' => 'Error de validación',
                            'errors' => ['La fecha de caducidad debe ser al menos 5 minutos en el futuro.']
                        ], 422);
                    }
                    $pendingExpiresAt = $dateTime->setTimezone('UTC')->format('Y-m-d H:i:s');
                }

                // Actualizar la salida primero
                $exitData = [
                    'area_id' => $request->area_id,
                    'subarea_id' => $request->subarea_id,
                    'reference' => $request->reference,
                    'exit_date' => $request->exit_date,
                    'received_by' => $request->received_by ?? 'Pendiente',
                    'delivered_by' => $request->delivered_by,
                    'authorized_by' => $request->authorized_by ?? 'Pendiente',
                    'updated_by' => auth()->id(),
                    'exit_status' => $request->exit_status,
                    'pending_expires_at' => $pendingExpiresAt,
                    'invoice_mode' => $request->invoice_mode,
                    'single_invoice_number' => $request->single_invoice_number
                ];
                $exit->update($exitData);
                Log::info("Salida ID {$id} actualizada con datos: " . json_encode($exitData));

                // Restaurar stock de productos existentes
                foreach ($exit->products as $oldProduct) {
                    $warehouse = ProductWarehouse::where('product_id', $oldProduct->product_id)
                        ->where('warehouse', $oldProduct->warehouse)
                        ->lockForUpdate()
                        ->first();
                    if ($warehouse) {
                        $warehouse->increment('stock', $oldProduct->quantity);
                        Log::info("Stock restaurado para producto ID {$oldProduct->product_id}: +{$oldProduct->quantity}");
                    }
                }

                //ACTUALIZAR LA TRAZABILIDAD DEL VEHICULO
                // =============================================
                // 🔴 LIMPIAR TRAZABILIDAD ANTERIOR DE ESTA SALIDA
                // =============================================
                try {
                    /** @var RefactionTraceService $traceService */
                    $traceService = app(RefactionTraceService::class);
                    $traceService->deleteTraceByExit($exit->id);
                    Log::info("Trazabilidad eliminada para salida ID {$exit->id} (update)");
                } catch (\Throwable $e) {
                    Log::error("Error al eliminar trazabilidad en update para salida ID {$exit->id}: " . $e->getMessage());
                }




                // Eliminar productos existentes
                ExitProduct::where('product_exit_id', $exit->id)->delete();

                // Procesar nuevos productos
                $exitProductsData = [];
                foreach ($request->products as $productData) {
                    $productId = $productData['product_id'];
                    $quantityRequested = $productData['quantity'];
                    $warehouse = $productData['warehouse'];

                    // Verificar stock disponible
                    $warehouseRecord = ProductWarehouse::where('product_id', $productId)
                        ->where('warehouse', $warehouse)
                        ->lockForUpdate()
                        ->first();
                    if (!$warehouseRecord || $warehouseRecord->stock < $quantityRequested) {
                        throw new Exception("Stock insuficiente en almacén {$warehouse} para producto ID {$productId}. Disponible: " . ($warehouseRecord ? $warehouseRecord->stock : 0));
                    }

                    $warehouseRecord->decrement('stock', $quantityRequested);
                    Log::info("Stock actualizado para producto ID {$productId} en almacén {$warehouse}: -{$quantityRequested}");

                    if ($request->invoice_mode === 'multiple_invoices') {
                        if (!isset($productData['usedEntries']) || !is_array($productData['usedEntries'])) {
                            throw new Exception("Entradas utilizadas (usedEntries) requeridas para producto ID {$productId} en modo multiple_invoices.");
                        }

                        $totalUsedQuantity = array_sum(array_column($productData['usedEntries'], 'quantity'));
                        if ($totalUsedQuantity !== $quantityRequested) {
                            throw new Exception("La suma de cantidades en usedEntries ({$totalUsedQuantity}) no coincide con la cantidad solicitada ({$quantityRequested}) para producto ID {$productId}.");
                        }

                        foreach ($productData['usedEntries'] as $entryData) {
                            $entryId = $entryData['entry_id'];
                            $entryQuantity = $entryData['quantity'];
                            $invoiceNumber = $entryData['invoice_number'] ?? 'N/A';

                            $entry = EntryProduct::where('id', $entryId)
                                ->where('product_id', $productId)
                                ->first();
                            if (!$entry) {
                                throw new Exception("Entrada con ID {$entryId} no encontrada o no corresponde al producto ID {$productId}.");
                            }

                            $totalExited = ExitProduct::where('entry_id', $entryId)
                                ->where('product_exit_id', '!=', $exit->id)
                                ->sum('quantity');
                            $available = $entry->quantity - $totalExited;
                            if ($available < $entryQuantity) {
                                throw new Exception("Cantidad insuficiente en entrada ID {$entryId} para producto ID {$productId}. Disponible: {$available}, Solicitado: {$entryQuantity}.");
                            }

                            $exitProductsData[] = [
                                'product_exit_id' => $exit->id,
                                'product_id' => $productId,
                                'quantity' => $entryQuantity,
                                'warehouse' => $warehouse,
                                'invoice_number' => $invoiceNumber,
                                'entry_id' => $entryId,
                                'created_at' => now(),
                                'updated_at' => now(),
                            ];
                        }
                    } else {
                        $entryId = $productData['entry_id'];
                        $invoiceNumber = $productData['invoice_number'] ?? 'N/A';

                        $entry = EntryProduct::where('id', $entryId)
                            ->where('product_id', $productId)
                            ->first();
                        if (!$entry) {
                            throw new Exception("Entrada con ID {$entryId} no encontrada o no corresponde al producto ID {$productId}.");
                        }

                        if ($invoiceNumber !== $request->single_invoice_number) {
                            throw new Exception("El producto ID {$productId} pertenece a una factura diferente ({$invoiceNumber}) que no coincide con la factura seleccionada ({$request->single_invoice_number}).");
                        }

                        $totalExited = ExitProduct::where('entry_id', $entryId)
                            ->where('product_exit_id', '!=', $exit->id)
                            ->sum('quantity');
                        $available = $entry->quantity - $totalExited;
                        if ($available < $quantityRequested) {
                            throw new Exception("Cantidad insuficiente en entrada ID {$entryId} para producto ID {$productId}. Disponible: {$available}, Solicitado: {$quantityRequested}.");
                        }

                        $exitProductsData[] = [
                            'product_exit_id' => $exit->id,
                            'product_id' => $productId,
                            'quantity' => $quantityRequested,
                            'warehouse' => $warehouse,
                            'invoice_number' => $invoiceNumber,
                            'entry_id' => $entryId,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    }

                    // Cambiar la llamada a checkLowStock por verifyLowStock
                    $this->verifyLowStock($productId, $warehouse);
                }

                // Insertar nuevos productos
                if (!empty($exitProductsData)) {
                    DB::table('exit_products')->insert($exitProductsData);
                    Log::info("Productos insertados en exit_products para salida ID {$id}: " . json_encode($exitProductsData));
                }// =============================================
                
                
                // 🔵 REGENERAR TRAZABILIDAD PARA LOS NUEVOS PRODUCTOS VEHICULOS
                // =============================================
                try {
                    /** @var RefactionTraceService $traceService */
                    $traceService = app(RefactionTraceService::class);

                    $exitProducts = ExitProduct::where('product_exit_id', $exit->id)->get();
                    foreach ($exitProducts as $exitProduct) {
                        $traceService->registerTrace($exitProduct);
                    }

                    Log::info("Trazabilidad regenerada para salida ID {$exit->id} (update)");
                } catch (\Throwable $e) {
                    Log::error("Error al regenerar trazabilidad en update para salida ID {$exit->id}: " . $e->getMessage());
                }


                // Eliminar PDFs anteriores
                $entryIds = collect($exitProductsData)->pluck('entry_id')->unique();
                $entries = EntryProduct::whereIn('id', $entryIds)
                    ->with(['productEntry' => fn($q) => $q->select('id', 'invoice_number')])
                    ->get()
                    ->pluck('productEntry')
                    ->filter()
                    ->unique('id');

                foreach ($entries as $entry) {
                    $existingDocument = PurchaseDocument::where('entry_id', $entry->id)
                        ->where('is_auto_pdf', true)
                        ->where('original_name', 'like', "salida_{$exit->id}_%")
                        ->first();
                    if ($existingDocument) {
                        Storage::disk('public')->delete($existingDocument->file_path);
                        Log::info("Archivo PDF anterior eliminado para entrada ID {$entry->id}: {$existingDocument->file_path}");
                        DB::table('document_history')->insert([
                            'document_id' => $existingDocument->id,
                            'document_type' => 'purchase_document',
                            'action' => 'deleted',
                            'user_id' => auth()->id(),
                            'created_at' => now(),
                            'updated_at' => now()
                        ]);
                        $existingDocument->delete();
                    }
                }

                // Commit de la transacción antes de generar el PDF
                DB::commit();

                // Generar nuevo PDF con datos actualizados
                $this->generateExitPdf($exit->id);

                // Recargar salida para la respuesta
                $exit = ProductExit::with([
                    'area' => fn($q) => $q->select('id', 'name'),
                    'subarea' => fn($q) => $q->select('id', 'name'),
                    'products' => fn($query) => $query->with(['product' => fn($q) => $q->select('id', 'title'), 'entry']),
                    'createdBy' => fn($q) => $q->select('id', 'name')
                ])->findOrFail($id);

                $exit->products->each(function ($product) use ($exit) {
                    $entry = EntryProduct::find($product->entry_id);
                    $totalExited = ExitProduct::where('entry_id', $product->entry_id)
                        ->where('product_exit_id', '!=', $product->product_exit_id)
                        ->sum('quantity');
                    $availableStock = $entry ? ($entry->quantity - $totalExited) : 0;

                    $warehouseRecord = ProductWarehouse::where('product_id', $product->product_id)
                        ->where('warehouse', $product->warehouse)
                        ->first();
                    $globalStock = $warehouseRecord ? $warehouseRecord->stock : 0;

                    $product->stock = $exit->invoice_mode === 'multiple_invoices' ? $globalStock : $availableStock;
                    $product->stock_global = $globalStock;
                    $product->unit = $entry && $entry->unit ? $entry->unit->name : 'pieza';
                });

                Log::info("Salida ID {$id} actualizada con productos: " . json_encode($exit->products));

                return response()->json([
                    'message' => 'Salida actualizada correctamente',
                    'exit_id' => $exit->id,
                    'folio' => $exit->folio,
                    'reference' => $exit->reference,
                    'area' => $exit->area,
                    'subarea' => $exit->subarea,
                    'exit_date' => $exit->exit_date,
                    'received_by' => $exit->received_by,
                    'delivered_by' => $exit->delivered_by,
                    'authorized_by' => $exit->authorized_by,
                    'created_by' => $exit->createdBy,
                    'exit_status' => $exit->exit_status,
                    'pending_expires_at' => $exit->pending_expires_at,
                    'invoice_mode' => $exit->invoice_mode,
                    'single_invoice_number' => $exit->single_invoice_number,
                    'products' => $exit->products,
                ], 200);
            });
        } catch (Exception $e) {
            DB::rollBack();
            Log::error("Error al actualizar salida ID {$id}: " . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }


    private function verifyLowStock($productId, $warehouse)
    {
        Log::info("Verificando stock bajo para producto ID {$productId} en almacén {$warehouse}");

        try {
            $warehouseRecord = ProductWarehouse::where('product_id', $productId)
                ->where('warehouse', $warehouse)
                ->first();

            $product = Product::find($productId);
            if ($warehouseRecord && $product && $warehouseRecord->stock <= $product->umbral) {
                Log::warning("Stock bajo detectado para producto ID {$productId} en almacén {$warehouse}: {$warehouseRecord->stock} unidades restantes, umbral: {$product->umbral}");
            }
        } catch (\Exception $e) {
            Log::error("Error al verificar stock bajo para producto ID {$productId} en almacén {$warehouse}: " . $e->getMessage());
        }
    }

    public function checkLowStock(Request $request)
    {
        Log::info("Verificando stock bajo para productos: " . json_encode($request->all()));

        $validator = Validator::make($request->all(), [
            'product_ids' => 'required|array|min:1',
            'product_ids.*' => 'required|integer|exists:products,id'
        ]);

        if ($validator->fails()) {
            Log::warning("Validación fallida en checkLowStock: " . json_encode($validator->errors()->all()));
            return response()->json(['message' => 'Error de validación', 'errors' => $validator->errors()->all()], 422);
        }

        try {
            $productIds = $request->input('product_ids');
            $products = Product::whereIn('id', $productIds)
                ->select('id', 'title', 'umbral')
                ->get();

            $lowStockProducts = [];
            foreach ($products as $product) {
                $warehouseRecord = ProductWarehouse::where('product_id', $product->id)
                    ->where('warehouse', 'Central Aguamilpa')
                    ->first();

                $stock = $warehouseRecord ? $warehouseRecord->stock : 0;
                if ($stock <= $product->umbral) {
                    $lowStockProducts[] = [
                        'product_id' => $product->id,
                        'title' => $product->title,
                        'stock' => $stock,
                        'umbral' => $product->umbral
                    ];
                }
            }

            Log::info("Productos con stock bajo encontrados: " . json_encode($lowStockProducts));
            return response()->json($lowStockProducts, 200);
        } catch (Exception $e) {
            Log::error("Error al verificar stock bajo: " . $e->getMessage());
            return response()->json(['message' => 'Error al verificar stock bajo', 'error' => $e->getMessage()], 500);
        }
    }

    public function searchProducts(Request $request)
    {
        $query = $request->input('query', '');
        $products = Product::where('title', 'LIKE', "%{$query}%")
            ->orWhere('sku', 'LIKE', "%{$query}%")
            ->get();

        $results = $products->map(function ($product) {
            $warehouseRecord = ProductWarehouse::where('product_id', $product->id)
                ->where('warehouse', 'Central Aguamilpa')
                ->with(['unit' => fn($q) => $q->select('id', 'name')])
                ->first();

            $stock = $warehouseRecord ? $warehouseRecord->stock : 0;

            if ($stock > 0) {
                $latestEntry = EntryProduct::where('product_id', $product->id)
                    ->with (['productEntry'])
                    ->orderBy('created_at', 'desc')
                    ->first();
                return [
                    'product_id' => $product->id,
                    'title' => $product->title,
                    'sku' => $product->sku,
                    'stock' => $stock,
                    'stock_global' => $stock,
                    'invoice_number' => $latestEntry && $latestEntry -> productEntry ? $latestEntry->productEntry-> invoice_number : null,
                    'entry_id' => $latestEntry ? $latestEntry->id : null,
                    'unit' => $warehouseRecord && $warehouseRecord->unit ? $warehouseRecord->unit->name : 'unidad',
                ];
            }
            return null;
        })->filter()->values();

        return response()->json(['products' => $results], 200);
    }

    public function show($id)
    {
        $exit = ProductExit::with([
            'area' => fn($q) => $q->select('id', 'name'),
            'subarea' => fn($q) => $q->select('id', 'name'),
            'products.product' => fn($q) => $q->select('id', 'title'),
            'products.entry' => fn($q) => $q->with(['productEntry' => fn($q) => $q->select('id', 'invoice_number')]),
            'createdBy' => fn($q) => $q->select('id', 'name')
        ])->findOrFail($id);

        $exit->products->each(function ($product) use ($exit) {
            // Fetch the entry for this product
            $entry = EntryProduct::find($product->entry_id);
            
            // Calculate the remaining stock for this entry_id (specific to the invoice)
            $totalExited = ExitProduct::where('entry_id', $product->entry_id)
                ->where('product_exit_id', '!=', $product->product_exit_id)
                ->sum('quantity');
            $availableStock = $entry ? ($entry->quantity - $totalExited) : 0;

            // Fetch the global stock from ProductWarehouse
            $warehouseRecord = ProductWarehouse::where('product_id', $product->product_id)
                ->where('warehouse', $product->warehouse)
                ->first();
            $globalStock = $warehouseRecord ? $warehouseRecord->stock : 0;

            // Set stock and stock_global based on invoice_mode
            if ($exit->invoice_mode === 'multiple_invoices') {
                // In "Varias Facturas" mode, stock should be the total stock in the warehouse
                $product->stock = $globalStock;
                $product->stock_global = $globalStock;
                $product->original_quantity = $product->quantity; // Cantidad usada en la Salida
            } else {
                // In "Una Sola Factura" mode, stock should be the remaining stock in the entry
                $product->stock = $availableStock;
                $product->stock_global = $globalStock;
                $remainingQuantity = $entry ? ($entry->quantity - $product->quantity) : 0;
                $product->original_quantity = max(0, $remainingQuantity); // Ensure non-negative
            }

            // Ensure usedEntries is included
            $product->usedEntries = $product->usedEntries ?? [
                [
                    'entry_id' => $product->entry_id,
                    'quantity' => $product->quantity,
                    'invoice_number' => $product->invoice_number ?? 'N/A'
                ]
            ];

            $product->unit = $entry && $entry->unit ? $entry->unit->name : 'pieza';
        });

        Log::info("Datos de salida ID {$id} devueltos: " . json_encode($exit));
        return response()->json([
            'id' => $exit->id,
            'folio' => $exit->folio,
            'reference' => $exit->reference,
            'area' => $exit->area,
            'subarea' => $exit->subarea,
            'exit_date' => $exit->exit_date,
            'received_by' => $exit->received_by,
            'delivered_by' => $exit->delivered_by,
            'authorized_by' => $exit->authorized_by,
            'created_by' => $exit->createdBy,
            'exit_status' => $exit->exit_status,
            'pending_expires_at' => $exit->pending_expires_at,
            'invoice_mode' => $exit->invoice_mode,
            'single_invoice_number' => $exit->single_invoice_number,
            'products' => $exit->products,
        ]);
    }

    public function destroy($id)
    {
        try {
            return DB::transaction(function () use ($id) {
                $exit = ProductExit::findOrFail($id);

                // Siempre revertimos el stock, ya que todas las salidas son "completed"
                foreach ($exit->products as $item) {
                    $warehouse = ProductWarehouse::where('product_id', $item->product_id)
                        ->where('warehouse', $item->warehouse)
                        ->lockForUpdate()
                        ->first();
                    if ($warehouse) {
                        $warehouse->increment('stock', $item->quantity);
                        $warehouse->save();
                        Log::info("Stock restaurado: product_id {$item->product_id}, cantidad: {$item->quantity}");
                    }
                }
                if ($exit->pdf_path && Storage::disk('public')->exists($exit->pdf_path)) {
                    Storage::disk('public')->delete($exit->pdf_path);
                    Log::info("PDF eliminado: {$exit->pdf_path}");
                }



                // =============================================
                // 🔴 CANCELAR TRazABILIDAD DE ESTA SALIDA VEHICULOS
                // =============================================
                try {
                    /** @var RefactionTraceService $traceService */
                    $traceService = app(RefactionTraceService::class);
                    $traceService->deleteTraceByExit($exit->id);
                    Log::info("Trazabilidad eliminada para salida ID {$id} (destroy)");
                } catch (\Throwable $e) {
                    Log::error("Error al eliminar trazabilidad en destroy para salida ID {$id}: " . $e->getMessage());
                }


                $exit->products()->delete();
                $exit->delete();

                Log::info("Salida eliminada correctamente: ID {$id}");
                return response()->json(['message' => 'Salida eliminada correctamente'], 200);
            });
        } catch (Exception $e) {
            Log::error("Error al eliminar salida ID: {$id}: " . $e->getMessage());
            return response()->json(['message' => 'Error al eliminar salida: ' . $e->getMessage()], 500);
        }
    }

    public function searchAreas(Request $request)
    {
        $query = $request->input('query', '');
        $areas = Area::where('name', 'LIKE', "%{$query}%")
        ->with('subareas')
        ->get();
        
        return response()->json(['areas' => $areas], 200);
    }

    public function searchSubareas(Request $request)
    {
        $query = $request->input('query', '');
        $subareas = Subarea::where('name', 'LIKE', "%{$query}%")
        ->with('area')
        ->get();
        
        return response()->json(['subareas' => $subareas], 200);
    }

    public function storeGeneral(Request $request)
    {
        Log::info("Datos recibidos en storeGeneral: " . json_encode($request->all()));
        
        $validator = Validator::make($request->all(), [
            'area_id' => 'required|exists:areas,id',
            'subarea_id' => 'required|exists:subareas,id',
            'reference' => 'required|string|max:255|unique:product_exits,reference',
            'exit_date' => 'required|date',
            'received_by' => 'nullable|string|max:255',
            'delivered_by' => 'nullable|string|max:255',
            'authorized_by' => 'nullable|string|max:255',
            'products' => 'required|array|min:1',
            'products.*.product_id' => 'required|exists:products,id',
            'products.*.quantity' => 'required|integer|min:1',
            'products.*.entry_id' => 'required|exists:product_entries,id',
            'created_by' => 'nullable|exists:users,id',
            'exit_status' => 'required|in:pending,completed',
            'pending_expires_at' => 'required_if:exit_status,pending|nullable|date|after:now'
        ], [
            'exit_status.in' => 'El estado debe ser "pending" o "completed".',
            'pending_expires_at.required_if' => 'La fecha de caducidad es obligatoria para salidas pendientes.',
            'pending_expires_at.after' => 'La fecha de caducidad debe ser futura.'
        ]);
        
        if ($validator->fails()) {
            return response()->json(['message' => 'Error de validación', 'errors' => $validator->errors()->all()], 422);
        }
        
        try {
            foreach ($request->products as $productData) {
                $entry = EntryProduct::findOrFail($productData['entry_id']);
                $totalExited = ExitProduct::where('entry_id', $productData['entry_id'])->sum('quantity');
                $available = $entry->quantity - $totalExited;
                if ($available < $productData['quantity']) {
                    throw new Exception("Stock insuficiente en la entrada ID {$productData['entry_id']} para el producto ID {$productData['product_id']}.");
                }
            }

            $exit = DB::transaction(function () use ($request) {
                $pendingExpiresAt = null;
                if ($request->exit_status === 'pending' && $request->pending_expires_at) {
                    $dateTime = DateTime::createFromFormat('Y-m-d\TH:i', $request->pending_expires_at);
                    if ($dateTime === false) {
                        throw new Exception("Formato de fecha inválido para pending_expires_at: " . $request->pending_expires_at);
                    }
                    $pendingExpiresAt = $dateTime->format('Y-m-d H:i:s');
                }
                
                $exitData = [
                    'area_id' => $request->area_id,
                    'subarea_id' => $request->subarea_id,
                    'reference' => $request->reference,
                    'exit_date' => $request->exit_date,
                    'received_by' => $request->received_by,
                    'delivered_by' => $request->delivered_by ?? 'Usuario Desconocido',
                    'authorized_by' => $request->authorized_by,
                    'created_by' => $request->input('created_by', auth()->id()),
                    'exit_status' => $request->exit_status,
                    'pending_expires_at' => $pendingExpiresAt,
                    'pending_products' => null
                ];
                
                return ProductExit::create($exitData);
            });
            
            return response()->json([
                'message' => 'Salida general guardada correctamente. Por favor, confirme para guardar los productos.',
                'exit_id' => $exit->id,
                'pending_expires_at' => $exit->pending_expires_at
            ], 201);
        } catch (Exception $e) {
            Log::error("Error en storeGeneral: " . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    public function storeProducts(Request $request, $entryId)
    {
        $validator = Validator::make($request->all(), [
            'products' => 'required|array',
            'products.*.product_id' => 'required|exists:products,id',
            'products.*.quantity' => 'required|integer|gt:0',
            'products.*.unit_price' => 'required|numeric|gt:0',
            'products.*.item_code' => 'nullable|string',
            'products.*.partida' => 'nullable|integer',
        ], [
            'products.*.quantity.gt' => 'La cantidad debe ser mayor que 0.',
            'products.*.unit_price.gt' => 'El precio unitario debe ser mayor que 0.',
        ]);

        if ($validator->fails()) {
            $errors = $validator->errors();
            $firstError = $errors->first();
            Log::warning("Validación fallida en storeProducts: {$firstError}");
            return response()->json(['message' => $firstError], 422);
        }
        
        try {
            $entry = ProductEntry::findOrFail($entryId);
            
            DB::transaction(function () use ($request, $entry) {
                DB::table('entry_product')->where('entry_id', $entry->id)->delete();
                
                $productsData = collect($request->products)->map(function ($item) use ($entry) {
                    return [
                        'entry_id' => $entry->id,
                        'product_id' => $item['product_id'],
                        'quantity' => $item['quantity'],
                        'unit_price' => $item['unit_price'],
                        'item_code' => $item['item_code'] ?? null,
                        'partida' => $item['partida'] ?? null,
                        'invoice_number' => $item['invoice_number'] ?? $entry->invoice_number,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                })->all();
                
                DB::table('entry_product')->insert($productsData);
                
                foreach ($request->products as $productData) {
                    $warehouse = ProductWarehouse::firstOrCreate(
                        ['product_id' => $productData['product_id'], 'warehouse' => 'Central Aguamilpa'],
                        ['unit_id' => null, 'stock' => 0]
                    );
                    $warehouse->increment('stock', $productData['quantity']); // Incrementar stock en lugar de asignar directamente
                    Log::info("Stock incrementado en product_warehouse: product_id {$productData['product_id']}, quantity {$productData['quantity']}");
                }
            });
            return response()->json(['message' => 'Productos guardados'], 200);
        } catch (Exception $e) {
            Log::error('Error al guardar productos: ' . $e->getMessage());
            return response()->json(['message' => 'Error al guardar productos', 'error' => $e->getMessage()], 500);
        }
    }
    
    
    private function sanitizeFileName($string)
    {
        return preg_replace('/[^A-Za-z0-9-_]/', '-', strtoupper($string));
    }

    
     private function generateExitPdf($exitId)
    {
        try {
            Log::info("Iniciando generateExitPdf para salida ID: {$exitId}");
            // Obtener la instancia del modelo
            $exit = ProductExit::findOrFail($exitId);
            // Recargar la instancia para asegurar datos actualizados
            $exit = $exit->fresh([
                'area' => fn($q) => $q->select('id', 'name'),
                'subarea' => fn($q) => $q->select('id', 'name'),
                'products' => fn($query) => $query->with([
                    'product' => fn($q) => $q->select('id', 'title'),
                    'entry' => fn($q) => $q->with(['productEntry' => fn($q) => $q->select('id', 'invoice_number')])
                ]),
                'createdBy' => fn($q) => $q->select('id', 'name')
            ]);

            if ($exit->products->isEmpty()) {
                throw new Exception("No se pueden generar el PDF sin productos válidos");
            }

            // Generar lista de productos, una fila por factura
            $productList = $exit->products->map(function ($product) {
                return [
                    'product_id' => $product->product_id,
                    'product_title' => $product->product->title ?? 'N/A',
                    'quantity' => $product->quantity,
                    'invoice' => $product->invoice_number ?? 'N/A',
                    'warehouse' => $product->warehouse ?? 'Central Aguamilpa',
                    'entry_id' => $product->entry_id,
                    'unit' => $product->unit ?? 'Pieza'
                ];
            })->values()->toArray();

            // Obtener todas las entradas asociadas
            $entryIds = $exit->products->pluck('entry_id')->unique();
            $entries = EntryProduct::whereIn('id', $entryIds)
                ->with(['productEntry' => fn($q) => $q->select('id', 'invoice_number')])
                ->get()
                ->pluck('productEntry')
                ->filter()
                ->unique('id');

            if ($entries->isEmpty()) {
                throw new Exception("No se encontraron entradas válidas asociadas a los productos de la salida.");
            }

            // Generar el PDF
            $pdf = \PDF::loadView('pdf.product_exit', ['exit' => $exit, 'productList' => $productList]);
            $pdfContent = $pdf->output();

            // Procesar cada entrada para guardar una copia del PDF
            foreach ($entries as $entry) {
                $folderKey = $this->getOrCreateFolderKey($entry);
                $fileName = "salida_{$exit->id}_{$folderKey}.pdf";
                $subFolder = "purchasedocuments/{$folderKey}";
                $filePath = "{$subFolder}/{$fileName}";

                // Eliminar PDF anterior
                $existingDocument = PurchaseDocument::where('entry_id', $entry->id)
                    ->where('is_auto_pdf', true)
                    ->where('original_name', 'like', "salida_{$exit->id}_%")
                    ->first();
                if ($existingDocument) {
                    Storage::disk('public')->delete($existingDocument->file_path);
                    Log::info("Archivo PDF anterior eliminado para entrada ID {$entry->id}: {$existingDocument->file_path}");
                    DB::table('document_history')->insert([
                        'document_id' => $existingDocument->id,
                        'document_type' => 'purchase_document',
                        'action' => 'deleted',
                        'user_id' => auth()->id(),
                        'created_at' => now(),
                        'updated_at' => now()
                    ]);
                    $existingDocument->delete();
                }

                // Guardar copia del PDF
                Storage::disk('public')->makeDirectory($subFolder);
                Storage::disk('public')->put($filePath, $pdfContent);
                Log::info("PDF guardado para entrada ID {$entry->id}: {$filePath}");

                // Crear registro en PurchaseDocument
                $document = PurchaseDocument::create([
                    'entry_id' => $entry->id,
                    'file_path' => $filePath,
                    'file_type' => 'pdf',
                    'file_size' => strlen($pdfContent),
                    'original_name' => $fileName,
                    'is_auto_pdf' => true,
                    'folder_key' => $folderKey
                ]);

                // Registrar en document_history
                DB::table('document_history')->insert([
                    'document_id' => $document->id,
                    'document_type' => 'purchase_document',
                    'action' => 'created',
                    'user_id' => auth()->id(),
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }

            // Actualizar la salida
            $firstEntry = $entries->first();
            $firstFolderKey = $this->getOrCreateFolderKey($firstEntry);
            $firstFilePath = "purchasedocuments/{$firstFolderKey}/salida_{$exit->id}_{$firstFolderKey}.pdf";
            $exit->update(['pdf_path' => $firstFilePath, 'folder_key' => $firstFolderKey]);

            Log::info("PDF generado para salida ID: {$exitId}", [
                'entries' => $entries->pluck('id')->toArray(),
                'first_file_path' => $firstFilePath,
                'first_folder_key' => $firstFolderKey
            ]);

            return $firstFilePath;
        } catch (\Exception $e) {
            Log::error("Error al generar PDF para salida ID {$exitId}: " . $e->getMessage());
            throw new \Exception("Error al generar el PDF: " . $e->getMessage());
        }
    }


    


public function downloadExitPdf($id)
{
    try {
        // 1️⃣ Cargar la salida con todo lo necesario
        $exit = ProductExit::with([
            'area:id,name',
            'subarea:id,name',
            'products.product.unit',
            'createdBy:id,name',
        ])->findOrFail($id);

        // 2️⃣ Armar lista de productos para la vista
        $productList = $exit->products->map(function ($item) {
            return [
                'product_title' => $item->product->title,
                'unit'         => $item->product->unit?->name ?? 'Unidad',
                'quantity'     => $item->quantity,
                'invoice'      => $item->invoice_number ?? 'N/A',
            ];
        })->toArray();

        // 3️⃣ Generar el PDF con DomPDF
        // 🔴 IMPORTANTE: cambia 'pdf.product_exit'
        // por el nombre real de tu blade (por ejemplo: 'pdf.product_exit', 'pdf.exit', etc.)
        $pdf = Pdf::loadView('pdf.product_exit', [
            'exit'        => $exit,
            'productList' => $productList,
        ]);

        $folio    = $exit->folio ?? $exit->id;
        $filename = "vale_salida_{$folio}.pdf";

        // 4️⃣ Devolver el PDF directamente (sin envolver en JSON)
        return response()->streamDownload(
            function () use ($pdf) {
                echo $pdf->output();
            },
            $filename,
            [
                'Content-Type' => 'application/pdf',
            ]
        );

    } catch (\Exception $e) {
        Log::error("❌ Error generando PDF de salida ID {$id}: " . $e->getMessage());

        return response()->json([
            'message' => 'Error al generar el PDF de salida.',
        ], 500);
    }
}
    // funcion para pending y complete
    public function complete($id)
    {
        Log::info("Solicitud para completar salida ID {$id}");

        try {
            return DB::transaction(function () use ($id) {
                $exit = ProductExit::findOrFail($id);

                if ($exit->exit_status !== 'pending') {
                    throw new Exception("La salida ID {$id} no está en estado pendiente");
                }

                        // ← RESTAR STOCK SOLO AHORA
                foreach ($exit->products as $item) {
                    $warehouse = ProductWarehouse::where('product_id', $item->product_id)
                        ->where('warehouse', $item->warehouse)
                        ->lockForUpdate()
                        ->first();

                    if ($warehouse && $warehouse->stock >= $item->quantity) {
                        $warehouse->decrement('stock', $item->quantity);
                        Log::info("Stock restado al completar salida: producto {$item->product_id}, cantidad: {$item->quantity}");
                    } else {
                        throw new Exception("Stock insuficiente al completar salida para producto ID {$item->product_id}");
                    }
                }
                $exit->update([
                    'exit_status' => 'completed',
                    'pending_expires_at' => null,
                    'updated_by' => auth()->id()
                ]);

                Log::info("Salida ID {$id} completada");

                // Recargar salida para la respuesta
                $exit = ProductExit::with([
                    'area' => fn($q) => $q->select('id', 'name'),
                    'subarea' => fn($q) => $q->select('id', 'name'),
                    'products' => fn($query) => $query->with(['product' => fn($q) => $q->select('id', 'title')]),
                    'createdBy' => fn($q) => $q->select('id', 'name')
                ])->findOrFail($id);

                $exit->products->each(function ($product) {
                    $warehouseRecord = ProductWarehouse::where('product_id', $product->product_id)
                        ->where('warehouse', 'Central Aguamilpa')
                        ->first();
                    $product->stock = $warehouseRecord ? $warehouseRecord->stock : 0;
                });

                return response()->json([
                    'message' => 'Salida completada correctamente',
                    'exit_id' => $exit->id,
                    'folio' => $exit->folio,
                    'reference' => $exit->reference,
                    'area' => $exit->area,
                    'subarea' => $exit->subarea,
                    'exit_date' => $exit->exit_date,
                    'received_by' => $exit->received_by,
                    'delivered_by' => $exit->delivered_by,
                    'authorized_by' => $exit->authorized_by,
                    'created_by' => $exit->createdBy,
                    'exit_status' => $exit->exit_status,
                    'pending_expires_at' => $exit->pending_expires_at,
                    'products' => $exit->products,
                ], 200);
            });
        } catch (Exception $e) {
            Log::error("Error al completar salida ID {$id}: " . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    //NUEVAS FUNCIONES PARA QUE GRABE EN LA CARPETA DE ENTRADA LOS PDF DE
  private function getOrCreateFolderKey($exit)
    {
        $entry = ProductEntry::where('invoice_number', $exit->invoice_number)->first();
        if ($entry) {
            $existingDocument = PurchaseDocument::where('entry_id', $entry->id)->first();
            if ($existingDocument) {
                return $existingDocument->folder_key;
            }
        }
        $sanitizedInvoice = preg_replace('/[^A-Za-z0-9-_]/', '-', strtoupper($exit->invoice_number));
        $randomKey = Str::random(5);
        $date = now()->format('Ymd');
        return "{$sanitizedInvoice}_{$date}_{$randomKey}";
    }

    //buscar por facturas para salida de productos de una sola factura
    public function searchInvoices(Request $request)
    {
        try {
            $query = $request->input('query', '');
            $invoices = ProductEntry::where('invoice_number', 'LIKE', "%{$query}%")
                ->distinct()
                ->pluck('invoice_number')
                ->filter()
                ->values();
            Log::info("Facturas encontradas para query '{$query}': " . json_encode($invoices));
            return response()->json(['invoices' => $invoices], 200);
        } catch (Exception $e) {
            Log::error("Error al buscar facturas: " . $e->getMessage());
            return response()->json(['message' => 'Error al buscar facturas', 'error' => $e->getMessage()], 500);
        }
    }

    //traer todos los productos de una sola factura
    public function searchProductsByInvoice(Request $request)
    {
        try {
            $invoiceNumber = $request->input('invoice_number', '');
            Log::info("Parámetro invoice_number recibido: '{$invoiceNumber}'");
            if (empty($invoiceNumber)) {
                Log::warning("Número de factura vacío o no proporcionado");
                return response()->json(['message' => 'El número de factura es requerido'], 422);
            }

            // Buscar todas las entradas asociadas al invoice_number
            $productEntries = ProductEntry::where('invoice_number', $invoiceNumber)->pluck('id');
            $entries = EntryProduct::whereIn('entry_id', $productEntries)
                ->with(['product' => fn($q) => $q->select('id', 'title', 'sku')])
                ->get();

            $results = $entries->map(function ($entry) {
                $product = $entry->product;
                if (!$product) {
                    return null;
                }

                $warehouseRecord = ProductWarehouse::where('product_id', $product->id)
                    ->where('warehouse', 'Central Aguamilpa')
                    ->with(['unit' => fn($q) => $q->select('id', 'name')])
                    ->first();

                $stock = $warehouseRecord ? $warehouseRecord->stock : 0;

                if ($stock > 0) {
                    $totalExited = ExitProduct::where('entry_id', $entry->id)->sum('quantity');
                    $available = $entry->quantity - $totalExited;

                    Log::info("Producto ID {$product->id} (Factura: {$entry->productEntry->invoice_number}): quantity={$entry->quantity}, totalExited={$totalExited}, available={$available}, stockGlobal={$stock}");
                    
                    if ($available > 0) {
                        return [
                            'product_id' => $product->id,
                            'title' => $product->title,
                            'sku' => $product->sku,
                            'stock' => $available, //stock disponible para la factura
                            'stock_global'=>$stock, //stock global almacen
                            'invoice_number' => $entry->productEntry->invoice_number ?? 'N/A',
                            'entry_id' => $entry->id,
                            'unit' => $warehouseRecord && $warehouseRecord->unit ? $warehouseRecord->unit->name : 'unidad',
                        ];
                    }
                }
                return null;
            })->filter()->values();

            return response()->json(['products' => $results], 200);
        } catch (Exception $e) {
            Log::error("Error al buscar productos por factura: " . $e->getMessage());
            return response()->json(['message' => 'Error al buscar productos por factura', 'error' => $e->getMessage()], 500);
        }
    }


    public function getProductEntries($productId)
    {
        try {
            Log::info("Obteniendo entradas para producto ID: {$productId}");

            // Verificar stock en ProductWarehouse
            $warehouseRecord = ProductWarehouse::where('product_id', $productId)
                ->where('warehouse', 'Central Aguamilpa')
                ->first();

            if (!$warehouseRecord || $warehouseRecord->stock <= 0) {
                Log::info("No hay stock disponible en ProductWarehouse para producto ID {$productId}");
                return response()->json(['entries' => []], 200);
            }

            $entries = EntryProduct::where('product_id', $productId)
                ->with(['productEntry' => fn($q) => $q->select('id', 'invoice_number')])
                ->orderBy('created_at', 'asc') // Ordenar por created_at ASC para FIFO
                ->get()
                ->map(function ($entry) use ($warehouseRecord) {
                    $totalExited = ExitProduct::where('entry_id', $entry->id)->sum('quantity');
                    $available = min($entry->quantity - $totalExited, $warehouseRecord->stock);

                    if ($available > 0) {
                        return [
                            'entry_id' => $entry->id,
                            'invoice_number' => $entry->productEntry ? $entry->productEntry->invoice_number : 'N/A',
                            'available' => $available,
                            'created_at' => $entry->created_at->toDateTimeString()
                        ];
                    }
                    return null;
                })
                ->filter()
                ->values();

            Log::info("Entradas encontradas para producto ID {$productId}: " . json_encode($entries));

            return response()->json(['entries' => $entries], 200);
        } catch (Exception $e) {
            Log::error("Error al obtener entradas para producto ID {$productId}: " . $e->getMessage());
            return response()->json(['message' => 'Error al obtener entradas', 'error' => $e->getMessage()], 500);
        }
    }

    public function checkLowStockalto(Request $request)
    {
        $request->validate([
            'product_ids' => 'required|array',
            'product_ids.*' => 'integer|exists:products,id'
        ]);

        $productIds = $request->product_ids;
        $results = [];

        foreach ($productIds as $productId) {
            $product = Product::find($productId);
            if (!$product) {
                $results[] = [
                    'product_id' => $productId,
                    'title' => 'Producto no encontrado',
                    'stock' => 0,
                    'umbral' => 0,
                    'is_low' => true
                ];
                continue;
            }

            // Stock en almacén Central Aguamilpa
            $warehouseRecord = ProductWarehouse::where('product_id', $productId)
                ->where('warehouse', 'Central Aguamilpa')
                ->first();

            $stock = $warehouseRecord ? $warehouseRecord->stock : 0;
            $umbral = $product->umbral ?? 10;
            $isLow = $stock <= $umbral;

            $results[] = [
                'product_id' => $product->id,
                'title' => $product->title,
                'stock' => $stock,
                'umbral' => $umbral,
                'is_low' => $isLow
            ];
        }

        // DEVOLVER TODOS LOS PRODUCTOS (no solo los bajos)
        return response()->json($results);
    }



}

/*
    public function downloadExitPdf($id)
    {
        try {
            Log::info("Iniciando downloadExitPdf para salida ID: {$id}");
            $exit = ProductExit::findOrFail($id);
            $filePath = storage_path('app/public/' . $exit->pdf_path);

            if (!file_exists($filePath)) {
                Log::info("PDF no existe, regenerando para salida ID {$id}");
                $newFilePath = $this->generateExitPdf($id);
                $filePath = storage_path('app/public/' . $newFilePath);
            }

            DB::table('document_history')->insert([
                'document_id' => $id,
                'document_type' => 'product_exit',
                'action' => 'downloaded',
                'user_id' => auth()->id(),
                'created_at' => now(),
                'updated_at' => now()
            ]);

            Log::info("Descargando PDF para salida ID {$id}: {$filePath}");
            return response()->download($filePath, "vale_salida_{$id}.pdf");
        } catch (Exception $e) {
            Log::error("Error al descargar PDF de salida ID: {$id}: " . $e->getMessage());
            return response()->json(['message' => 'Error al descargar PDF', 'error' => $e->getMessage()], 404);
        }
    }
*/
/* modificado sin used_entries
    public function store(Request $request)
    {
        Log::info("Datos recibidos en store: " . json_encode($request->all()));

        $validator = Validator::make($request->all(), [
            'area_id' => 'required|integer|exists:areas,id',
            'subarea_id' => 'required|integer|exists:subareas,id',
            'reference' => 'required|string|max:60',
            'exit_date' => 'required|date',
            'received_by' => 'nullable|string|max:255',
            'delivered_by' => 'required|string|max:255',
            'authorized_by' => 'nullable|string|max:255',
            'products' => 'required|array|min:1',
            'products.*.product_id' => 'required|exists:products,id',
            'products.*.quantity' => 'required|integer|min:1',
            'products.*.warehouse' => 'required|string|max:255',
            'products.*.usedEntries' => 'nullable|array',
            'products.*.usedEntries.*.entry_id' => 'required|exists:entry_product,id',
            'products.*.usedEntries.*.quantity' => 'required|integer|min:1',
            'products.*.usedEntries.*.invoice_number' => 'nullable|string|max:255',
            'exit_status' => 'required|in:pending,completed',
            'pending_expires_at' => 'required_if:exit_status,pending|nullable|date',
            'invoice_mode' => 'required|in:multiple_invoices,single_invoice',
            'single_invoice_number' => 'required_if:invoice_mode,single_invoice|nullable|string|max:255'
        ], [
            'exit_status.in' => 'El estado debe ser "pending" o "completed".',
            'pending_expires_at.required_if' => 'La fecha de caducidad es obligatoria para salidas pendientes.',
            'pending_expires_at.date' => 'La fecha de caducidad debe ser una fecha válida.'
        ]);

        if ($validator->fails()) {
            Log::warning("Validación fallida: " . json_encode($validator->errors()->all()));
            return response()->json(['message' => 'Error de validación', 'errors' => $validator->errors()->all()], 422);
        }

        try {
            return DB::transaction(function () use ($request) {
                $lastExit = ProductExit::orderBy('id', 'desc')->first();
                $nextId = $lastExit ? $lastExit->id + 1 : 1;
                $folio = 'EXIT-' . str_pad($nextId, 6, '0', STR_PAD_LEFT);
                Log::info("Generando folio para nueva salida: {$folio}, nextId: {$nextId}");

                $pendingExpiresAt = null;
                if ($request->exit_status === 'pending' && $request->pending_expires_at) {
                    $dateTime = \Carbon\Carbon::parse($request->pending_expires_at, 'America/Mazatlan');
                    $now = \Carbon\Carbon::now('America/Mazatlan');
                    $minFutureTime = $now->copy()->addMinutes(5);
                    if ($dateTime->lessThanOrEqualTo($minFutureTime)) {
                        Log::warning("Fecha de caducidad no futura: {$request->pending_expires_at}, debe ser posterior a {$minFutureTime}");
                        return response()->json([
                            'message' => 'Error de validación',
                            'errors' => ['La fecha de caducidad debe ser al menos 5 minutos en el futuro.']
                        ], 422);
                    }
                    $pendingExpiresAt = $dateTime->setTimezone('UTC')->format('Y-m-d H:i:s');
                }

                $exitData = [
                    'area_id' => $request->area_id,
                    'subarea_id' => $request->subarea_id,
                    'folio' => $folio,
                    'reference' => $request->reference,
                    'exit_date' => $request->exit_date,
                    'received_by' => $request->received_by ?? 'Pendiente',
                    'delivered_by' => $request->delivered_by,
                    'authorized_by' => $request->authorized_by ?? 'Pendiente',
                    'created_by' => auth()->id(),
                    'exit_status' => $request->exit_status ?? 'completed',
                    'pending_expires_at' => $pendingExpiresAt,
                    'pending_products' => null,
                    'invoice_mode' => $request->invoice_mode,
                    'single_invoice_number' => $request->single_invoice_number
                ];

                $exit = ProductExit::create($exitData);
                Log::info("Salida creada con folio: {$folio}, reference: {$exit->reference}, estado: {$exit->exit_status}, expira: {$exit->pending_expires_at}");

                $exitProductsData = [];
                foreach ($request->products as $productData) {
                    $productId = $productData['product_id'];
                    $quantityRequested = $productData['quantity'];
                    $warehouse = $productData['warehouse'];

                    // Verificar stock en el almacén
                    $warehouseRecord = ProductWarehouse::where('product_id', $productId)
                        ->where('warehouse', $warehouse)
                        ->lockForUpdate()
                        ->first();

                    if (!$warehouseRecord || $warehouseRecord->stock < $quantityRequested) {
                        throw new Exception("Stock insuficiente en almacén {$warehouse} para producto ID {$productId}. Stock disponible: " . ($warehouseRecord ? $warehouseRecord->stock : 0));
                    }

                    $warehouseRecord->decrement('stock', $quantityRequested);
                    Log::info("Stock actualizado para producto ID {$productId} en almacén {$warehouse}: -{$quantityRequested}");
                   
                    if ($request->invoice_mode === 'multiple_invoices') {
                        // Procesar usedEntries
                        foreach ($productData['usedEntries'] as $entryData) {
                            $entryId = $entryData['entry_id'];
                            $entryQuantity = $entryData['quantity'];
                            $invoiceNumber = $entryData['invoice_number'] ?? 'N/A';

                            // Verificar la entrada específica y su relación con el producto
                            $entry = EntryProduct::where('id', $entryId)
                                ->where('product_id', $productId)
                                ->first();
                            if (!$entry) {
                                throw new Exception("Entrada con ID {$entryId} no encontrada o no corresponde al producto ID {$productId}.");
                            }

                            // Verificar cantidad disponible en la entrada
                            $totalExited = ExitProduct::where('entry_id', $entryId)->sum('quantity');
                            $available = $entry->quantity - $totalExited;

                            if ($available < $entryQuantity) {
                                throw new Exception("Cantidad insuficiente en entrada ID {$entryId} para producto ID {$productId}. Disponible: {$available}, Solicitado: {$entryQuantity}.");
                            }

                            // Agregar datos para exit_products
                            $exitProductsData[] = [
                                'product_exit_id' => $exit->id,
                                'product_id' => $productId,
                                'quantity' => $entryQuantity,
                                'warehouse' => $warehouse,
                                'invoice_number' => $invoiceNumber,
                                'entry_id' => $entryId,
                                'created_at' => now(),
                                'updated_at' => now(),
                            ];
                        }
                    } else {
                        // Modo single_invoice
                        $entryId = $productData['entry_id'];
                        $invoiceNumber = $productData['invoice_number'] ?? 'N/A';

                        // Verificar la entrada específica
                        $entry = EntryProduct::where('id', $entryId)
                            ->where('product_id', $productId)
                            ->first();
                        if (!$entry) {
                            throw new Exception("Entrada con ID {$entryId} no encontrada o no corresponde al producto ID {$productId}.");
                        }

                        // Verificar cantidad disponible en la entrada
                        $totalExited = ExitProduct::where('entry_id', $entryId)->sum('quantity');
                        $available = $entry->quantity - $totalExited;

                        if ($available < $quantityRequested) {
                            throw new Exception("Cantidad insuficiente en entrada ID {$entryId} para producto ID {$productId}. Disponible: {$available}, Solicitado: {$quantityRequested}.");
                        }

                        // Agregar datos para exit_products
                        $exitProductsData[] = [
                            'product_exit_id' => $exit->id,
                            'product_id' => $productId,
                            'quantity' => $quantityRequested,
                            'warehouse' => $warehouse,
                            'invoice_number' => $invoiceNumber,
                            'entry_id' => $entryId,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    }

                    // Cambiar la llamada a checkLowStock por verifyLowStock
                    $this->verifyLowStock($productId, $warehouse);
                }

                // Insertar productos en exit_products
                if (!empty($exitProductsData)) {
                    DB::table('exit_products')->insert($exitProductsData);
                    Log::info("Productos insertados en exit_products: " . json_encode($exitProductsData));
                } else {
                    Log::warning("No se insertaron productos en exit_products porque exitProductsData está vacío.");
                }

                // Recargar la salida
                $exit = ProductExit::with([
                    'area' => fn($q) => $q->select('id', 'name'),
                    'subarea' => fn($q) => $q->select('id', 'name'),
                    'products' => fn($query) => $query->with(['product', 'entry'])
                ])->findOrFail($exit->id);

                // Generar PDF
                $this->generateExitPdf($exit->id);

                return response()->json([
                    'message' => 'Salida registrada correctamente',
                    'exit_id' => $exit->id,
                    'folio' => $folio,
                    'reference' => $exit->reference,
                    'pending_expires_at' => $exit->pending_expires_at,
                    'single_invoice_number' => $exit->single_invoice_number
                ], 201);
            });
        } catch (Exception $e) {
            Log::error("Error al registrar salida: " . $e->getMessage());
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }
*/
/*


    public function checkLowStock()
    {
        Log::info("Iniciando verificación de stock bajo para productos");

        try {
            $lowStockProducts = [];
            $products = Product::whereNotNull('umbral')->where('umbral', '>', 0)->get();

            foreach ($products as $product) {
                $warehouseRecord = ProductWarehouse::where('product_id', $product->id)
                    ->where('warehouse', 'Central Aguamilpa')
                    ->first();

                $stock = $warehouseRecord ? $warehouseRecord->stock : 0;        

                if ($stock < $product->umbral) {
                    $lowStockProducts[] = [
                        'product_id' => $product->id,
                        'current_stock' => $stock,
                        'threshold' => $product->umbral
                    ];
                }
            }

            if (!empty($lowStockProducts)) {
                Log::warning("Productos con stock bajo detectados: " . json_encode($lowStockProducts));
            }

            return response()->json(['low_stock_products' => $lowStockProducts], 200);
        } catch (\Exception $e) {
            Log::error("Error al verificar stock bajo: " . $e->getMessage());
            return response()->json(['message' => 'Error al verificar stock bajo'], 500);
        }
    }
        */