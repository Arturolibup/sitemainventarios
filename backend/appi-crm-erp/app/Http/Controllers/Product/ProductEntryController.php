<?php

namespace App\Http\Controllers\Product;

use Exception;
use Illuminate\Http\Request;
use App\Models\Product\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\Controller;
use App\Models\Product\EntryProduct;
use App\Models\Product\ProductEntry;
use App\Models\Product\EntryEvidence;
use App\Models\Configuration\Provider;
use Illuminate\Support\Facades\Storage;
use App\Models\Product\ProductWarehouse;
use App\Models\Product\PurchaseDocument;
use Illuminate\Support\Facades\Validator;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Str;

class ProductEntryController extends Controller
{
    public function __construct()
    {
    $this->middleware('auth:api');
    $this->middleware('permission:product_entries.list')->only(['index']);
    $this->middleware('permission:product_entries.view')->only(['show']);
    $this->middleware('permission:product_entries.create')->only(['store']);
    $this->middleware('permission:product_entries.update')->only(['update']);
    $this->middleware('permission:product_entries.delete')->only(['destroy']);
    }


    public function create() {
        $providers = Provider::select('id', 'full_name')->get();
        $products = Product::select('id', 'title')->get();
        return response()->json(compact('providers', 'products'));
    }

    public function searchProviders(Request $request) {
        $query = $request->input('query');
        $providers = Provider::where('full_name', 'like', "%$query%")
            ->select('id', 'full_name')
            ->get();
        return response()->json($providers);
    }

    public function searchProducts(Request $request)
    {
        $query = $request->input('query', '');
        $products = Product::where('title', 'LIKE', "%{$query}%")
            ->orWhere('sku', 'LIKE', "%{$query}%")
            ->select('id', 'title')
            ->get();

        $results = $products->map(function ($product) {
            // Obtener todos los almacenes para este producto
            $warehouses = ProductWarehouse::where('product_id', $product->id)->get();

            if ($warehouses->isEmpty()) {
                return null; // No hay stock en ningún almacén
            }

            $stockByWarehouse = $warehouses->mapWithKeys(function ($warehouse) {
                return [$warehouse->warehouse => $warehouse->stock];
            })->all();

            // Por ahora, usamos Central Aguamilpa como predeterminado si existe
            $defaultWarehouse = 'Central Aguamilpa';
            $stock = $stockByWarehouse[$defaultWarehouse] ?? 0;

            if ($stock > 0 || count($stockByWarehouse) > 0) {
                return [
                    'id' => $product->id,
                    'title' => $product->title,
                    'stock' => $stock, // Stock en Central Aguamilpa
                    'warehouses' => $stockByWarehouse // Todos los almacenes disponibles
                ];
            }
            return null;
        })->filter()->values();

        return response()->json($results);
    }

    public function storeGeneral(Request $request)
    {
        // Propósito: Guarda los datos generales de una entrada y devuelve el entry_id.
        $validator = Validator::make($request->all(), [
            'provider_id' => 'required|exists:providers,id',
            'resource_origin' => 'required|string',
            'federal_program' => 'nullable|string',
            'invoice_number' => 'required|string|max:255|unique:product_entries,invoice_number',
            'order_number' => 'required|string|max:255|unique:product_entries,order_number',
            'process' => 'required|string',
            'partida' => 'nullable|integer',
            'entry_date' => 'required|date',
            'subtotal' => 'required|numeric',
            'iva' => 'required|numeric',
            'total' => 'required|numeric',
            'created_by' => 'nullable|exists:users,id', // Añadido para auditoría
            'entry_status' => 'nullable|string|in:pending,completed' // Añadido para estadísticas
        ], [
            "invoice_number.unique" => 'El número de factura ya existe',
            "order_number.unique" => 'El número de orden ya existe',
            "provider_id.required" => 'El proveedor es obligatorio',
            "resource_origin.required" => 'El origen del recurso es obligatorio',
            "invoice_number.required" => 'El número de factura es obligatorio',
            "order_number.required" => 'El número de orden es obligatorio',
            "process.required" => 'El proceso es obligatorio',
            "entry_date.required" => 'La fecha de entrada es obligatoria',
            "subtotal.required" => 'El subtotal es obligatorio',
            "iva.required" => 'El IVA es obligatorio',
            "total.required" => 'El total es obligatorio',
        ]);

        if ($validator->fails()) {
            $errors = $validator->errors();
            Log::warning("Validación fallida: " . json_encode($errors->all()));
            $message = $errors->first('invoice_number') ?: $errors->first('order_number');
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $errors->all()
            ], 422);
        }

        // Modificación: Añadí created_by y entry_status al crear la entrada
        $entry = ProductEntry::create(array_merge(
            $request->only([
                'provider_id', 'resource_origin', 'federal_program', 'invoice_number',
                'order_number', 'process', 'partida', 'entry_date', 'subtotal', 'iva', 'total'
            ]),
            [
                'created_by' => $request->input('created_by', auth()->id()), // Auditoría: usuario autenticado
                'entry_status' => $request->input('entry_status', 'pending') // Estadísticas: estado inicial
            ]
        ));

        return response()->json(['entry_id' => $entry->id, 'message' => 'Entrada guardada'], 201);
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
            'products.*.invoice_number' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first()], 422);
        }

        try {
            $entry = ProductEntry::findOrFail($entryId);

            DB::transaction(function () use ($request, $entry) {
                // Borra productos anteriores (si hay)
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

                // === STOCK: SIEMPRE SUMA (ES NUEVA ENTRADA) ===
                foreach ($request->products as $productData) {
                    $warehouse = ProductWarehouse::firstOrCreate(
                        ['product_id' => $productData['product_id'], 'warehouse' => 'Central Aguamilpa'],
                        ['unit_id' => null, 'stock' => 0]
                    );

                    $warehouse->increment('stock', $productData['quantity']);
                    Log::info("Stock aumentado +{$productData['quantity']} (producto {$productData['product_id']})");
                }
            });

            return response()->json(['message' => 'Productos guardados'], 200);
        } catch (\Exception $e) {
            Log::error('Error al guardar productos: ' . $e->getMessage());
            return response()->json(['message' => 'Error', 'error' => $e->getMessage()], 500);
        }
    }


    private function sanitizeFileName($string)
        {
            return preg_replace('/[^A-Za-z0-9-_]/', '-', strtoupper($string));
        }

        
    public function store(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'entry_id' => 'required|exists:product_entries,id',
                'file' => 'required|mimes:pdf,jpg,jpeg,png,xml|max:51200',
            ]);

            if ($validator->fails()) {
                Log::warning("Validación fallida: " . json_encode($validator->errors()->all()));
                return response()->json(['message' => 'Validation failed', 'errors' => $validator->errors()->all()], 422);
            }

            $file = $request->file('file');
            $entry = ProductEntry::findOrFail($request->entry_id);
            $folderKey = $this->getOrCreateFolderKey($entry);
            $fileName = "doc_{$folderKey}_{$file->getClientOriginalName()}";
            $subFolder = "purchasedocuments/{$folderKey}";
            $filePath = "{$subFolder}/{$fileName}";

            Storage::disk('public')->makeDirectory($subFolder);
            Storage::disk('public')->put($filePath, file_get_contents($file));

            $document = PurchaseDocument::create([
                'entry_id' => $request->entry_id,
                'file_path' => $filePath,
                'file_type' => $file->getClientMimeType(),
                'file_size' => $file->getSize(),
                'original_name' => $file->getClientOriginalName(),
                'is_auto_pdf' => false,
                'folder_key' => $folderKey
            ]);

            DB::table('document_history')->insert([
                'document_id' => $document->id,
                'document_type' => 'purchase_document',
                'action' => 'created',
                'user_id' => auth()->id(),
                'created_at' => now(),
                'updated_at' => now()
            ]);

            Log::info("Documento oficial subido", [
                'document_id' => $document->id,
                'file_path' => $filePath,
                'folder_key' => $folderKey
            ]);

            return response()->json(['message' => 'Documento subido exitosamente', 'document_id' => $document->id], 201);
        } catch (\Exception $e) {
            Log::error('Error al subir documento: ' . $e->getMessage());
            return response()->json(['message' => 'Error al subir documento', 'error' => $e->getMessage()], 500);
        }
    }

   private function numberToWords($number)
    {
        $units = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
        $tens = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
        $teens = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
        $hundreds = ['', 'CIEN', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SIETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
        $thousands = ['', 'MIL', 'MILLÓN', 'MILLONES'];

        $integerPart = floor($number);
        $decimalPart = round(($number - $integerPart) * 100);

        $words = '';

        if ($integerPart == 0) {
            $words = 'CERO';
        } else {
            // Millones
            $millions = floor($integerPart / 1000000);
            $remainder = $integerPart % 1000000;
            if ($millions > 0) {
                $words .= $millions == 1 ? 'UN MILLÓN' : ($this->convertLessThanThousand($millions, $units, $tens, $teens, $hundreds) . ' MILLONES');
            }

            // Miles
            $thousandsCount = floor($remainder / 1000);
            $remainder = $remainder % 1000;
            if ($thousandsCount > 0) {
                $words .= ($words ? ' ' : '') . ($thousandsCount == 1 ? 'MIL' : ($this->convertLessThanThousand($thousandsCount, $units, $tens, $teens, $hundreds) . ' MIL'));
            }

            // Cientos, decenas, unidades
            if ($remainder > 0) {
                $words .= ($words ? ' ' : '') . $this->convertLessThanThousand($remainder, $units, $tens, $teens, $hundreds);
            }
        }

        $words = strtoupper($words);

        // Centavos
        if ($decimalPart > 0) {
            $decimalWords = $this->convertLessThanThousand($decimalPart, $units, $tens, $teens, $hundreds);
            return ($words ? $words : 'CERO') . ' PESOS CON ' . strtoupper($decimalWords) . ' CENTAVOS';
        }

        return ($words ? $words : 'CERO') . ' PESOS';
    }

    private function convertLessThanThousand($number, $units, $tens, $teens, $hundreds)
    {
        $words = '';

        if ($number == 100) {
            $words = 'CIEN';
        } elseif ($number > 100) {
            $hundred = floor($number / 100);
            $words = $hundreds[$hundred];
            $number %= 100;
        }

        if ($number >= 10 && $number < 20) {
            $words .= ($words ? ' ' : '') . $teens[$number - 10];
        } elseif ($number > 0) {
            $ten = floor($number / 10);
            $unit = $number % 10;
            $words .= ($words ? ' ' : '') . ($ten > 0 ? $tens[$ten] . ($unit > 0 ? ' Y ' : '') : '') . $units[$unit];
        }

        return $words;
    }

    

    private function getOrCreateFolderKey($entry)
    {
        $existingDocument = PurchaseDocument::where('entry_id', $entry->id)->first();
        if ($existingDocument) {
            return $existingDocument->folder_key;
        }
        $sanitizedInvoice = $this->sanitizeFileName($entry->invoice_number);
        $randomKey = Str::random(5);
        $date = now()->format('Ymd');
        return "{$sanitizedInvoice}_{$date}_{$randomKey}";
    }

   
    public function saveEvidences(Request $request, $entryId)
    {
        try {
            Log::info("Iniciando saveEvidences para entryId: {$entryId}");
            $entry = ProductEntry::findOrFail($entryId);
            Log::info("Entrada encontrada: {$entry->id}");

            // Eliminar evidencias existentes
            $existingEvidences = EntryEvidence::where('entry_id', $entry->id)->get();
            foreach ($existingEvidences as $evidence) {
                Storage::disk('public')->delete($evidence->file_path);
                Log::info("Archivo físico eliminado: {$evidence->file_path}");
                $evidence->delete();
                Log::info("Evidencia eliminada: {$evidence->id}");
            }

            if (!$request->hasFile('evidences') || empty($request->file('evidences'))) {
                Log::warning("No se enviaron archivos nuevos en la petición");
                return response()->json(['message' => 'No se enviaron archivos nuevos'], 400);
            }

            $files = $request->file('evidences');
            Log::info("Número de archivos recibidos: " . count($files));

            foreach ($files as $file) {
                if (!$file->isValid()) {
                    Log::warning("Archivo inválido: {$file->getClientOriginalName()}");
                    return response()->json(['message' => 'Archivo inválido: ' . $file->getClientOriginalName()], 400);
                }

                $fileName = $file->getClientOriginalName();
                $fileSize = $file->getSize();
                Log::info("Procesando archivo: nombre={$fileName}, tamaño={$fileSize}");

                $duplicate = EntryEvidence::where('original_name', $fileName)
                                        ->where('file_size', $fileSize)
                                        ->first();
                if ($duplicate) {
                    Log::warning("Imagen duplicada detectada: {$fileName}, ID existente: {$duplicate->id}");
                    return response()->json([
                        'message' => "La imagen '{$fileName}' ya ha sido subida anteriormente."
                    ], 422);
                }

                $path = Storage::putFile('evidenciaproductos', $file);
                Log::info("Archivo guardado en: {$path}");

                $evidence = EntryEvidence::create([
                    'entry_id' => $entry->id,
                    'file_path' => $path,
                    'file_type' => $file->getClientOriginalExtension(),
                    'file_size' => $fileSize,
                    'original_name' => $fileName,
                ]);
                Log::info("Registro creado para archivo: {$fileName}, ID: {$evidence->id}");
            }

            Log::info("Evidencias procesadas correctamente");
            return response()->json(['message' => 'Evidencias guardadas correctamente']);
        } catch (Exception $e) {
            Log::error('Error al guardar evidencias: ' . $e->getMessage() . "\nStack trace: " . $e->getTraceAsString());
            return response()->json(['message' => 'Error al guardar evidencias', 'error' => $e->getMessage()], 500);
        }
    }
                

    public function updateEvidences(Request $request, $entryId, $deleteExisting = false)
    {
        try {
            Log::info("Iniciando saveEvidences para entryId: {$entryId}, deleteExisting: " . ($deleteExisting ? 'true' : 'false'));
            $entry = ProductEntry::findOrFail($entryId);
            Log::info("Entrada encontrada: {$entry->id}");

            if ($deleteExisting) {
                $existingEvidences = EntryEvidence::where('entry_id', $entry->id)->get();
                foreach ($existingEvidences as $evidence) {
                    Storage::disk('public')->delete($evidence->file_path);
                    Log::info("Archivo físico eliminado: {$evidence->file_path}");
                    $evidence->delete();
                    Log::info("Evidencia eliminada: {$evidence->id}");
                }
            }

            if (!$request->hasFile('evidences')) {
                Log::warning("No se enviaron archivos en la petición");
                return response()->json(['message' => 'No se enviaron archivos'], 400);
            }

            $files = $request->file('evidences');
            Log::info("Número de archivos recibidos: " . count($files));

            foreach ($files as $file) {
                if (!$file->isValid()) {
                    Log::warning("Archivo inválido: {$file->getClientOriginalName()}");
                    return response()->json(['message' => 'Archivo inválido: ' . $file->getClientOriginalName()], 400);
                }

                $path = Storage::putFile('evidenciaproductos', $file);
                Log::info("Archivo guardado en: {$path}");

                EntryEvidence::create([
                    'entry_id' => $entry->id,
                    'file_path' => $path,
                    'file_type' => $file->getClientOriginalExtension(),
                    'file_size' => $file->getSize(),
                    'original_name' => $file->getClientOriginalName(),
                ]);
                Log::info("Registro creado para archivo: {$file->getClientOriginalName()}");
            }

            Log::info("Evidencias procesadas correctamente");
            return response()->json(['message' => 'Evidencias guardadas correctamente']);
        } catch (\Exception $e) {
            Log::error('Error al guardar evidencias: ' . $e->getMessage() . "\nStack trace: " . $e->getTraceAsString());
            return response()->json(['message' => 'Error al guardar evidencias', 'error' => $e->getMessage()], 500);
        }
    }
    

    public function getEvidenceFile($id)
    {
        $evidence = EntryEvidence::findOrFail($id);
        $filePath = storage_path('app/public/' . $evidence->file_path);

        if (!file_exists($filePath)) {
            return response()->json(['message' => 'Archivo no encontrado'], 404);
        }

        return response()->file($filePath);
    }
    

    //sugerencia para destroy con la nueva relacion. 
    public function destroy($id)
    {
        try {
            $entry = ProductEntry::findOrFail($id);

            DB::transaction(function () use ($entry) {
                // Revertir el stock de los productos
                foreach ($entry->products as $item) {
                    $warehouse = ProductWarehouse::where('product_id', $item->product_id)
                        ->where('warehouse', 'Central Aguamilpa')
                        ->first();
                    if ($warehouse) {
                        $warehouse->stock -= $item->quantity;
                        if ($warehouse->stock < 0) {
                            $warehouse->stock = 0;
                        }
                        $warehouse->save();
                        Log::info("Stock revertido: product_id {$item->product_id}, cantidad restada: {$item->quantity}");
                    }
                }

                // Eliminar evidencias asociadas
                foreach ($entry->evidences as $evidence) {
                    Storage::disk('public')->delete($evidence->file_path);
                    $evidence->delete();
                }

                // Eliminar documentos de compra asociados
                $documents = PurchaseDocument::where('entry_id', $entry->id)->get();
                foreach ($documents as $document) {
                    Storage::disk('public')->delete($document->file_path);
                    $document->delete();
                }

                // Eliminar ítems de la entrada
                EntryProduct::where('entry_id', $entry->id)->delete();

                // Eliminar la entrada
                $entry->delete();
            });

            return response()->json(['message' => 'Entrada eliminada correctamente']);
        } catch (Exception $e) {
            Log::error('Error al eliminar la entrada: ' . $e->getMessage());
            return response()->json(['message' => 'Error al eliminar la entrada', 'error' => $e->getMessage()], 500);
        }
    }
    
    public function show($id)
{
    try {
        Log::info("Iniciando show para entry_id: {$id}");
        $entry = ProductEntry::with([
            'provider' => fn($q) => $q->select('id', 'full_name'),
            'products.product' => fn($q) => $q->select('id', 'title'),
            'evidences'
        ])->findOrFail($id);

        // Add stock from product_warehouse
        $entry->products->each(function ($entryProduct) {
            $warehouse = ProductWarehouse::where('product_id', $entryProduct->product_id)
                ->where('warehouse', 'Central Aguamilpa')
                ->first();
            $entryProduct->product->stock = $warehouse ? $warehouse->stock : 0;
        });

        $entry->evidences->map(function ($evidence) {
            $evidence->file_name = $evidence->original_name;
            $evidence->url = route('product-entries.evidence-file', $evidence->id);
            return $evidence;
        });

        Log::info("Entrada obtenida: {$id}", ['entry_id' => $id]);
        return response()->json($entry);
    } catch (Exception $e) {
        Log::error('Error al obtener entrada: ' . $e->getMessage(), ['entry_id' => $id]);
        return response()->json(['message' => 'Error al obtener entrada', 'error' => $e->getMessage()], 500);
    }
}

    //busqueda por process, provider.productcreayby

    public function index(Request $request)
    {
        try {
            Log::info("Iniciando listado de entradas con filtros", $request->all());
            $query = ProductEntry::with([
                
                'provider' => function ($q) {
                    $q->select('id', 'full_name');
                },
                'products.product' => function($q) {
                    $q->select('id', 'title');
                },
                'createdBy' => function ($q) {
                    $q->select('id', 'name');
                }
            ]);

            if ($request->has('process') && !empty($request->process)) {
                $query->where('process', 'LIKE', '%' . $request->process . '%');
            }
            if ($request->has('invoice_number') && !empty($request->invoice_number)) {
                $query->where('invoice_number', 'LIKE', '%' . $request->invoice_number . '%');
            }
            if ($request->has('order_number') && !empty($request->order_number)) {
                $query->where('order_number', 'LIKE', '%' . $request->order_number . '%');
            }
            if ($request->has('date_from') && !empty($request->date_from)) {
                $query->whereDate('entry_date', '>=', $request->date_from);
            }
            if ($request->has('date_to') && !empty($request->date_to)) {
                $query->whereDate('entry_date', '<=', $request->date_to);
            }
            if ($request->has('provider_name') && !empty($request->provider_name)) {
                $query->whereHas('provider', function ($q) use ($request) {
                    $q->where('full_name', 'LIKE', '%' . $request->provider_name . '%');
                });
            }
            if ($request->has('has_documents') && $request->input('has_documents') !== 'undefined') {
                $hasDocuments = filter_var($request->input('has_documents'), FILTER_VALIDATE_BOOLEAN);
                Log::info('Filtro has_documents aplicado:', ['has_documents' => $hasDocuments]);
                if ($hasDocuments) {
                    $query->whereHas('purchaseDocuments', function ($q) {
                        $q->where(function ($q) {
                            $q->where('is_auto_pdf', false)->orWhereNull('is_auto_pdf');
                        });
                    });
                } else {
                    $query->whereDoesntHave('purchaseDocuments', function ($q) {
                        $q->where(function ($q) {
                            $q->where('is_auto_pdf', false)->orWhereNull('is_auto_pdf');
                        });
                    });
                }
            }
            if ($request->has('entry_status') && !empty($request->entry_status) && $request->entry_status !== 'undefined') {
                $query->where('entry_status', $request->entry_status);
            }

            $perPage = $request->input('per_page', 10);
            $entries = $query->orderBy('created_at', 'desc')->paginate($perPage);

            Log::info('Consulta SQL generada:', [$query->toSql(), $query->getBindings()]);
            Log::info('Entradas devueltas:', $entries->pluck('id')->toArray());

            $entries->getCollection()->transform(function ($entry) {
                $purchaseDocs = $entry->purchaseDocuments()->where(function ($q) {
                    $q->where('is_auto_pdf', false)->orWhereNull('is_auto_pdf');
                })->get(['id', 'file_path', 'is_auto_pdf']);
                $entry->hasDocuments = $purchaseDocs->isNotEmpty();
                $entry->officialDocumentsCount = $purchaseDocs->count();
                Log::info('Documentos oficiales para entrada ID ' . $entry->id, [
                    'hasDocuments' => $entry->hasDocuments,
                    'officialDocumentsCount' => $entry->officialDocumentsCount,
                    'docs' => $purchaseDocs->toArray()
                ]);
                $entry->created_by_name = $entry->createdBy ? $entry->createdBy->name : 'N/A';
                return $entry;
            });

            Log::info("Entradas encontradas: " . $entries->total());
            return response()->json([
                'data' => $entries->items(),
                'total' => $entries->total(),
                'per_page' => $entries->perPage(),
                'current_page' => $entries->currentPage()
            ]);
        } catch (Exception $e) {
            Log::error('Error al listar entradas: ' . $e->getMessage());
            return response()->json(['message' => 'Error al listar entradas', 'error' => $e->getMessage()], 500);
        }
    }
            

    public function deleteEntry($entryId)
    {
    try {
        Log::info("Iniciando deleteEntry para entryId: {$entryId}");
        $entry = ProductEntry::findOrFail($entryId);

        DB::transaction(function () use ($entry) {
            // Revertir el stock de los productos
            $entryProducts = EntryProduct::where('entry_id', $entry->id)->get();
            if ($entryProducts->isNotEmpty()) {
                foreach ($entryProducts as $entryProduct) {
                    $warehouse = ProductWarehouse::where('product_id', $entryProduct->product_id)
                        ->where('warehouse', 'Central Aguamilpa')
                        ->first();
                    if ($warehouse) {
                        $warehouse->stock -= $entryProduct->quantity;
                        if ($warehouse->stock < 0) $warehouse->stock = 0;
                        $warehouse->save();
                        Log::info("Stock revertido: product_id {$entryProduct->product_id}, cantidad restada: {$entryProduct->quantity}");
                    }
                }
            }

            // Eliminar evidencias y sus archivos físicos
            $evidences = EntryEvidence::where('entry_id', $entry->id)->get();
            foreach ($evidences as $evidence) {
                Storage::disk('public')->delete($evidence->file_path);
                $evidence->delete();
            }

            // Eliminar documentos de compra y sus archivos físicos
            $documents = PurchaseDocument::where('entry_id', $entry->id)->get();
            foreach ($documents as $document) {
                Storage::disk('public')->delete($document->file_path);
                $document->delete();
            }

            // Eliminar productos asociados
            EntryProduct::where('entry_id', $entry->id)->delete();

            // Eliminar la entrada
            $entry->delete();
        });

        Log::info("Entrada eliminada: {$entryId}");
        return response()->json(['message' => 'Entrada eliminada correctamente']);
    } catch (Exception $e) {
        Log::error('Error al eliminar entrada: ' . $e->getMessage());
        return response()->json(['message' => 'Error al eliminar entrada', 'error' => $e->getMessage()], 500);
    }
}

// app/Http/Controllers/Product/ProductEntryController.php
public function generateEntryPdf($entryId)
{
    try {
        Log::info("Iniciando generateEntryPdf para entry_id: {$entryId}");
        $entry = ProductEntry::with([
            'provider' => fn($q) => $q->select('id', 'full_name'),
            'products.product' => fn($q) => $q->select('id', 'title'),
            'createdBy' => fn($q) => $q->select('id', 'name')
        ])->findOrFail($entryId);

        Log::info("Entrada cargada: ", ['entry_id' => $entry->id, 'invoice_number' => $entry->invoice_number]);

        $createdByName = $entry->createdBy ? $entry->createdBy->name : 'Usuario Desconocido';
        Log::info("Convirtiendo total a palabras: {$entry->total}");
        $amountInWords = $this->numberToWords($entry->total);

        $officialImages = EntryEvidence::where('entry_id', $entryId)
            ->whereIn('file_type', ['jpg', 'jpeg', 'png'])
            ->get()
            ->map(function ($evidence) {
                $filePath = storage_path('app/public/' . $evidence->file_path);
                Log::info("Verificando evidencia: {$filePath}");
                return file_exists($filePath) ? ['path' => $filePath, 'original_name' => $evidence->original_name] : null;
            })->filter()->toArray();

        Log::info("Imágenes de evidencias: ", ['count' => count($officialImages)]);

        Log::info("Generando PDF con DomPDF");
        $pdf = Pdf::loadView('pdf.entry', compact('entry', 'createdByName', 'amountInWords', 'officialImages'));

        $folderKey = $this->getOrCreateFolderKey($entry);
        $fileName = "entrada_{$folderKey}.pdf";
        $subFolder = "purchasedocuments/{$folderKey}";
        $filePath = "{$subFolder}/{$fileName}";

        // Delete previous auto-generated PDF
        $existingDocument = PurchaseDocument::where('entry_id', $entryId)
            ->where('is_auto_pdf', true)
            ->first();
        if ($existingDocument) {
            Storage::disk('public')->delete($existingDocument->file_path);
            Log::info("Archivo PDF anterior eliminado: {$existingDocument->file_path}");
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

        Log::info("Creando subcarpeta: {$subFolder}");
        Storage::disk('public')->makeDirectory($subFolder);
        Log::info("Guardando PDF en: {$filePath}");
        Storage::disk('public')->put($filePath, $pdf->output());

        Log::info("Creando registro en purchase_documents");
        $document = PurchaseDocument::create([
            'entry_id' => $entry->id,
            'file_path' => $filePath,
            'file_type' => 'pdf',
            'file_size' => strlen($pdf->output()),
            'original_name' => $fileName,
            'is_auto_pdf' => true,
            'folder_key' => $folderKey
        ]);

        Log::info("Registrando en document_history");
        DB::table('document_history')->insert([
            'document_id' => $document->id,
            'document_type' => 'purchase_document',
            'action' => 'created',
            'user_id' => auth()->id(),
            'created_at' => now(),
            'updated_at' => now()
        ]);

        $entry->update(['entry_status' => 'completed']);

        Log::info("PDF generado para entrada ID: {$entryId}", [
            'document_id' => $document->id,
            'file_path' => $filePath,
            'folder_key' => $folderKey
        ]);

        return response($pdf->output(), 200)
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', "inline; filename=\"{$fileName}\"");
    } catch (Exception $e) {
        Log::error('Error al generar PDF de entrada', [
            'entry_id' => $entryId,
            'message' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        return response()->json(['message' => 'Error al generar PDF', 'error' => $e->getMessage()], 500);
    }
}

//graba y sustituye anterior pdf
public function update(Request $request, $id)
{
    try {
        Log::info("Iniciando actualización de entrada con ID: {$id}", ['request_data' => $request->all()]);
        $entry = ProductEntry::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'provider_id' => 'required|exists:providers,id',
            'resource_origin' => 'required|string',
            'federal_program' => 'nullable|string',
            'invoice_number' => 'required|string|max:255|unique:product_entries,invoice_number,' . $id,
            'order_number' => 'required|string|max:255|unique:product_entries,order_number,' . $id,
            'process' => 'required|string',
            'partida' => 'nullable|integer',
            'entry_date' => 'required|date',
            'subtotal' => 'required|numeric|gte:0',
            'iva' => 'required|numeric|gte:0',
            'total' => 'required|numeric|gte:0',
            'updated_by' => 'nullable|exists:users,id',
            'entry_status' => 'nullable|string|in:pending,completed'
        ], [
            'provider_id.required' => 'El proveedor es obligatorio',
            'resource_origin.required' => 'El origen del recurso es obligatorio',
            'invoice_number.required' => 'El número de factura es obligatorio',
            'invoice_number.unique' => 'El número de factura ya existe',
            'order_number.required' => 'El número de orden es obligatorio',
            'order_number.unique' => 'El número de orden ya existe',
            'process.required' => 'El proceso es obligatorio',
            'entry_date.required' => 'La fecha de entrada es obligatoria',
            'subtotal.required' => 'El subtotal es obligatorio',
            'subtotal.numeric' => 'El subtotal debe ser un número válido',
            'subtotal.gte' => 'El subtotal debe ser mayor o igual a 0',
            'iva.required' => 'El IVA es obligatorio',
            'iva.numeric' => 'El IVA debe ser un número válido',
            'iva.gte' => 'El IVA debe ser mayor o igual a 0',
            'total.required' => 'El total es obligatorio',
            'total.numeric' => 'El total debe ser un número válido',
            'total.gte' => 'El total debe ser mayor o igual a 0'
        ]);

        if ($validator->fails()) {
            $errors = $validator->errors();
            $message = $errors->first();
            Log::warning("Validación fallida: " . $message, ['errors' => $errors->all(), 'request_data' => $request->all()]);
            return response()->json(['message' => $message, 'errors' => $errors->all()], 422);
        }

        $entry->update(array_merge(
            $request->only([
                'provider_id', 'resource_origin', 'federal_program', 'invoice_number',
                'order_number', 'process', 'partida', 'entry_date', 'subtotal', 'iva', 'total'
            ]),
            [
                'updated_by' => $request->input('updated_by', auth()->id()),
                'entry_status' => $request->input('entry_status', $entry->entry_status)
            ]
        ));

        Log::info("Entrada actualizada: {$entry->id}");
        return response()->json(['message' => 'Entrada actualizada correctamente']);
    } catch (Exception $e) {
        Log::error('Error al actualizar entrada: ' . $e->getMessage(), ['exception' => $e]);
        return response()->json(['message' => 'Error al actualizar entrada', 'error' => $e->getMessage()], 500);
    }
}



public function updateProducts(Request $request, $entryId)
{
    $validator = Validator::make($request->all(), [
        'products' => 'required|array',
        'products.*.product_id' => 'required|exists:products,id',
        'products.*.quantity' => 'required|integer|gt:0',
        'products.*.unit_price' => 'required|numeric|gt:0',
        'products.*.item_code' => 'nullable|string',
        'products.*.partida' => 'nullable|integer',
        'products.*.invoice_number' => 'nullable|string|max:255',
    ]);

    if ($validator->fails()) {
        return response()->json(['message' => $validator->errors()->first()], 422);
    }

    try {
        $entry = ProductEntry::findOrFail($entryId);

        DB::transaction(function () use ($request, $entry) {
            // Obtener productos actuales
            $currentProducts = EntryProduct::where('entry_id', $entry->id)
                ->get()
                ->keyBy('product_id');

            // Reemplazar en entry_product
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

            // === STOCK: AJUSTAR DIFERENCIA ===
            foreach ($request->products as $productData) {
                $productId = $productData['product_id'];
                $newQuantity = $productData['quantity'];
                $oldQuantity = $currentProducts->has($productId) ? $currentProducts[$productId]->quantity : 0;

                $difference = $newQuantity - $oldQuantity;

                $warehouse = ProductWarehouse::firstOrCreate(
                    ['product_id' => $productId, 'warehouse' => 'Central Aguamilpa'],
                    ['unit_id' => null, 'stock' => 0]
                );

                if ($difference > 0) {
                    $warehouse->increment('stock', $difference);
                    Log::info("Stock aumentado +{$difference} (producto {$productId})");
                } elseif ($difference < 0) {
                    $currentStock = $warehouse->stock;
                    if ($currentStock + $difference < 0) {
                        throw new \Exception("No hay suficiente stock para reducir (actual: {$currentStock}, intento: -".abs($difference).")");
                    }
                    $warehouse->decrement('stock', abs($difference));
                    Log::info("Stock reducido -".abs($difference)." (producto {$productId})");
                }
                // Si $difference == 0 → no hacer nada
            }
        });

        return response()->json(['message' => 'Productos actualizados correctamente'], 200);
    } catch (\Exception $e) {
        Log::error('Error al actualizar productos: ' . $e->getMessage());
        return response()->json(['message' => 'Error', 'error' => $e->getMessage()], 500);
    }
}
        public function deleteEvidence($id)
        {
            // Propósito: Elimina una evidencia específica de una entrada.
            try {
                Log::info("Iniciando eliminación de evidencia con ID: {$id}");
                $evidence = EntryEvidence::findOrFail($id);
                Storage::disk('public')->delete($evidence->file_path);
                $evidence->delete();
                Log::info("Evidencia eliminada: {$id}");
                return response()->json(['message' => 'Evidencia eliminada correctamente']);
            } catch (Exception $e) {
                Log::error('Error al eliminar evidencia: ' . $e->getMessage());
                return response()->json(['message' => 'Error al eliminar evidencia', 'error' => $e->getMessage()], 500);
            }
        }



    // Método para buscar facturas por número de factura
    public function searchInvoices(Request $request)
    {
        $query = $request->query('query');
        $invoices = ProductEntry::where('invoice_number', 'like', "%$query%")
            ->get(['id', 'invoice_number']);
        return response()->json($invoices); // Compatible con filteredInvoices
    }

    // Método para buscar órdenes
    public function searchOrders(Request $request)
    {
        try {
            $query = $request->input('query');
            $orders = ProductEntry::whereRaw('LOWER(order_number) LIKE ?', ['%' . strtolower($query) . '%'])
                ->select('id', 'order_number')
                ->get();
            return response()->json($orders);
        } catch (\Exception $e) {
            Log::error('Error al buscar órdenes: ' . $e->getMessage());
            return response()->json(['message' => 'Error al buscar órdenes', 'error' => $e->getMessage()], 500);
        }
    }


    public function savePurchaseDocuments(Request $request, $entryId)
    {
        try {
            Log::info("Iniciando savePurchaseDocuments para entryId: {$entryId}");
            $entry = ProductEntry::findOrFail($entryId);
            Log::info("Entrada encontrada: {$entry->id}");

            if (!$request->hasFile('documents')) {
                Log::warning("No se enviaron archivos en la petición");
                return response()->json(['message' => 'No se enviaron archivos'], 400);
            }

            $files = $request->file('documents');
            Log::info("Número de archivos recibidos: " . count($files));

            $folderKey = $this->getOrCreateFolderKey($entry);
            $subFolder = "purchasedocuments/{$folderKey}";

            foreach ($files as $file) {
                if (!$file->isValid()) {
                    Log::warning("Archivo inválido: {$file->getClientOriginalName()}");
                    return response()->json(['message' => 'Archivo inválido: ' . $file->getClientOriginalName()], 400);
                }

                $fileName = "doc_{$folderKey}_{$file->getClientOriginalName()}";
                $filePath = "{$subFolder}/{$fileName}";
                Storage::disk('public')->makeDirectory($subFolder);
                Storage::disk('public')->put($filePath, file_get_contents($file));
                Log::info("Archivo guardado en: {$filePath}");

                PurchaseDocument::create([
                    'entry_id' => $entry->id,
                    'file_path' => $filePath,
                    'file_type' => $file->getClientOriginalExtension(),
                    'file_size' => $file->getSize(),
                    'original_name' => $file->getClientOriginalName(),
                    'is_auto_pdf' => false,
                    'folder_key' => $folderKey
                ]);
                Log::info("Registro creado para archivo: {$file->getClientOriginalName()}");
            }

            Log::info("Documentos oficiales procesados correctamente");
            return response()->json(['message' => 'Documentos oficiales guardados correctamente']);
        } catch (\Exception $e) {
            Log::error('Error al guardar documentos oficiales: ' . $e->getMessage());
            return response()->json(['message' => 'Error al guardar documentos oficiales', 'error' => $e->getMessage()], 500);
        }
    }

    // Método para listar documentos oficiales de una entrada
    public function listPurchaseDocuments($entryId)
    {
        try {
            $entry = ProductEntry::findOrFail($entryId);
            $documents = PurchaseDocument::where('entry_id', $entry->id)->get();
    
            $documents->map(function ($document) {
                $document->file_name = $document->original_name;
                $document->file_type = pathinfo($document->original_name, PATHINFO_EXTENSION);
                $filePath = storage_path('app/' . $document->file_path);
                $document->file_size = file_exists($filePath) ? round(filesize($filePath) / 1024, 2) : null; // Tamaño en KB
                return $document;
            });
    
            return response()->json(['data' => $documents]);
        } catch (\Exception $e) {
            Log::error('Error al listar documentos oficiales: ' . $e->getMessage());
            return response()->json(['message' => 'Error al listar documentos oficiales', 'error' => $e->getMessage()], 500);
        }
    }


    // Método para obtener un documento oficial por ID (detalles)
    
    // Método para actualizar un documento oficial
    public function updatePurchaseDocument(Request $request, $id)
    {
        try {
            Log::info("Iniciando actualización de documento oficial con ID: {$id}");
            $document = PurchaseDocument::findOrFail($id);
            
            if (!$request->hasFile('document')) {
                Log::warning("No se envió un archivo en la petición");
                return response()->json(['message' => 'No se envió un archivo'], 400);
        }

        $file = $request->file('document');
        if (!$file->isValid()) {
            Log::warning("Archivo inválido: {$file->getClientOriginalName()}");
            return response()->json(['message' => 'Archivo inválido: ' . $file->getClientOriginalName()], 400);
        }
        
        Storage::disk('public')->delete($document->file_path);
        Log::info("Archivo físico eliminado: {$document->file_path}");
        
        $path = Storage::putFile('purchasedocuments', $file);
        Log::info("Nuevo archivo guardado en: {$path}");
        
        $document->update([
            'file_path' => $path,
            'file_type' => $file->getClientOriginalExtension(),
            'file_size' => $file->getSize(),
            'original_name' => $file->getClientOriginalName(),
        ]);
        Log::info("Documento oficial actualizado: {$id}");
        
        return response()->json(['success' => true, 'message' => 'Documento oficial actualizado correctamente']);
        } catch (\Exception $e) {
            Log::error('Error al actualizar documento oficial: ' . $e->getMessage());
            return response()->json(['message' => 'Error al actualizar documento oficial', 'error' => $e->getMessage()], 500);
        }
    }

// Método para eliminar un documento oficial
    public function deletePurchaseDocument($id)
    {
        try {
            Log::info("Iniciando eliminación de documento oficial con ID: {$id}");
            $document = PurchaseDocument::findOrFail($id);
            
            Storage::disk('public')->delete($document->file_path);
            Log::info("Archivo físico eliminado: {$document->file_path}");
            
            $document->delete();
            Log::info("Documento oficial eliminado: {$id}");
            
            return response()->json(['success' => true, 'message' => 'Documento oficial eliminado correctamente']);
        } catch (\Exception $e) {
            Log::error('Error al eliminar documento oficial: ' . $e->getMessage());
            return response()->json(['message' => 'Error al eliminar documento oficial', 'error' => $e->getMessage()], 500);
        }
    }



    public function getPurchaseDocuments($entryId)
{
    try {
        Log::info("Iniciando getPurchaseDocuments para entryId: {$entryId}");
        $documents = PurchaseDocument::where('entry_id', $entryId)
            ->select('id', 'entry_id', 'file_path', 'file_type', 'original_name', 'is_auto_pdf', 'folder_key')
            ->orderBy('created_at', 'desc') // Más reciente primero
            ->get();

        Log::info("Documentos obtenidos para entrada ID: {$entryId}", [
            'count' => $documents->count(),
            'documents' => $documents->toArray()
        ]);

        return response()->json([
            'data' => $documents,
            'message' => 'Documentos obtenidos correctamente'
        ], 200);
    } catch (\Exception $e) {
        Log::error("Error al obtener documentos para entrada ID: {$entryId}", [
            'message' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
        return response()->json(['message' => 'Error al obtener documentos', 'error' => $e->getMessage()], 500);
    }
}

public function getPurchaseDocumentFile($id)
{
    try {
        $document = PurchaseDocument::findOrFail($id);
        $filePath = storage_path('app/public/' . $document->file_path);

        Log::info("Intentando servir archivo: {$filePath}", ['document_id' => $id]);

        if (!file_exists($filePath)) {
            Log::warning("Archivo no encontrado: {$filePath}", ['document_id' => $id]);
            return response()->json(['message' => 'Archivo no encontrado en el servidor'], 404);
        }

        DB::table('document_history')->insert([
            'document_id' => $id,
            'document_type' => 'purchase_document',
            'action' => 'downloaded',
            'user_id' => auth()->id(),
            'created_at' => now(),
            'updated_at' => now()
        ]);

        Log::info("Archivo servido exitosamente: {$filePath}", ['document_id' => $id]);

        return response()->file($filePath, [
            'Content-Type' => mime_content_type($filePath),
            'Content-Disposition' => 'inline; filename="' . $document->original_name . '"'
        ]);
    } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
        Log::error("Documento no encontrado en la base de datos: document_id: {$id}");
        return response()->json(['message' => 'Documento no encontrado'], 404);
    } catch (\Exception $e) {
        Log::error('Error al obtener archivo de documento: ' . $e->getMessage(), ['document_id' => $id]);
        return response()->json(['message' => 'Error al obtener archivo', 'error' => $e->getMessage()], 500);
    }
}

    // Método para listar documentos asociados a una entrada (usado por getDocumentsByEntry en frontend)
    public function getDocuments($entryId)
    {
        try {
            $documents = PurchaseDocument::where('entry_id', $entryId)->get();
            return response()->json([
                'data' => $documents,
                'success' => true
            ]);
        } catch (\Exception $e) {
            Log::error('Error al obtener documentos: ' . $e->getMessage());
            return response()->json(['message' => 'Error al obtener documentos', 'error' => $e->getMessage()], 500);
        }
    }


}




    

    /*/para editar.
    public function getPurchaseDocument($id)
    {
        try {
            $document = PurchaseDocument::findOrFail($id);
            return response()->json([
                'id' => $document->id,
                'entry_id' => $document->entry_id,
                'original_name' => $document->original_name,
                'file_type' => $document->file_type,
                'file_path' => $document->file_path,
                'invoice_number' => $document->entry ? $document->entry->invoice_number : 'N/A'// Asumiendo relación con ProductEntry
            ]);
        } catch (\Exception $e) {
            Log::error('Error al obtener detalles del documento: ' . $e->getMessage());
            return response()->json(['message' => 'Error al obtener detalles del documento', 'error' => $e->getMessage()], 500);
        }
    }*/

    /* modificado el 20 mayo
    public function update(Request $request, $id)
{
    try {
        Log::info("Iniciando actualización de entrada con ID: {$id}", ['request_data' => $request->all()]);
        $entry = ProductEntry::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'provider_id' => 'required|exists:providers,id',
            'resource_origin' => 'required|string',
            'federal_program' => 'nullable|string',
            'invoice_number' => 'required|string|max:255|unique:product_entries,invoice_number,' . $id,
            'order_number' => 'required|string|max:255|unique:product_entries,order_number,' . $id,
            'process' => 'required|string',
            'partida' => 'nullable|integer',
            'entry_date' => 'required|date',
            'subtotal' => 'required|numeric|gte:0',
            'iva' => 'required|numeric|gte:0',
            'total' => 'required|numeric|gte:0',
            'updated_by' => 'nullable|exists:users,id',
            'entry_status' => 'nullable|string|in:pending,completed'
        ], [
            'provider_id.required' => 'El proveedor es obligatorio',
            'resource_origin.required' => 'El origen del recurso es obligatorio',
            'invoice_number.required' => 'El número de factura es obligatorio',
            'invoice_number.unique' => 'El número de factura ya existe',
            'order_number.required' => 'El número de orden es obligatorio',
            'order_number.unique' => 'El número de orden ya existe',
            'process.required' => 'El proceso es obligatorio',
            'entry_date.required' => 'La fecha de entrada es obligatoria',
            'subtotal.required' => 'El subtotal es obligatorio',
            'subtotal.numeric' => 'El subtotal debe ser un número válido',
            'subtotal.gte' => 'El subtotal debe ser mayor o igual a 0',
            'iva.required' => 'El IVA es obligatorio',
            'iva.numeric' => 'El IVA debe ser un número válido',
            'iva.gte' => 'El IVA debe ser mayor o igual a 0',
            'total.required' => 'El total es obligatorio',
            'total.numeric' => 'El total debe ser un número válido',
            'total.gte' => 'El total debe ser mayor o igual a 0'
        ]);

        if ($validator->fails()) {
            $errors = $validator->errors();
            $message = $errors->first();
            Log::warning("Validación fallida: " . $message, ['errors' => $errors->all(), 'request_data' => $request->all()]);
            return response()->json(['message' => $message, 'errors' => $errors->all()], 422);
        }

        $entry->update(array_merge(
            $request->only([
                'provider_id', 'resource_origin', 'federal_program', 'invoice_number',
                'order_number', 'process', 'partida', 'entry_date', 'subtotal', 'iva', 'total'
            ]),
            [
                'updated_by' => $request->input('updated_by', auth()->id()),
                'entry_status' => $request->input('entry_status', $entry->entry_status)
            ]
        ));

        Log::info("Entrada actualizada: {$entry->id}");
        return response()->json(['message' => 'Entrada actualizada correctamente']);
    } catch (Exception $e) {
        Log::error('Error al actualizar entrada: ' . $e->getMessage(), ['exception' => $e]);
        return response()->json(['message' => 'Error al actualizar entrada', 'error' => $e->getMessage()], 500);
    }
}

    public function updateProducts(Request $request, $entryId)
{
    $validator = Validator::make($request->all(), [
        'products' => 'required|array',
        'products.*.product_id' => 'required|exists:products,id',
        'products.*.quantity' => 'required|integer|gt:0',
        'products.*.unit_price' => 'required|numeric|gt:0',
        'products.*.item_code' => 'nullable|string',
        'products.*.partida' => 'nullable|integer',
        'products.*.invoice_number' => 'nullable|string|max:255',
    ], [
        'products.*.quantity.gt' => 'La cantidad debe ser mayor que 0.',
        'products.*.unit_price.gt' => 'El precio unitario debe ser mayor que 0.',
    ]);

    if ($validator->fails()) {
        $errors = $validator->errors();
        $firstError = $errors->first();
        Log::warning("Validación fallida en updateProducts: {$firstError}", ['errors' => $errors->all()]);
        return response()->json(['message' => $firstError], 422);
    }

    try {
        $entry = ProductEntry::findOrFail($entryId);

        DB::transaction(function () use ($request, $entry) {
            $currentProducts = EntryProduct::where('entry_id', $entry->id)->get();
            $currentProductMap = $currentProducts->keyBy('product_id');

            // Update entry_product records
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

            // Update stock in product_warehouse
            foreach ($request->products as $productData) {
                $productId = $productData['product_id'];
                $newQuantity = $productData['quantity'];
                $oldQuantity = $currentProductMap->has($productId) ? $currentProductMap[$productId]->quantity : 0;

                $warehouse = ProductWarehouse::firstOrCreate(
                    ['product_id' => $productId, 'warehouse' => 'Central Aguamilpa'],
                    ['unit_id' => null, 'stock' => 0]
                );

                // Calculate stock change: new_quantity - old_quantity
                $stockChange = $newQuantity - $oldQuantity;
                $newStock = $warehouse->stock + $stockChange;

                if ($newStock < 0) {
                    throw new Exception("El stock del producto {$productId} no puede ser negativo (stock actual: {$warehouse->stock}, cambio: {$stockChange}).");
                }

                $warehouse->stock = $newStock;
                $warehouse->save();

                Log::info("Stock actualizado para product_id: {$productId}", [
                    'old_quantity' => $oldQuantity,
                    'new_quantity' => $newQuantity,
                    'stock_change' => $stockChange,
                    'new_stock' => $newStock
                ]);
            }
        });

        Log::info("Productos actualizados para entrada ID: {$entryId}");
        return response()->json(['message' => 'Productos actualizados correctamente'], 200);
    } catch (Exception $e) {
        Log::error('Error al actualizar productos: ' . $e->getMessage(), ['entry_id' => $entryId]);
        return response()->json(['message' => 'Error al actualizar productos', 'error' => $e->getMessage()], 500);
    }
}
*/
    /* Método para subir documentos oficiales de la compra
    public function savePurchaseDocument(Request $request, $entryId)
    {
        try {
            Log::info("Iniciando savePurchaseDocuments para entryId: {$entryId}");
            $entry = ProductEntry::findOrFail($entryId);
            Log::info("Entrada encontrada: {$entry->id}");

            if (!$request->hasFile('documents')) {
                Log::warning("No se enviaron archivos en la petición");
                return response()->json(['message' => 'No se enviaron archivos'], 400);
            }

            $files = $request->file('documents');
            Log::info("Número de archivos recibidos: " . count($files));

            foreach ($files as $file) {
                if (!$file->isValid()) {
                    Log::warning("Archivo inválido: {$file->getClientOriginalName()}");
                    return response()->json(['message' => 'Archivo inválido: ' . $file->getClientOriginalName()], 400);
                }

                $path = Storage::putFile('purchasedocuments', $file);
                Log::info("Archivo guardado en: {$path}");

                PurchaseDocument::create([
                    'entry_id' => $entry->id,
                    'file_path' => $path,
                    'file_type' => $file->getClientOriginalExtension(),
                    'file_size' => $file->getSize(),
                    'original_name' => $file->getClientOriginalName(),
                ]);
                Log::info("Registro creado para archivo: {$file->getClientOriginalName()}");
            }

            Log::info("Documentos oficiales procesados correctamente");
            return response()->json(['message' => 'Documentos oficiales guardados correctamente']);
        } catch (\Exception $e) {
            Log::error('Error al guardar documentos oficiales: ' . $e->getMessage() . "\nStack trace: " . $e->getTraceAsString());
            return response()->json(['message' => 'Error al guardar documentos oficiales', 'error' => $e->getMessage()], 500);
        }
    }*/
/*

    public function storeProducts(Request $request, $entryId)
    {
        // Propósito: Guarda los productos asociados a una entrada y actualiza el stock.
        $validator = Validator::make($request->all(), [
            'products' => 'required|array',
            'products.*.product_id' => 'required|exists:products,id',
            'products.*.quantity' => 'required|integer|gt:0',
            'products.*.unit_price' => 'required|numeric|gt:0',
            'products.*.item_code' => 'nullable|string',
            'products.*.partida' => 'nullable|integer', // Añadido para partida
            'products.*.invoice_number' => 'nullable|string|max:255',
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
                        'partida' => $item['partida'] ?? null, // Añadido para rastreo
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
                    $warehouse->increment('stock', $productData['quantity']); // Usar increment para suma atómica
                    Log::info("Stock incrementado en product_warehouse: product_id {$productData['product_id']}, warehouse 'Central Aguamilpa', cantidad {$productData['quantity']}, nuevo stock {$warehouse->stock}");
                }
            });
            return response()->json(['message' => 'Productos guardados'], 200);
        } catch (Exception $e) {
            Log::error('Error al guardar productos: ' . $e->getMessage());
            return response()->json(['message' => 'Error al guardar productos', 'error' => $e->getMessage()], 500);
        }
    }
*/
    


 //modificado el 15 mayo
    /*public function generateEntryPdf($entryId)
    {
        try {
            $entry = ProductEntry::with([
                'provider' => function ($q) { $q->select('id', 'full_name'); },
                'products.product' => function ($q) { $q->select('id', 'title'); },
                'createdBy' => function ($q) { $q->select('id', 'name'); }
            ])->findOrFail($entryId);

            Log::info("Generando PDF para entrada ID: {$entryId}", [
                'provider' => $entry->provider ? $entry->provider->full_name : 'N/A',
                'products_count' => $entry->products->count(),
                'created_by_exists' => $entry->createdBy ? true : false
            ]);

            // Nombre del usuario activo
            $createdByName = $entry->createdBy ? $entry->createdBy->name : 'Usuario Desconocido';

            // Convertir el total a letras
            $amountInWords = strtoupper($this->numberToWords($entry->total)) . ' PESOS';

            // Recuperar imágenes de evidencias (EntryEvidence)
            $officialImages = EntryEvidence::where('entry_id', $entryId)
                ->whereIn('file_type', ['jpg', 'jpeg', 'png'])
                ->get()
                ->map(function ($evidence) {
                    // Usar la ruta completa tal como está en la base de datos
                    $filePath = public_path('storage/evidenciaproductos/' . basename($evidence->file_path));
                    if (file_exists($filePath)) {
                        return [
                            'path' => $filePath,
                            'original_name' => $evidence->original_name
                        ];
                    } else {
                        Log::warning("Archivo de evidencia no encontrado: {$filePath}");
                        return null;
                    }
                })->filter()->toArray();

            Log::info("Imágenes de evidencias encontradas: " . count($officialImages));

            // Generar el PDF
            $pdf = Pdf::loadView('pdf.entry', compact('entry', 'createdByName', 'amountInWords', 'officialImages'));
            $pdfContent = $pdf->output();
            $fileName = "entrada_{$entry->invoice_number}_" . now()->format('YmdHis') . '.pdf';
            $filePath = "purchasedocuments/{$fileName}";

            if (!Storage::disk('public')->exists('purchasedocuments')) {
                Storage::disk('public')->makeDirectory('purchasedocuments');
            }

            Storage::disk('public')->put($filePath, $pdfContent);
            $publicFilePath = 'storage/' . $filePath;
            Log::info("PDF guardado en: {$publicFilePath}");

            PurchaseDocument::create([
                'entry_id' => $entry->id,
                'file_path' => $publicFilePath,
                'file_type' => 'pdf',
                'file_size' => strlen($pdfContent),
                'original_name' => $fileName,
                'is_auto_pdf' => true
            ]);

            $entry->update(['entry_status' => 'completed']);

            // Devolver la respuesta con encabezados CORS
            return response($pdfContent, 200)
                ->header('Content-Type', 'application/pdf')
                ->header('Content-Disposition', "inline; filename=\"{$fileName}\"")
                ->header('Access-Control-Allow-Origin', 'http://localhost:4200')
                ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
                ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        } catch (Exception $e) {
            Log::error('Error al generar PDF de entrada', [
                'entry_id' => $entryId,
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['message' => 'Error al generar PDF', 'error' => $e->getMessage()], 500)
                ->header('Access-Control-Allow-Origin', 'http://localhost:4200');
        }
    }
    public function getPurchaseDocumentFile($id)
    {
        try {
            $document = PurchaseDocument::findOrFail($id);
            $filePath = storage_path('app/public/' . $document->file_path);

            if (!file_exists($filePath)) {
                return response()->json(['message' => 'Archivo no encontrado'], 404);
            }

            return response()->file($filePath, [
                'Content-Type' => mime_content_type($filePath),
                'Content-Disposition' => 'inline; filename="' . $document->original_name . '"'
            ]);
        } catch (\Exception $e) {
            Log::error('Error al obtener archivo de documento oficial: ' . $e->getMessage());
            return response()->json(['message' => 'Error al obtener archivo', 'error' => $e->getMessage()], 500);
        }
    }*/

// para generar subcarpetas entradas y salidas, 
// sanitizeFileName, generateEntryPdf,
// getPurchaseDocumentFile,store
        
    /*
    public function generateEntryPd($entryId)//modificado 17/05
    {
        try {
            $entry = ProductEntry::with([
                'provider' => fn($q) => $q->select('id', 'full_name'),
                'products.product' => fn($q) => $q->select('id', 'title'),
                'createdBy' => fn($q) => $q->select('id', 'name')
            ])->findOrFail($entryId);

            $createdByName = $entry->createdBy ? $entry->createdBy->name : 'Usuario Desconocido';
            $amountInWords = strtoupper($this->numberToWords($entry->total)) . ' PESOS';

            $officialImages = EntryEvidence::where('entry_id', $entryId)
                ->whereIn('file_type', ['jpg', 'jpeg', 'png'])
                ->get()
                ->map(function ($evidence) {
                    $filePath = storage_path('app/public/' . $evidence->file_path);
                    return file_exists($filePath) ? ['path' => $filePath, 'original_name' => $evidence->original_name] : null;
                })->filter()->toArray();

            $pdf = Pdf::loadView('pdf.entry', compact('entry', 'createdByName', 'amountInWords', 'officialImages'));

            $sanitizedInvoice = $this->sanitizeFileName($entry->invoice_number);
            $randomKey = Str::random(5);
            $date = now()->format('Ymd');
            $folderKey = "{$sanitizedInvoice}_{$date}_{$randomKey}";
            $fileName = "entrada_{$folderKey}.pdf";
            $subFolder = "purchasedocuments/{$folderKey}";
            $filePath = "{$subFolder}/{$fileName}";

            Storage::disk('public')->makeDirectory($subFolder);
            Storage::disk('public')->put($filePath, $pdf->output());

            $document = PurchaseDocument::create([
                'entry_id' => $entry->id,
                'file_path' => $filePath,
                'file_type' => 'pdf',
                'file_size' => strlen($pdf->output()),
                'original_name' => $fileName,
                'is_auto_pdf' => true,
                'folder_key' => $folderKey
            ]);

            DB::table('document_history')->insert([
                'document_id' => $document->id,
                'document_type' => 'purchase_document',
                'action' => 'created',
                'user_id' => auth()->id(),
                'created_at' => now(),
                'updated_at' => now()
            ]);

            $entry->update(['entry_status' => 'completed']);

            Log::info("PDF generado para entrada ID: {$entryId}", [
                'document_id' => $document->id,
                'file_path' => $filePath,
                'folder_key' => $folderKey
            ]);

            return response($pdf->output(), 200)
                ->header('Content-Type', 'application/pdf')
                ->header('Content-Disposition', "inline; filename=\"{$fileName}\"");
        } catch (Exception $e) {
            Log::error('Error al generar PDF de entrada', [
                'entry_id' => $entryId,
                'message' => $e->getMessage()
            ]);
            return response()->json(['message' => 'Error al generar PDF', 'error' => $e->getMessage()], 500);
        }
    }

    public function generateEntryPd($entryId)
    {
        try {
            Log::info("Iniciando generateEntryPdf para entry_id: {$entryId}");
            $entry = ProductEntry::with([
                'provider' => fn($q) => $q->select('id', 'full_name'),
                'products.product' => fn($q) => $q->select('id', 'title'),
                'createdBy' => fn($q) => $q->select('id', 'name')
            ])->findOrFail($entryId);

            Log::info("Entrada cargada: ", ['entry_id' => $entry->id, 'invoice_number' => $entry->invoice_number]);

            $createdByName = $entry->createdBy ? $entry->createdBy->name : 'Usuario Desconocido';
            Log::info("Convirtiendo total a palabras: {$entry->total}");
            $amountInWords = $this->numberToWords($entry->total); // Removed extra ' PESOS'

            $officialImages = EntryEvidence::where('entry_id', $entryId)
                ->whereIn('file_type', ['jpg', 'jpeg', 'png'])
                ->get()
                ->map(function ($evidence) {
                    $filePath = storage_path('app/public/' . $evidence->file_path);
                    Log::info("Verificando evidencia: {$filePath}");
                    return file_exists($filePath) ? ['path' => $filePath, 'original_name' => $evidence->original_name] : null;
                })->filter()->toArray();

            Log::info("Imágenes de evidencias: ", ['count' => count($officialImages)]);

            Log::info("Generando PDF con DomPDF");
            $pdf = Pdf::loadView('pdf.entry', compact('entry', 'createdByName', 'amountInWords', 'officialImages'));

            $folderKey = $this->getOrCreateFolderKey($entry);
            $fileName = "entrada_{$folderKey}.pdf";
            $subFolder = "purchasedocuments/{$folderKey}";
            $filePath = "{$subFolder}/{$fileName}";

            Log::info("Creando subcarpeta: {$subFolder}");
            Storage::disk('public')->makeDirectory($subFolder);
            Log::info("Guardando PDF en: {$filePath}");
            Storage::disk('public')->put($filePath, $pdf->output());

            Log::info("Creando registro en purchase_documents");
            $document = PurchaseDocument::create([
                'entry_id' => $entry->id,
                'file_path' => $filePath,
                'file_type' => 'pdf',
                'file_size' => strlen($pdf->output()),
                'original_name' => $fileName,
                'is_auto_pdf' => true,
                'folder_key' => $folderKey
            ]);

            Log::info("Registrando en document_history");
            DB::table('document_history')->insert([
                'document_id' => $document->id,
                'document_type' => 'purchase_document',
                'action' => 'created',
                'user_id' => auth()->id(),
                'created_at' => now(),
                'updated_at' => now()
            ]);

            $entry->update(['entry_status' => 'completed']);

            Log::info("PDF generado para entrada ID: {$entryId}", [
                'document_id' => $document->id,
                'file_path' => $filePath,
                'folder_key' => $folderKey
            ]);

            return response($pdf->output(), 200)
                ->header('Content-Type', 'application/pdf')
                ->header('Content-Disposition', "inline; filename=\"{$fileName}\"");
        } catch (Exception $e) {
            Log::error('Error al generar PDF de entrada', [
                'entry_id' => $entryId,
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['message' => 'Error al generar PDF', 'error' => $e->getMessage()], 500);
        }
    }*/

  