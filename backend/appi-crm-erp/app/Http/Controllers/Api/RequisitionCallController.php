<?php

namespace App\Http\Controllers\Api;
use Throwable;
use Carbon\Carbon;

use Illuminate\Http\Request;
use App\Models\Product\Product;
use App\Models\Configuration\Unit;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\Controller;
use App\Models\Product\EntryProduct;
use App\Models\Product\ProductWarehouse;
use App\Models\Requisition\Requisition;
use App\Models\Requisition\RequisitionCall;
use App\Models\Requisition\RequisitionCallProduct;
use App\Models\Requisition\RequisitionCallService;


class RequisitionCallController extends Controller
{
    protected RequisitionCallService $service;

    public function __construct(RequisitionCallService $service)
    {
        $this->service = $service;
    }

   

    public function index(Request $request)
    {
        $calls = RequisitionCall::query()
            ->withCount('products')
            ->with(['generalRequisition' => function ($q) {
                // Solo traemos los campos que necesitamos
                $q->select('id', 'requisition_call_id');
            }])
            ->leftJoin('requisitions as gr', function ($join) {
                $join->on('gr.requisition_call_id', '=', 'requisition_calls.id')
                    ->where('gr.type', '=', 'general');
            })
            ->orderByRaw('gr.id IS NULL DESC')
            ->orderByDesc('requisition_calls.created_at')
            ->orderByDesc('requisition_calls.year')
            ->orderByDesc('requisition_calls.month')
            ->paginate($request->get('per_page', 20));

        // 🔹 Transformar los datos dentro del paginador
        $calls->getCollection()->transform(function ($call) {
            return [
                'id' => $call->id,
                'year' => $call->year,
                'month' => $call->month,
                'title' => $call->title,
                'open_at' => $call->open_at,
                'close_at' => $call->close_at,
                'is_active' => (bool) $call->is_active,
                'notes' => $call->notes,
                'products_count' => $call->products_count,
                // ✅ Aquí añadimos el ID de la requisición base
                'general_requisition_id' => $call->generalRequisition->id ?? null,
                'created_at' => $call->created_at,
                'updated_at' => $call->updated_at,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $calls
        ]);
    }


    /**
     * Crear una nueva convocatoria
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'year' => 'required|integer',
            'month' => 'required|integer|min:1|max:12',
            'open_at' => 'required|date',
            'close_at' => 'required|date|after_or_equal:open_at',
            'is_active' => 'boolean',
            'products' => 'array|required|min:1',
            'products.*.product_id' => 'required|exists:products,id',
            'products.*.unit' => 'nullable|string'
        ]);

        $call = RequisitionCall::create([
            'title' => strtoupper($validated['title']),
            'year' => $validated['year'],
            'month' => $validated['month'],
            'open_at' => $validated['open_at'],
            'close_at' => $validated['close_at'],
            'is_active' => $validated['is_active'] ?? true,
            'created_by' => auth()->id(),
        ]);

        // 🔹 Guardar productos con unidad
        foreach ($validated['products'] as $index => $p) {
            $unitId = null;

            // Buscar el ID de unidad si viene el nombre
            if (!empty($p['unit'])) {
                $unitId = Unit::where('name', $p['unit'])->value('id');
            }

            RequisitionCallProduct::create([
                'requisition_call_id' => $call->id,
                'product_id' => $p['product_id'],
                'default_unit_id' => $unitId,
                'is_enabled' => true,
                'sort_order' => $index,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Convocatoria creada correctamente',
            'data' => $call->load('products.product.unit'),
        ]);
    }

    public function show(int $id)
    {
        // Cargamos products->product y products->unit (si existe default_unit)
        $call = RequisitionCall::with(['products.product', 'products.unit'])->findOrFail($id);

        // Replicar la lógica de searchProducts() para cada producto de la convocatoria
        foreach ($call->products as $item) {
            $productId = $item->product_id;

            // Buscar registro en almacén específico (igual que en searchProducts)
            $warehouseRecord = ProductWarehouse::with(['unit' => fn($q) => $q->select('id', 'name')])
                ->where('product_id', $productId)
                ->where('warehouse', 'Central Aguamilpa')
                ->first();

            $stock = $warehouseRecord ? (int)$warehouseRecord->stock : 0;

            // Última entrada del producto (para entry_id e invoice_number)
            $latestEntry = EntryProduct::where('product_id', $productId)
                ->with(['productEntry'])
                ->orderBy('created_at', 'desc')
                ->first();

            // —— Campos calculados que necesita el front en edición —— //
            // stock y stock_global
            $item->stock         = $stock;
            $item->stock_global  = $stock;

            // unidad (mismo nombre que usamos en searchProducts)
            $item->unit_name = $warehouseRecord && $warehouseRecord->unit
                ? $warehouseRecord->unit->name
                : 'unidad';

            // entry_id e invoice_number (si existieran)
            $item->entry_id = $latestEntry ? $latestEntry->id : null;
            $item->invoice_number = ($latestEntry && $latestEntry->productEntry)
                ? $latestEntry->productEntry->invoice_number
                : null;
        }

        return response()->json([
            'success' => true,
            'data' => $call
        ]);
    }


    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'title' => 'sometimes|string|max:255',
            'open_at' => 'sometimes|date',
            'close_at' => 'sometimes|date|after:open_at',
            'is_active' => 'sometimes|boolean',
            'notes' => 'nullable|string',
        ]);

        $call = $this->service->updateCall($id, $data);

        return response()->json([
            'success' => true,
            'message' => 'Convocatoria actualizada correctamente.',
            'data' => $call,
        ]);
    }

    public function toggleActive($id)
    {
        $call = \App\Models\RequisitionCall::findOrFail($id);
        $call->is_active = !$call->is_active;
        $call->save();

        return response()->json([
            'success' => true,
            'message' => $call->is_active
                ? 'Convocatoria activada correctamente.'
                : 'Convocatoria cerrada correctamente.',
            'data' => $call
        ]);
    }


    public function syncProducts($id, Request $request)
    {
        $validated = $request->validate([
            'products' => 'array|required|min:1',
            'products.*.product_id' => 'required|exists:products,id',
            'products.*.unit' => 'nullable|string',
            'products.*.default_unit_id' => 'nullable|integer|exists:units,id',
        ]);

        $call = RequisitionCall::findOrFail($id);

        $call->products()->delete(); // limpiar antes de reinsertar

        foreach ($validated['products'] as $index => $p) {
            $unitId = $p['default_unit_id'] ?? null;

            if (!$unitId && !empty($p['unit'])) {
                $unitId = Unit::where('name', $p['unit'])->value('id');
            }

            RequisitionCallProduct::create([
                'requisition_call_id' => $call->id,
                'product_id' => $p['product_id'],
                'default_unit_id' => $unitId,
                'is_enabled' => true,
                'sort_order' => $index,
            ]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Productos sincronizados correctamente.',
            'data' => $call->load('products.product.unit'),
        ]);
    }

    
    public function getActiveCalls()
    {
        $today = now();

        $calls = RequisitionCall::where('is_active', true)
            ->whereDate('open_at', '<=', $today)
            ->whereDate('close_at', '>=', $today)
            ->orderBy('open_at', 'asc')
            ->with('products.product:id,title,sku,price_general')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $calls
        ]);
    }

    public function searchProducts(Request $request)
    {
        $query = trim($request->input('query', ''));

        if (strlen($query) < 2) {
            return response()->json(['products' => []], 200);
        }

        $products = Product::query()
            ->select([
                'products.id as product_id',
                'products.title',
                'products.sku',
                'pw.stock',
                'pw.warehouse',
                'u.name as unit_name'
            ])
            ->join('product_warehouses as pw', function ($join) {
                $join->on('pw.product_id', '=', 'products.id')
                    ->where('pw.warehouse', '=', 'Central Aguamilpa');
            })
            ->leftJoin('units as u', 'u.id', '=', 'pw.unit_id')
            ->where(function ($q) use ($query) {
                $q->where('products.title', 'LIKE', "%{$query}%")
                ->orWhere('products.sku', 'LIKE', "%{$query}%");
            })
            ->where('pw.stock', '>', 0)
            ->orderByDesc('pw.stock')
            ->limit(50)
            ->get();

        return response()->json([
            'products' => $products->map(function ($p) {
                return [
                    'product_id' => $p->product_id,
                    'title' => $p->title,
                    'sku' => $p->sku,
                    'stock' => (int) $p->stock,
                    'stock_global' => (int) $p->stock,
                    'unit' => $p->unit_name ?? 'unidad',
                ];
            })
        ], 200);
    }


// 🔹 Obtener convocatoria activa ( para my-requisition-list)
/*
    public function active(Request $request)
{
    try {
        $year  = $request->integer('year');
        $month = $request->integer('month');

        $query = RequisitionCall::query()
            ->with(['products.product', 'products.unit'])
            ->where('is_active', true);

        if ($year && $month) {
            // 🔹 Filtro por año/mes si se envían
            $query->where('year', $year)->where('month', $month);
        } else {
            // 🔹 Filtro por rango de fechas vigente
            $today = Carbon::today();
            $query->whereDate('open_at', '<=', $today)
                  ->whereDate('close_at', '>=', $today);
        }

        // 🟢 Traer todas las activas (no solo la primera)
        $calls = $query->orderByDesc('year')->orderByDesc('month')->get();

        if ($calls->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'No hay convocatorias activas en este momento.'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $calls
        ]);
    } catch (Throwable $th) {
        Log::error('❌ Error en RequisitionCallController@active: ' . $th->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Error al obtener convocatorias activas',
            'error'   => $th->getMessage()
        ], 500);
    }
}
*/

// 🔹 Obtener convocatorias activas (para my-requisitions-list)
public function active(Request $request)
{
    try {
        $year  = $request->integer('year');
        $month = $request->integer('month');

        $query = RequisitionCall::query()
            ->with(['products.product', 'products.unit'])
            ->where('is_active', true);

        if ($year && $month) {
            $query->where('year', $year)->where('month', $month);
        } else {
            $today = Carbon::today();
            $query->whereDate('open_at', '<=', $today)
                  ->whereDate('close_at', '>=', $today);
        }

        $calls = $query->orderByDesc('year')->orderByDesc('month')->get();

        if ($calls->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'No hay convocatorias activas en este momento.'
            ], 404);
        }

        // 🔹 AÑADIR general_requisition_id a cada convocatoria
        $callsWithBase = $calls->map(function ($call) {
            $base = Requisition::where('requisition_call_id', $call->id)
                ->where('type', 'general')
                ->whereNull('deleted_at')
                ->first();

            return [
                'id' => $call->id,
                'title' => $call->title,
                'month' => $call->month,
                'year' => $call->year,
                'open_at' => $call->open_at,
                'close_at' => $call->close_at,
                'products' => $call->products,
                'general_requisition_id' => $base?->id ?? null, // ← NUEVO
                'has_base' => !is_null($base), // ← OPCIONAL: más claro
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $callsWithBase
        ]);

    } catch (Throwable $th) {
        Log::error('Error en RequisitionCallController@active: ' . $th->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Error al obtener convocatorias activas',
            'error'   => $th->getMessage()
        ], 500);
    }
}




//filtros
public function myRequisitions(Request $request)
{
    $user = auth()->user();

    $q = Requisition::query()
        ->with([
            'call:id,title,month,year,open_at,close_at',
            'area:id,name',
            'subarea:id,name',
        ])
        ->select([
            'requisitions.*',
            'exit_folio',
            'exit_status',
            'exit_pdf_path',
            'exit_generated',
            DB::raw('CONCAT("' . url('storage') . '/", exit_pdf_path) as exit_pdf_url')
        ])
        ->orderByDesc('id');

    // 🔹 FILTROS POR AÑO Y MES
    if ($request->filled('year')) {
        $q->whereHas('call', fn($c) => $c->where('year', (int)$request->year));
    }
    if ($request->filled('month')) {
        $q->whereHas('call', fn($c) => $c->where('month', (int)$request->month));
    }

    // 🔹 FILTRO POR ÁREA/SUBÁREA DEL USUARIO
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

    public function destroy($id)
    {
        $call = RequisitionCall::findOrFail($id);
        $call->delete();

        return response()->json([
            'success' => true,
            'message' => 'Convocatoria eliminada correctamente.'
        ]);
    }


}


 /*
     * Listado de convocatorias (Área 3)
     
    public function index(Request $request)
    {
        $calls = RequisitionCall::query()
            ->withCount('products')
            ->orderByDesc('year')
            ->orderByDesc('month')
            ->paginate($request->get('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $calls
        ]);
    }
    */

    