<?php

namespace App\Services\Ai;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Collection;

class AiDataBuilderService
{
    
    
    public function buildGlobalContext(array $filters = []): array
{
    $months = $filters['months'] ?? 12;

    // 1. Consumo mensual desde ai_monthly_consumption (ya incluye área/subárea)
    $consumption = DB::table('ai_monthly_consumption as amc')
        ->leftJoin('subareas as sa', 'sa.id', '=', 'amc.subarea_id')
        ->leftJoin('areas as a', 'a.id', '=', 'sa.area_id') // ← subarea → area
        ->select([
            'amc.product_id',
            'amc.product_name',
            'amc.area_id',
            'a.name as area_name',
            'amc.subarea_id',
            'sa.name as subarea_name',
            'amc.month',
            'amc.total_quantity'
        ])
        ->where('amc.month', '>=', now()->subMonths($months)->format('Y-m-01'))
        ->orderBy('amc.month')
        ->get()
        ->groupBy('product_id');

    // 2. Stock actual
    $stock = DB::table('product_warehouses as pw')
        ->join('products as p', 'p.id', '=', 'pw.product_id')
        ->select([
            'pw.product_id',
            'p.title as product_name',
            DB::raw('SUM(pw.stock) as stock')
        ])
        ->groupBy('pw.product_id')
        ->get()
        ->keyBy('product_id');

    // 3. Salidas por tipo (OFICIO vs REQUISICIÓN) ← SIN exit_type
    $exitsByType = DB::table('product_exits as pe')
        ->leftJoin('requisitions as r', 'r.id', '=', 'pe.requisition_id')
        ->selectRaw("
            CASE 
                WHEN pe.requisition_id IS NOT NULL THEN 'requisicion'
                WHEN pe.requisition_id IS NULL AND pe.reference != '' THEN 'oficio'
                ELSE 'desconocido'
            END as tipo_salida,
            COUNT(pe.id) as count,
            SUM(pe.quantity) as qty
        ")
        ->where('pe.exit_date', '>=', now()->subMonths($months))
        ->groupBy('tipo_salida')
        ->get()
        ->keyBy('tipo_salida');

    return [
        'periodo_analisis' => "Últimos $months meses",
        'consumo_mensual' => $consumption->map(function ($group) {
            return $group->pluck('total_quantity', 'month')->toArray();
        })->toArray(),
        'stock_actual' => $stock->pluck('stock', 'product_id')->toArray(),
        'salidas_por_tipo' => [
            'requisicion' => $exitsByType['requisicion']->qty ?? 0,
            'oficio' => $exitsByType['oficio']->qty ?? 0,
            'desconocido' => $exitsByType['desconocido']->qty ?? 0,
        ],
        'total_productos' => $consumption->count(),
        'total_areas' => DB::table('areas')->count(),
        'total_subareas' => DB::table('subareas')->count(),
        'regla_salidas' => 'requisicion_id NOT NULL → requisición | reference NOT NULL → oficio',
    ];
}

public function buildRequisitionContext(int $requisitionId): array
{
    Log::info("AI BUILD: Iniciando análisis para requisición #{$requisitionId}");

    $requisition = DB::table('requisitions')->where('id', $requisitionId)->first();
    if (!$requisition) {
        Log::warning("AI BUILD: Requisición #{$requisitionId} no encontrada");
        return [];
    }

    // 1. OBTENER ÍTEMS DE LA REQUISICIÓN CON STOCK ACTUAL
    $items = DB::table('requisition_items as ri')
        ->join('products as p', 'p.id', '=', 'ri.product_id')
        ->leftJoin(DB::raw('(
            SELECT product_id, SUM(stock) as total_stock 
            FROM product_warehouses 
            GROUP BY product_id
        ) as w'), 'w.product_id', '=', 'p.id')
        ->select(
            'ri.id as requisition_item_id',        // ← CLAVE PARA MAPEAR EN FRONTEND
            'ri.product_id',
            'p.title as product_name',
            'ri.requested_qty',
            'ri.approved_qty',
            DB::raw('COALESCE(w.total_stock, 0) as current_stock')
        )
        ->where('ri.requisition_id', $requisitionId)
        ->get();

    if ($items->isEmpty()) {
        Log::info("AI BUILD: No se encontraron ítems para requisición #{$requisitionId}");
        return ['type' => 'requisition', 'requisition_id' => $requisitionId, 'items' => collect()];
    }

    Log::info("AI BUILD: Ítems encontrados", [
        'count' => $items->count(),
        'products' => $items->pluck('product_name')->toArray()
    ]);

    $productIds = $items->pluck('product_id')->toArray();

    // 2. CONSUMO REAL: INCLUYE REQUISICIONES OFICIALES + OFICIOS DE LA MISMA SUBÁREA
$consumption = DB::table('exit_products as ep')
    ->join('product_exits as pe', 'ep.product_exit_id', '=', 'pe.id')
    ->leftJoin('requisitions as r', 'pe.requisition_id', '=', 'r.id')
    ->whereIn('ep.product_id', $productIds)
    ->where('pe.exit_date', '>=', now()->subMonths(18)->startOfMonth())
    ->whereNull('pe.deleted_at')
    ->where(function ($query) use ($requisition) {
        // Caso 1: Salida por requisición oficial → debe ser de la misma subárea
        $query->orWhere(function ($q) use ($requisition) {
            $q->whereNotNull('pe.requisition_id')
              ->where('r.subarea_id', $requisition->subarea_id);
        })
        // Caso 2: Salida por oficio → debe tener el mismo subarea_id que la requisición actual
        ->orWhere(function ($q) use ($requisition) {
            $q->whereNull('pe.requisition_id')
              ->where('pe.reference', '!=', '')
              ->where('pe.subarea_id', $requisition->subarea_id); // ← CAMPO QUE DEBE EXISTIR EN product_exits
        });
    })
    ->selectRaw('
        ep.product_id,
        MONTH(pe.exit_date) as mes,
        YEAR(pe.exit_date) as año,
        SUM(ep.quantity) as total,
        SUM(CASE WHEN pe.requisition_id IS NOT NULL THEN ep.quantity ELSE 0 END) as qty_requisicion,
        SUM(CASE WHEN pe.requisition_id IS NULL AND pe.reference != "" THEN ep.quantity ELSE 0 END) as qty_oficio
    ')
    ->groupBy('ep.product_id', 'mes', 'año')
    ->get()
    ->groupBy('product_id');

    Log::info("AI BUILD: Consumo histórico calculado", ['productos_con_datos' => $consumption->keys()->toArray()]);

    // 3. ENRIQUECER CADA ÍTEM CON DATOS HISTÓRICOS
    $now = now();
    $items = $items->map(function ($item) use ($consumption, $now) {
        $productId = $item->product_id;
        $data = $consumption[$productId] ?? collect();

        $prev = [];
        for ($i = 1; $i <= 3; $i++) {
            $date = $now->copy()->subMonths($i);
            $record = $data->where('mes', $date->month)->where('año', $date->year)->first();
            $prev["prev_month_$i"] = $record?->total ?? 0;
        }

        // Datos clave para IA
        $prev['qty_requisicion'] = $data->sum('qty_requisicion');
        $prev['qty_oficio']       = $data->sum('qty_oficio');
        $prev['total_requisicion'] = $data->sum('total_requisicion');
        $prev['total_oficio']      = $data->sum('total_oficio');


        // AQUÍ ESTÁ LA CLAVE: AGREGAMOS unit_name Y unit_id
    $unitInfo = DB::table('units')
        ->where('id', $item->unit_id ?? 0)
        ->select('id', 'name')
        ->first();

        $unitName = $unitInfo?->name ?? 'UNIDAD';

        // Log especial para HOJA TAMAÑO CARTA (product_id = 15)
        if ($productId == 15) {
            Log::info("AI BUILD: HOJA TAMAÑO CARTA (ID 15)", [
                'prev_month_1' => $prev['prev_month_1'],
                'qty_oficio'   => $prev['qty_oficio'],
                'qty_requisicion' => $prev['qty_requisicion']
            ]);
        }

        return (object) array_merge((array) $item, $prev, [
        'unit_id' => $item->unit_id ?? null,
        'unit_name' => $unitName
        ]);
    });

    Log::info("AI BUILD: Contexto final listo para IA", ['items_count' => $items->count()]);

    return [
        'type' => 'requisition',
        'requisition_id' => $requisitionId,
        'items' => $items
    ];
}

    public function buildChatContext(array $filters = []): array
    {
        $insights = DB::table('ai_insights')
            ->select('type', 'summary', 'details', 'created_at')
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        return [
            'type' => 'chat',
            'insights_recientes' => $insights,
        ];
    }

    /**
     * 🔹 Contexto de un área específica (resumen por área)
     */
    public function buildAreaReportContext(int $areaId): array
    {
        $data = DB::table('ai_monthly_consumption')
            ->where('area_id', $areaId)
            ->select('product_name', 'month', 'total_quantity')
            ->orderBy('month')
            ->get();

        return [
            'type' => 'area_report',
            'area_id' => $areaId,
            'dataset' => $data,
        ];
    }

    
    

   

    
    
}





/*
public function buildRequisitionContex(int $requisitionId): array
{
    $requisition = DB::table('requisitions')->where('id', $requisitionId)->first();
    if (!$requisition) return [];

    $items = DB::table('requisition_items as ri')
        ->join('products as p', 'p.id', '=', 'ri.product_id')
        ->leftJoin(DB::raw('(
            SELECT product_id, SUM(stock) as total_stock 
            FROM product_warehouses 
            GROUP BY product_id
        ) as w'), 'w.product_id', '=', 'p.id')
        ->select(
            'ri.id as requisition_item_id',
            'ri.product_id',
            'p.title as product_name',
            'ri.requested_qty',
            'ri.approved_qty',
            DB::raw('COALESCE(w.total_stock, 0) as current_stock')
        )
        ->where('ri.requisition_id', $requisitionId)
        ->get();

    $productIds = $items->pluck('product_id')->toArray();

    // === CONSUMO REAL: REQUISICIONES + OFICIOS + TIPO ===
    $consumption = DB::table('exit_products as ep')
        ->join('product_exits as pe', 'ep.product_exit_id', '=', 'pe.id')
        ->whereIn('ep.product_id', $productIds)
        ->where('pe.exit_date', '>=', now()->subMonths(12)->startOfMonth())
        ->whereNull('pe.deleted_at')
        ->selectRaw('
            ep.product_id,
            MONTH(pe.exit_date) as mes,
            YEAR(pe.exit_date) as año,
            SUM(ep.quantity) as total,
            COUNT(CASE WHEN pe.requisition_id IS NOT NULL THEN 1 END) as salidas_requisicion,
            COUNT(CASE WHEN pe.requisition_id IS NULL AND pe.reference != "" THEN 1 END) as salidas_oficio,
            SUM(CASE WHEN pe.requisition_id IS NOT NULL THEN ep.quantity ELSE 0 END) as qty_requisicion,
            SUM(CASE WHEN pe.requisition_id IS NULL AND pe.reference != "" THEN ep.quantity ELSE 0 END) as qty_oficio
        ')
        ->groupBy('ep.product_id', 'mes', 'año')
        ->get()
        ->groupBy('product_id');

    $now = now();
    $items = $items->map(function ($item) use ($consumption, $now) {
        $productId = $item->product_id;
        $data = $consumption[$productId] ?? collect();

        $months = [];
        for ($i = 1; $i <= 3; $i++) {
            $monthNum = $now->copy()->subMonths($i)->month;
            $year = $now->copy()->subMonths($i)->year;
            $record = $data->where('mes', $monthNum)->where('año', $year)->first();
            $months["prev_month_$i"] = $record?->total ?? 0;
        }

        // === AQUÍ ESTÁ LO QUE FALTABA ===
        $months['qty_requisicion'] = $data->sum('qty_requisicion');
        $months['qty_oficio'] = $data->sum('qty_oficio');
        $months['total_requisicion'] = $data->sum('salidas_requisicion');
        $months['total_oficio'] = $data->sum('salidas_oficio');

        return (object) array_merge((array)$item, $months);
    });

    return [
        'type' => 'requisition',
        'requisition_id' => $requisitionId,
        'items' => $items
    ];
}
*/
/*
 * 🔹 Contexto de una requisición específica
 
public function buildRequisitionContext(int $requisitionId): array
{
    Log::info('AiDataBuilderService RECARGADO: ' . now() . ' - Requisición #' . $requisitionId);
    
    $requisition = DB::table('requisitions')->where('id', $requisitionId)->first();
    if (!$requisition) {
        Log::warning("Requisition #$requisitionId not found.");
        return [];
    }

    // Ítems + stock total
    $items = DB::table('requisition_items as ri')
    ->join('products as p', 'p.id', '=', 'ri.product_id')
    ->leftJoin(DB::raw('(
        SELECT product_id, SUM(stock) as total_stock 
        FROM product_warehouses 
        GROUP BY product_id
    ) as w'), 'w.product_id', '=', 'p.id')
    ->select(
        'ri.id as requisition_item_id',
        'ri.product_id',
        'p.title as product_name',
        'ri.requested_qty',
        'ri.approved_qty',
        DB::raw('COALESCE(w.total_stock, 0) as current_stock'),
        'p.price_general',
        'p.product_categorie_id',
        'p.source'
    )
    ->where('ri.requisition_id', $requisitionId)
    ->groupBy([
        'ri.id',
        'ri.product_id', 
        'p.title',
        'ri.requested_qty',
        'ri.approved_qty',
        'w.total_stock',
        'p.price_general',
        'p.product_categorie_id',
        'p.source'
    ])
    ->get();

    $productIds = $items->pluck('product_id')->toArray();

    $historical = DB::table('ai_monthly_consumption')
        ->whereIn('product_id', $productIds)
        ->where('area_id', $requisition->area_id)
        ->select('product_id', 'product_name', 'month', 'total_quantity')
        ->orderBy('month', 'desc')
        ->limit(60)
        ->get();

    return [
        'type' => 'requisition',
        'requisition_id' => $requisitionId,
        'area_id' => $requisition->area_id,
        'subarea_id' => $requisition->subarea_id,
        'requested_by' => $requisition->requested_by,
        'status' => $requisition->status,
        'items' => $items,
        'historical_consumption' => $historical,
    ];
}
*/
    /**
     * 🔹 Contexto general para chat IA (últimos análisis, alertas, etc.)
     */
/*
     * 🔹 Contexto global (consumo histórico total)
     
    public function buildGlobalContext(array $filters = []): array
    {
        //DB::statement("SET sql_mode=(SELECT REPLACE(@@sql_mode,'ONLY_FULL_GROUP_BY',''))");

        $query = DB::table('ai_monthly_consumption')
            ->select(
                'product_id',
                'product_name',
                'area_id',
                'area_name',
                'subarea_id',
                'subarea_name',
                'month',
                'total_quantity'
            )
            ->orderBy('month');

        if (!empty($filters['area_id'])) {
            $query->where('area_id', $filters['area_id']);
        }
        if (!empty($filters['product_id'])) {
            $query->where('product_id', $filters['product_id']);
        }

        $data = $query->get();

        //DB::statement("SET sql_mode=(SELECT CONCAT(@@sql_mode, ',ONLY_FULL_GROUP_BY'))");

        return [
            'type' => 'global',
            'total_registros' => $data->count(),
            'dataset' => $data,
        ];
    }
    */