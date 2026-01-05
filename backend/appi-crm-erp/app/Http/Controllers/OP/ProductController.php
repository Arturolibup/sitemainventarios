<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;
use App\Models\Configuration\ProductCategorie;

class ProductController extends Controller
{
    /**
     * Listar todos los productos, con búsqueda por coincidencia
     */
    public function index(Request $request): JsonResponse
    {
        $query = Product::where('deleted_at', null)
            ->select('id', 'title', 'description', 'sku', 'specifications', 'unit_id', 'price_general as unit_price');

        if ($request->has('query') && !empty($request->query('query'))) {
            $searchTerm = $request->query('query');
            $query->where(function ($q) use ($searchTerm) {
                $q->where('title', 'like', "%$searchTerm%")
                  ->orWhere('description', 'like', "%$searchTerm%")
                  ->orWhere('sku', 'like', "%$searchTerm%")
                  ->orWhere('specifications', 'like', "%$searchTerm%");
            });
        }

        $perPage = $request->input('per_page', 10);
        $page = $request->input('page', 1);
        $products = $query->paginate($perPage, ['*'], 'page', $page);

        Log::info("Productos buscados: " . json_encode($products->items()));
        return response()->json([
            'products' => [
                'data' => $products->items()
            ],
            'total' => $products->total()
        ], 200);
    }

    /**
     * Crear un producto rápidamente
     */
    public function store(Request $request): JsonResponse
    {
        $user = auth('api')->user();
        if (!$user) {
            return response()->json(['message' => 'Usuario no autenticado'], 401);
        }

        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'description' => 'required|string',
            'sku' => 'required|string|unique:products,sku',
            'specifications' => 'nullable|string|max:100',
            'price_general' => 'required|numeric|min:0',
            'umbral' => 'required|integer|min:1',
            'umbral_unit_id' => 'required|exists:units,id',
            'product_categorie_id' => 'required|exists:product_categories,id',
            'marca_id' => 'nullable|exists:marcas,id',
            'tipo_id' => 'nullable|exists:tipos,id',
            'modelo' => 'nullable|string|max:10',
            'numeroeco' => 'nullable|string|max:25',
            'placa' => 'nullable|string|max:25',
            'cilindro' => 'nullable|string|max:20',
            'source' => 'required|string|in:quick-add',
            'WAREHOUSES_PRODUCT' => 'required|json'
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Validación fallida', 'errors' => $validator->errors()], 400);
        }

        DB::beginTransaction();
        try {
            $product = new Product([
                'title' => $request->title,
                'description' => $request->description,
                'sku' => $request->sku,
                'specifications' => $request->specifications,
                'price_general' => round($request->price_general, 2),
                'umbral' => $request->umbral,
                'umbral_unit_id' => $request->umbral_unit_id,
                'product_categorie_id' => $request->product_categorie_id,
                'marca_id' => $request->marca_id,
                'tipo_id' => $request->tipo_id,
                'modelo' => $request->modelo,
                'numeroeco' => $request->numeroeco,
                'placa' => $request->placa,
                'cilindro' => $request->cilindro,
                'created_by' => $user->id,
                'updated_by' => $user->id
            ]);
            $product->save();

            $warehouses = json_decode($request->WAREHOUSES_PRODUCT, true);
            foreach ($warehouses as $warehouse) {
                $product->warehouses()->create([
                    'warehouse_id' => $warehouse['warehouse']['id'],
                    'unit_id' => $warehouse['unit']['id'],
                    'quantity' => $warehouse['quantity'],
                    'price_general' => $warehouse['price_general']
                ]);
            }

            DB::commit();
            return response()->json(['message' => 200, 'data' => $product], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Error al crear el producto', 'errors' => $e->getMessage()], 400);
        }
    }

     
}