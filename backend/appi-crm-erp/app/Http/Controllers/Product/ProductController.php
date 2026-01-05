<?php

namespace App\Http\Controllers\Product;


use Illuminate\Http\Request;
use App\Models\Product\Marca;

use App\Models\Product\Product;
use Carbon\Exceptions\Exception;
use App\Models\Configuration\Unit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\Controller;
use App\Models\Product\ProductWallet;
use App\Models\Product\InventoryAlert;
use Illuminate\Support\Facades\Storage;
use App\Models\Product\ProductWarehouse;
use Illuminate\Support\Facades\Validator;
use App\Models\Product\ProductPriceHistory;
use App\Models\Configuration\ProductCategorie;
use Illuminate\Validation\ValidationException;
use App\Http\Resources\Product\ProductResource;
use App\Http\Resources\Product\ProductCollection;

class ProductController extends Controller
{

    public function __construct()
    {
        
        $this->middleware('auth:api');
        $this->middleware('permission:products.list')->only(['index']);
        $this->middleware('permission:products.view')->only(['show']);
        $this->middleware('permission:products.create')->only(['store']);
        $this->middleware('permission:products.update')->only(['update']);
        $this->middleware('permission:products.delete')->only(['destroy']);
    }
    
    // MODIFIED: Bypassed filterAdvance validation and enhanced logging
    public function index(Request $request)
    {
        Log::info("Product index request payload: ", $request->all());

        $search = $request->input('search', '');
        $product_categorie_id = $request->input('product_categorie_id', '');

        // Temporarily bypass filterAdvance to avoid title validation
        $query = Product::query();

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($product_categorie_id) {
            $query->where('product_categorie_id', $product_categorie_id);
        }

        $products = $query->orderBy("id", "desc")->paginate(25);
        
        return response()->json([
            "total" => $products->total(),
            "per_page" => $products->perPage(),   // productos por página
            "current_page" => $products->currentPage(),
            "last_page" => $products->lastPage(), // total de páginas
            "products" => ProductCollection::make($products),
        ]);
    }

    //mostrar las listas trayendo los dtaos.
    public function config()
    {
        $units = Unit::where("state", 1)->get();
        $categories = ProductCategorie::where("state", 1)->get();
        
        return response()->json([
            "units" => $units,
            "categories" => $categories,
        ]);
    }

    public function store(Request $request)
    {
        // Determinar si la categoría es "Refacciones Automotrices"
        $category = ProductCategorie::find($request->product_categorie_id);
        $isAutomotriz = $category && $category->name === "REFACCIONES AUTOMOTRICES";

        // Reglas de validación base
        $rules = [
            'title' => 'required|string|max:255',
            'sku' => 'required|string|max:255',
            'description' => 'required|string',
            'price_general' => 'required|numeric|min:0',
            'product_categorie_id' => 'required|exists:product_categories,id',
            'WAREHOUSES_PRODUCT' => 'required|json',
            'producto_imagen' => 'nullable|image|max:2048',
            'umbral' => 'required|integer|min:0',
            'umbral_unit_id' => 'required|exists:units,id',
            'tiempo_de_entrega' => 'required|integer|min:0',
            'clave' => 'required|string|max:255|unique:products,clave',
        ];

        if ($isAutomotriz) {
            $rules['marca_id'] = 'required|exists:marcas,id';
            $rules['tipo_id'] = 'required|exists:tipos,id';
            $rules['modelo'] = 'required|integer';
            $rules['cilindro'] = 'required|integer';
            $rules['numeroeco'] = 'required|string';
            $rules['placa'] = 'required|string';
        } else {
            $rules['marca_id'] = 'nullable|exists:marcas,id';
            $rules['tipo_id'] = 'nullable|exists:tipos,id';
            $rules['modelo'] = 'nullable|integer';
            $rules['cilindro'] = 'nullable|integer';
            $rules['numeroeco'] = 'nullable|string';
            $rules['placa'] = 'nullable|string';
        }
        
        $validator = Validator::make($request->all(), $rules);

        if ($validator->fails()) {
            Log::error("Validation failed for product creation: " . $validator->errors()->first());
            return response()->json([
                "message" => 422,
                "message_text" => $validator->errors()->first()
            ], 422);
        }

        try {
            return DB::transaction(function () use ($request) {
                $warehousesProduct = json_decode($request->input('WAREHOUSES_PRODUCT'), true);
                if (empty($warehousesProduct)) {
                    throw new Exception("Debe especificar al menos un almacén para el producto.");
                }

                $product = Product::create([
                    "title" => $request->title,
                    "sku" => strtoupper(trim($request->sku)),
                    "description" => $request->description,
                    "price_general" => $request->price_general,
                    "specifications" => $request->specifications,
                    "umbral" => $request->umbral,
                    "umbral_unit_id" => $request->umbral_unit_id,
                    "tiempo_de_entrega" => $request->tiempo_de_entrega,
                    "clave" => $request->clave,
                    "product_categorie_id" => $request->product_categorie_id,
                    "marca_id" => $request->marca_id ?: null,
                    "tipo_id" => $request->tipo_id ?: null,
                    "modelo" => $request->modelo ?: 0,
                    "numeroeco" => $request->numeroeco ?: 0,
                    "placa" => $request->placa ?: null,
                    "cilindro" => $request->cilindro ?: 0,
                    "created_by" => auth()->id(),
                ]);

                Log::info("Producto creado con ID: {$product->id}, SKU: {$product->sku}");

                // Registrar el precio y las especificaciones en el historial
                ProductPriceHistory::create([
                    'product_id' => $product->id,
                    'price_general' => $request->price_general,
                    'specifications' => $request->specifications,
                ]);

                Log::info("Historial de precio registrado para producto ID: {$product->id}");

                // Manejar la imagen si se proporcionó
                if ($request->hasFile("producto_imagen")) {
                    $path = Storage::putFile("productos", $request->file("producto_imagen"));
                    $product->update(["imagen" => $path]);
                    Log::info("Imagen guardada para producto ID {$product->id}: {$path}");
                }

                // Registrar el stock inicial en product_warehouses
                foreach ($warehousesProduct as $key => $warehouseProd) {
                    $quantity = $warehouseProd["quantity"] ?? 0;
                    if ($quantity <= 0) {
                        throw new Exception("La cantidad debe ser mayor a 0.");
                    }

                    $warehouseRecord = ProductWarehouse::firstOrCreate(
                        [
                            "product_id" => $product->id,
                            "warehouse" => "Central Aguamilpa",
                        ],
                        [
                            "unit_id" => $warehouseProd["unit"]["id"],
                            "stock" => 0,
                        ]
                    );

                    $warehouseRecord->increment('stock', $quantity);
                    Log::info("Stock registrado para producto ID {$product->id}, almacén Central Aguamilpa: {$quantity}");
                }

                // Registrar el precio en product_wallets
                foreach ($warehousesProduct as $key => $warehouseProd) {
                    ProductWallet::create([
                        "product_id" => $product->id,
                        "unit_id" => $warehouseProd["unit"]["id"],
                        "price" => $warehouseProd["price_general"],
                        "area_id" => null,
                        "subarea_id" => null,
                    ]);
                }

                // Verificar bajo stock
                $this->checkLowStock($product);

                return response()->json([
                    "message" => 200,
                    "message_text" => "Producto registrado correctamente",
                    "product_id" => $product->id
                ]);
            });
        } catch (Exception $e) {
            Log::error("Error al registrar producto: " . $e->getMessage());
            return response()->json([
                "message" => 422,
                "message_text" => $e->getMessage()
            ], 422);
        }
    }

    protected function checkLowStock(Product $product)
    {
        $warehouse = $product->warehouses()->where('warehouse', 'Central Aguamilpa')->first();
        if ($warehouse && $warehouse->stock <= $product->umbral) {
            InventoryAlert::create([
                'product_id' => $product->id,
                'message' => "Producto {$product->title} tiene bajo stock: {$warehouse->stock} (Umbral: {$product->umbral})",
            ]);
            Log::warning("Producto con bajo stock: {$product->title}, stock: {$warehouse->stock}, umbral: {$product->umbral}");
        }
    }

    public function show(string $id)
    {
        $product = Product::with([
            'umbral_unit:id,name',
            'product_categories:id,name',
            'warehouses:id,product_id,unit_id,warehouse,stock',
            'marca:id,nombre',
            'tipo:id,nombre'
        ])->findOrFail($id);

        return response()->json([
            "product" => ProductResource::make($product),
        ]);
    }

   

public function update(Request $request, string $id)
{
    $product = Product::findOrFail($id);

    Log::info("Updating product ID: {$id}", [
        'request_sku' => trim($request->sku),
        'current_sku' => trim($product->sku),
        'is_equal' => strtoupper(trim($request->sku)) === strtoupper(trim($product->sku))
    ]);

    // Validar SKU único (excepto el actual)
    if (strtoupper(trim($request->sku)) !== strtoupper(trim($product->sku))) {
        $is_exist_product = Product::whereRaw('UPPER(TRIM(sku)) = ?', [strtoupper(trim($request->sku))])
            ->where("id", "<>", $id)
            ->first();
        if ($is_exist_product) {
            return response()->json([
                "message" => 403,
                "message_text" => "El SKU ya existe en otro producto"
            ], 403);
        }
    }

    // Validar clave única
    if (trim($request->clave) !== trim($product->clave)) {
        $is_exist_clave = Product::whereRaw('TRIM(clave) = ?', [trim($request->clave)])
            ->where("id", "<>", $id)
            ->first();
        if ($is_exist_clave) {
            return response()->json([
                "message" => 403,
                "message_text" => "La clave ya existe en otro producto"
            ], 403);
        }
    }

    $category = ProductCategorie::find($request->product_categorie_id);
    $isAutomotriz = $category && $category->name === "REFACCIONES AUTOMOTRICES";

    $rules = [
        'title' => 'required|string|max:255',
        'sku' => 'required|string|max:255',
        'description' => 'required|string',
        'price_general' => 'required|numeric|min:0',
        'product_categorie_id' => 'required|exists:product_categories,id',
        'WAREHOUSES_PRODUCT' => 'required|json',
        'producto_imagen' => 'nullable|image|max:2048',
        'umbral' => 'required|integer|min:0',
        'umbral_unit_id' => 'required|exists:units,id',
        'tiempo_de_entrega' => 'required|integer|min:0',
        'clave' => 'required|string|max:255',
    ];

    if ($isAutomotriz) {
        $rules['marca_id'] = 'required|exists:marcas,id';
        $rules['tipo_id'] = 'required|exists:tipos,id';
        $rules['modelo'] = 'required|integer';
        $rules['cilindro'] = 'required|integer';
        $rules['numeroeco'] = 'required|string';
        $rules['placa'] = 'required|string';
    } else {
        $rules['marca_id'] = 'nullable|exists:marcas,id';
        $rules['tipo_id'] = 'nullable|exists:tipos,id';
        $rules['modelo'] = 'nullable|integer';
        $rules['cilindro'] = 'nullable|integer';
        $rules['numeroeco'] = 'nullable|string';
        $rules['placa'] = 'nullable|string';
    }

    $validator = Validator::make($request->all(), $rules);
    if ($validator->fails()) {
        return response()->json([
            "message" => 422,
            "message_text" => $validator->errors()->first()
        ], 422);
    }

    try {
        return DB::transaction(function () use ($request, $product) {
            // === IMAGEN ===
            if ($request->input('remove_image') == '1' && $product->imagen) {
                Storage::delete($product->imagen);
                $product->update(['imagen' => null]);
            }

            if ($request->hasFile("producto_imagen")) {
                if ($product->imagen) {
                    Storage::delete($product->imagen);
                }
                $path = Storage::putFile("productos", $request->file("producto_imagen"));
                $product->update(['imagen' => $path]);
            }

            // === DATOS DEL PRODUCTO ===
            $product->update([
                "title" => $request->title,
                "sku" => strtoupper(trim($request->sku)),
                "price_general" => $request->price_general,
                "description" => $request->description,
                "specifications" => $request->specifications,
                "umbral" => $request->umbral,
                "umbral_unit_id" => $request->umbral_unit_id,
                "tiempo_de_entrega" => $request->tiempo_de_entrega,
                "clave" => $request->clave,
                "product_categorie_id" => $request->product_categorie_id,
                "marca_id" => $request->marca_id ?: null,
                "tipo_id" => $request->tipo_id ?: null,
                "modelo" => $request->modelo ?: 0,
                "numeroeco" => $request->numeroeco ?: 0,
                "placa" => $request->placa ?: null,
                "cilindro" => $request->cilindro ?: 0,
                "updated_by" => auth()->id(),
            ]);

            ProductPriceHistory::create([
                'product_id' => $product->id,
                'price_general' => $request->price_general,
                'specifications' => $request->specifications,
            ]);

            // === STOCK EN product_warehouses: AJUSTAR DIFERENCIA ===
            $warehousesProduct = json_decode($request->input('WAREHOUSES_PRODUCT'), true);
            if (empty($warehousesProduct)) {
                throw new \Exception("Debe especificar al menos un almacén para el producto.");
            }

            // Obtener stock actual por unidad
            $currentStocks = ProductWarehouse::where('product_id', $product->id)
                ->where('warehouse', 'Central Aguamilpa')
                ->pluck('stock', 'unit_id')
                ->toArray();

            foreach ($warehousesProduct as $wp) {
                $unitId = $wp["unit"]["id"] ?? null;
                $newQuantity = $wp["quantity"] ?? 0;

                if ($newQuantity < 0) {
                    throw new \Exception("La cantidad no puede ser negativa.");
                }

                $warehouseRecord = ProductWarehouse::firstOrCreate(
                    [
                        "product_id" => $product->id,
                        "warehouse" => "Central Aguamilpa",
                    ],
                    [
                        "unit_id" => $unitId,
                        "stock" => 0,
                    ]
                );

                $oldQuantity = $currentStocks[$unitId] ?? 0;
                $difference = $newQuantity - $oldQuantity;

                if ($difference > 0) {
                    $warehouseRecord->increment('stock', $difference);
                    Log::info("Stock aumentado +{$difference} (producto {$product->id}, unidad {$unitId})");
                } elseif ($difference < 0) {
                    $currentStock = $warehouseRecord->stock;
                    if ($currentStock + $difference < 0) {
                        throw new \Exception("No hay suficiente stock para reducir ({$currentStock} disponibles).");
                    }
                    $warehouseRecord->decrement('stock', abs($difference));
                    Log::info("Stock reducido -".abs($difference)." (producto {$product->id}, unidad {$unitId})");
                }
            }

            // === PRODUCT WALLET (precios por área) ===
            ProductWallet::where('product_id', $product->id)->delete();
            foreach ($warehousesProduct as $wp) {
                ProductWallet::create([
                    "product_id" => $product->id,
                    "unit_id" => $wp["unit"]["id"],
                    "price" => $wp["price_general"],
                    "area_id" => null,
                    "subarea_id" => null,
                ]);
            }

            // === ALERTA BAJO STOCK ===
            $this->checkLowStock($product);

            return response()->json([
                "message" => 200,
                "message_text" => "Producto actualizado correctamente",
                "product" => ProductResource::make($product->fresh([
                    'umbral_unit:id,name',
                    'product_categories:id,name',
                    'warehouses:id,product_id,unit_id,warehouse,stock',
                    'marca:id,nombre',
                    'tipo:id,nombre'
                ]))
            ]);
        });
    } catch (\Exception $e) {
        Log::error("Error al actualizar producto ID: {$id}: " . $e->getMessage());
        return response()->json([
            "message" => 422,
            "message_text" => $e->getMessage()
        ], 422);
    }
}


    public function getProductOptions()
    {
        $marcas = Marca::with('tipos')->get();

        return response()->json([
            'marcas' => $marcas,
        ]);
    }

    public function destroy(string $id)
    {
        $product = Product::findOrFail($id);
        if ($product->imagen) {
            Storage::delete($product->imagen);
        }
        $product->delete();
        return response()->json([
            "message" => 200,
        ]);
    }

    public function check(Request $request)
    {
        $sku = $request->query('sku');
        $product_id = $request->query('product_id');
        
        if (!$sku) {
            return response()->json([
                'message' => 'El SKU es obligatorio'
            ], 422);
        }

        $query = Product::whereRaw('UPPER(TRIM(sku)) = ?', [strtoupper(trim($sku))]);
        if ($product_id) {
            $query->where('id', '<>', $product_id);
        }

        $exists = $query->exists();

        return response()->json([
            'exists' => $exists
        ], 200);
    }


    public function storeQuick(Request $request)
{
    try {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'required|string|max:500',
            'product_categorie_id' => 'required|exists:product_categories,id',
            'umbral_unit_id' => 'required|exists:units,id',
            'price_general' => 'required|numeric|min:0',
            'specifications' => 'nullable|string|max:255',
            'brand' => 'nullable|string|max:255',
        ]);

        // ✅ Generar clave automática segura
        $prefix = strtoupper(substr(preg_replace('/\s+/', '', $validated['title']), 0, 3));
        $nextId = (Product::max('id') ?? 0) + 1;
        $clave = sprintf('%s-%06d', $prefix, $nextId); // Ej: COJ-000231

        $product = Product::create([
            'clave' => $clave,
            'title' => strtoupper($validated['title']),
            'description' => strtoupper($validated['description']),
            'product_categorie_id' => $validated['product_categorie_id'],
            'umbral_unit_id' => $validated['umbral_unit_id'],
            'price_general' => $validated['price_general'],
            'specifications' => $validated['specifications'] ?? null,
            'brand' => $validated['brand'] ?? null,
            'status' => 'pending_validation',
            'created_by' => auth()->id() ?? null,
        ]);

        return response()->json([
            'message' => 'Producto creado rápidamente.',
            'product' => $product
        ], 201);

    } catch (ValidationException $e) {
        return response()->json([
            'error' => true,
            'message' => 'Datos inválidos para creación rápida.',
            'details' => $e->errors(),
        ], 422);
    } catch (Exception $e) {
        return response()->json([
            'error' => true,
            'message' => 'Error al crear el producto rápido.',
            'exception' => $e->getMessage()
        ], 500);
    }
}




}

 /*
    public function update(Request $request, string $id)
    {
        $product = Product::findOrFail($id);

        Log::info("Updating product ID: {$id}", [
            'request_sku' => trim($request->sku),
            'current_sku' => trim($product->sku),
            'is_equal' => strtoupper(trim($request->sku)) === strtoupper(trim($product->sku))
        ]);

        if (strtoupper(trim($request->sku)) !== strtoupper(trim($product->sku))) {
            $is_exist_product = Product::whereRaw('UPPER(TRIM(sku)) = ?', [strtoupper(trim($request->sku))])
                ->where("id", "<>", $id)
                ->first();
            if ($is_exist_product) {
                Log::warning("SKU conflict detected for product ID: {$id}, SKU: {$request->sku}, Conflicting product ID: {$is_exist_product->id}");
                return response()->json([
                    "message" => 403,
                    "message_text" => "El SKU ya existe en otro producto"
                ], 403);
            }
        }

        if (trim($request->clave) !== trim($product->clave)) {
            $is_exist_clave = Product::whereRaw('TRIM(clave) = ?', [trim($request->clave)])
                ->where("id", "<>", $id)
                ->first();
            if ($is_exist_clave) {
                Log::warning("Clave conflict detected for product ID: {$id}, Clave: {$request->clave}, Conflicting product ID: {$is_exist_clave->id}");
                return response()->json([
                    "message" => 403,
                    "message_text" => "La clave ya existe en otro producto"
                ], 403);
            }
        }

        $category = ProductCategorie::find($request->product_categorie_id);
        $isAutomotriz = $category && $category->name === "REFACCIONES AUTOMOTRICES";

        $rules = [
            'title' => 'required|string|max:255',
            'sku' => 'required|string|max:255',
            'description' => 'required|string',
            'price_general' => 'required|numeric|min:0',
            'product_categorie_id' => 'required|exists:product_categories,id',
            'WAREHOUSES_PRODUCT' => 'required|json',
            'producto_imagen' => 'nullable|image|max:2048',
            'umbral' => 'required|integer|min:0',
            'umbral_unit_id' => 'required|exists:units,id',
            'tiempo_de_entrega' => 'required|integer|min:0',
            'clave' => 'required|string|max:255',
            'quantity_warehouse' => 'required|integer|min:0',
        ];

        if ($isAutomotriz) {
            $rules['marca_id'] = 'required|exists:marcas,id';
            $rules['tipo_id'] = 'required|exists:tipos,id';
            $rules['modelo'] = 'required|integer';
            $rules['cilindro'] = 'required|integer';
            $rules['numeroeco'] = 'required|string';
            $rules['placa'] = 'required|string';
        } else {
            $rules['marca_id'] = 'nullable|exists:marcas,id';
            $rules['tipo_id'] = 'nullable|exists:tipos,id';
            $rules['modelo'] = 'nullable|integer';
            $rules['cilindro'] = 'nullable|integer';
            $rules['numeroeco'] = 'nullable|string';
            $rules['placa'] = 'nullable|string';
        }

        $validator = Validator::make($request->all(), $rules);

        if ($validator->fails()) {
            Log::error("Validation failed for product ID: {$id}: " . $validator->errors()->first());
            return response()->json([
                "message" => 422,
                "message_text" => $validator->errors()->first()
            ], 422);
        }

        try {
            return DB::transaction(function () use ($request, $product) {
                if ($request->input('remove_image') == '1' && $product->imagen) {
                    Storage::delete($product->imagen);
                    $product->update(['imagen' => null]);
                    Log::info("Imagen eliminada para producto ID: {$product->id}");
                }

                if ($request->hasFile("producto_imagen")) {
                    if ($product->imagen) {
                        Storage::delete($product->imagen);
                    }
                    $path = Storage::putFile("productos", $request->file("producto_imagen"));
                    $product->update(['imagen' => $path]);
                    Log::info("Imagen actualizada para producto ID: {$product->id}: {$path}");
                }

                $warehousesProduct = json_decode($request->input('WAREHOUSES_PRODUCT'), true);
                if (empty($warehousesProduct)) {
                    throw new Exception("Debe especificar al menos un almacén para el producto.");
                }

                $product->update([
                    "title" => $request->title,
                    "sku" => strtoupper(trim($request->sku)),
                    "price_general" => $request->price_general,
                    "description" => $request->description,
                    "specifications" => $request->specifications,
                    "umbral" => $request->umbral,
                    "umbral_unit_id" => $request->umbral_unit_id,
                    "tiempo_de_entrega" => $request->tiempo_de_entrega,
                    "clave" => $request->clave,
                    "product_categorie_id" => $request->product_categorie_id,
                    "marca_id" => $request->marca_id ?: null,
                    "tipo_id" => $request->tipo_id ?: null,
                    "modelo" => $request->modelo ?: 0,
                    "numeroeco" => $request->numeroeco ?: 0,
                    "placa" => $request->placa ?: null,
                    "cilindro" => $request->cilindro ?: 0,
                    "updated_by" => auth()->id(),
                ]);

                Log::info("Producto actualizado con ID: {$product->id}, SKU: {$product->sku}");

                ProductPriceHistory::create([
                    'product_id' => $product->id,
                    'price_general' => $request->price_general,
                    'specifications' => $request->specifications,
                ]);

                Log::info("Historial de precio registrado para producto ID: {$product->id}");

                foreach ($warehousesProduct as $key => $warehouseProd) {
                    $quantity = $warehouseProd["quantity"] ?? 0;
                    if ($quantity <= 0) {
                        throw new Exception("La cantidad debe ser mayor a 0.");
                    }

                    $warehouseRecord = ProductWarehouse::firstOrCreate(
                        [
                            "product_id" => $product->id,
                            "warehouse" => "Central Aguamilpa",
                        ],
                        [
                            "unit_id" => $warehouseProd["unit"]["id"],
                            "stock" => 0,
                        ]
                    );

                    $warehouseRecord->update(['stock' => $quantity]);
                    Log::info("Stock actualizado para producto ID {$product->id}, almacén Central Aguamilpa: {$quantity}");
                }

                ProductWallet::where('product_id', $product->id)->delete();
                foreach ($warehousesProduct as $key => $warehouseProd) {
                    ProductWallet::create([
                        "product_id" => $product->id,
                        "unit_id" => $warehouseProd["unit"]["id"],
                        "price" => $warehouseProd["price_general"],
                        "area_id" => null,
                        "subarea_id" => null,
                    ]);
                }

                // Verificar bajo stock
                $this->checkLowStock($product);

                return response()->json([
                    "message" => 200,
                    "message_text" => "Producto actualizado correctamente",
                    "product" => ProductResource::make($product->fresh([
                        'umbral_unit:id,name',
                        'product_categories:id,name',
                        'warehouses:id,product_id,unit_id,warehouse,stock',
                        'marca:id,nombre',
                        'tipo:id,nombre'
                    ]))
                ]);
            });
        } catch (Exception $e) {
            Log::error("Error al actualizar producto ID: {$id}: " . $e->getMessage());
            return response()->json([
                "message" => 422,
                "message_text" => $e->getMessage()
            ], 422);
        }
    }
*/