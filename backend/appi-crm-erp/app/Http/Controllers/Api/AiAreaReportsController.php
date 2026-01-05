<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;

class AiAreaReportsController extends Controller
{
    public function show($areaId)
    {
        try {
            $data = DB::table('product_exits as pe')
                ->join('exit_products as ep', 'ep.product_exit_id', '=', 'pe.id')
                ->join('products as p', 'p.id', '=', 'ep.product_id')
                ->where('pe.area_id', $areaId)
                ->select(
                    DB::raw('MONTH(pe.exit_date) as mes'),
                    DB::raw('SUM(ep.quantity) as total')
                )
                ->groupBy(DB::raw('MONTH(pe.exit_date)'))
                ->orderBy(DB::raw('MONTH(pe.exit_date)'))
                ->get();

            if ($data->isEmpty()) {
                return response()->json(['message' => 'Sin datos para esta área.'], 404);
            }

            return response()->json(['data' => $data]);
        } catch (\Throwable $th) {
            return response()->json(['error' => $th->getMessage()], 500);
        }
    }

    // NUEVO MÉTODO PARA DASHBOARD COMPLETO
    public function dashboard(Request $request)
    {
        try {
            $filters = $this->buildFilters($request);
            
            return response()->json([
                'success' => true,
                'data' => [
                    'kpis' => $this->getKpis($filters),
                    'area_consumption' => $this->getAreaConsumption($filters),
                    'trend_data' => $this->getTrendData($filters),
                    'category_distribution' => $this->getCategoryDistribution($filters),
                    'critical_products' => $this->getCriticalProducts($filters),
                    'recent_orders' => $this->getRecentOrders($filters),
                    'pending_requisitions' => $this->getPendingRequisitions($filters),
                    'inventory_alerts' => $this->getInventoryAlerts($filters)
                ]
            ]);

        } catch (\Throwable $th) {
            return response()->json([
                'success' => false,
                'error' => $th->getMessage()
            ], 500);
        }
    }

    private function buildFilters(Request $request): array
    {
        return [
            'year' => $request->get('year', date('Y')),
            'area_id' => $request->get('area_id'),
            'subarea_id' => $request->get('subarea_id'),
            'category_id' => $request->get('category_id'),
            'product_id' => $request->get('product_id'),
            'date_from' => $request->get('date_from'),
            'date_to' => $request->get('date_to')
        ];
    }

    // KPIs (CORREGIDO: SIN area_id en product_warehouses)
    private function getKpis(array $filters): array
    {
        // KPI 1: Total productos → GLOBAL
        $totalProducts = DB::table('product_warehouses')
            ->whereNull('deleted_at')
            ->sum('stock');

        // KPI 2: Órdenes pendientes → FILTRAR por área del solicitante
        $pendingOrders = DB::table('order_requests')
            ->whereIn('status', ['pending_sf_validation', 'validate_sf', 'pending_warehouse'])
            ->whereNull('deleted_at')
            ->when($filters['area_id'], fn($q) => $q->where('requester_area_id', $filters['area_id']))
            ->count();

        // KPI 3: Requisiciones activas → FILTRAR por área
        $activeRequisitions = DB::table('requisitions')
            ->whereIn('status', ['sent', 'approved'])
            ->whereNull('deleted_at')
            ->when($filters['area_id'], fn($q) => $q->where('area_id', $filters['area_id']))
            ->count();

        // KPI 4: Productos con stock bajo → GLOBAL
        $lowStock = DB::table('products as p')
            ->join('product_warehouses as pw', 'p.id', '=', 'pw.product_id')
            ->whereColumn('pw.stock', '<=', 'p.umbral')
            ->whereNull('p.deleted_at')
            ->whereNull('pw.deleted_at')
            ->count();

        return [
            'total_products' => (int)$totalProducts,
            'pending_orders' => $pendingOrders,
            'active_requisitions' => $activeRequisitions,
            'low_stock' => $lowStock
        ];
    }

    // CONSUMO POR ÁREA
    private function getAreaConsumption(array $filters): array
    {
        $query = DB::table('areas as a')
            ->leftJoin('product_exits as pe', function($join) use ($filters) {
                $join->on('a.id', '=', 'pe.area_id')
                    ->whereNull('pe.deleted_at');
                
                if ($filters['year']) {
                    $join->whereYear('pe.exit_date', $filters['year']);
                }
                if ($filters['date_from'] && $filters['date_to']) {
                    $join->whereBetween('pe.exit_date', [$filters['date_from'], $filters['date_to']]);
                }
            })
            ->leftJoin('exit_products as ep', fn($join) => $join->on('pe.id', '=', 'ep.product_exit_id')->whereNull('ep.deleted_at'))
            ->whereNull('a.deleted_at')
            ->select('a.name as area', DB::raw('COALESCE(SUM(ep.quantity), 0) as total_consumo'))
            ->groupBy('a.id', 'a.name')
            ->orderBy('total_consumo', 'DESC');

        if ($filters['area_id']) {
            $query->where('a.id', $filters['area_id']);
        }

        return $query->get()->pluck('total_consumo', 'area')->toArray();
    }

    // TENDENCIA TEMPORAL
    private function getTrendData(array $filters): array
    {
        $query = DB::table('product_exits as pe')
            ->join('exit_products as ep', 'pe.id', '=', 'ep.product_exit_id')
            ->whereNull('pe.deleted_at')
            ->whereNull('ep.deleted_at')
            ->select(
                DB::raw('CONCAT(YEAR(pe.exit_date), "-", LPAD(MONTH(pe.exit_date), 2, "0")) as period'),
                DB::raw('COALESCE(SUM(ep.quantity), 0) as total')
            )
            ->groupBy(DB::raw('YEAR(pe.exit_date), MONTH(pe.exit_date)'))
            ->orderBy(DB::raw('YEAR(pe.exit_date)'), 'ASC')
            ->orderBy(DB::raw('MONTH(pe.exit_date)'), 'ASC');

        if ($filters['area_id']) $query->where('pe.area_id', $filters['area_id']);
        if ($filters['subarea_id']) $query->where('pe.subarea_id', $filters['subarea_id']);
        if ($filters['year']) $query->whereYear('pe.exit_date', $filters['year']);
        if ($filters['date_from'] && $filters['date_to']) {
            $query->whereBetween('pe.exit_date', [$filters['date_from'], $filters['date_to']]);
        }
        if (empty($filters['date_from']) && empty($filters['date_to']) && empty($filters['year'])) {
            $query->where('pe.exit_date', '>=', now()->subMonths(6));
        }

        return $query->get()->toArray();
    }

    // DISTRIBUCIÓN POR CATEGORÍAS
    private function getCategoryDistribution(array $filters): array
    {
        $query = DB::table('product_categories as pc')
            ->leftJoin('products as p', fn($join) => $join->on('pc.id', '=', 'p.product_categorie_id')->whereNull('p.deleted_at'))
            ->leftJoin('exit_products as ep', fn($join) => $join->on('p.id', '=', 'ep.product_id')->whereNull('ep.deleted_at'))
            ->leftJoin('product_exits as pe', function($join) use ($filters) {
                $join->on('ep.product_exit_id', '=', 'pe.id')->whereNull('pe.deleted_at');
                if ($filters['year']) $join->whereYear('pe.exit_date', $filters['year']);
                if ($filters['date_from'] && $filters['date_to']) {
                    $join->whereBetween('pe.exit_date', [$filters['date_from'], $filters['date_to']]);
                }
            })
            ->whereNull('pc.deleted_at')
            ->select('pc.name as category', DB::raw('COALESCE(SUM(ep.quantity), 0) as total'))
            ->groupBy('pc.id', 'pc.name')
            ->having('total', '>', 0)
            ->orderBy('total', 'DESC');

        if ($filters['area_id']) $query->where('pe.area_id', $filters['area_id']);
        if ($filters['subarea_id']) $query->where('pe.subarea_id', $filters['subarea_id']);

        return $query->get()->pluck('total', 'category')->toArray();
    }

    // PRODUCTOS CON STOCK CRÍTICO (SIN area_id)
    private function getCriticalProducts(array $filters): array
    {
        $query = DB::table('products as p')
            ->join('product_warehouses as pw', 'p.id', '=', 'pw.product_id')
            ->join('product_categories as pc', 'p.product_categorie_id', '=', 'pc.id')
            ->whereColumn('pw.stock', '<=', 'p.umbral')
            ->whereNull('p.deleted_at')
            ->whereNull('pw.deleted_at')
            ->whereNull('pc.deleted_at')
            ->select(
                'p.title as product',
                'pc.name as category',
                'pw.stock as current_stock',
                DB::raw('COALESCE(p.umbral, 0) as threshold'),
                DB::raw('(pw.stock - COALESCE(p.umbral, 0)) as difference')
            )
            ->orderBy('difference', 'ASC')
            ->limit(50);

        if ($filters['category_id']) {
            $query->where('p.product_categorie_id', $filters['category_id']);
        }

        // NO FILTRAR POR ÁREA (product_warehouses no tiene area_id)
        // if ($filters['area_id']) { $query->where('pw.area_id', $filters['area_id']); }

        return $query->get()->toArray();
    }

    // ÓRDENES RECIENTES
    private function getRecentOrders(array $filters): array
    {
        $query = DB::table('order_requests as or_')
            ->join('areas as a', 'or_.requester_area_id', '=', 'a.id')
            ->whereNull('or_.deleted_at')
            ->whereNull('a.deleted_at')
            ->select('or_.order_number', 'or_.date', 'or_.status', 'a.name as area', 'or_.total')
            ->orderBy('or_.created_at', 'DESC')
            ->limit(20);

        if ($filters['area_id']) $query->where('or_.requester_area_id', $filters['area_id']);
        if ($filters['date_from'] && $filters['date_to']) {
            $query->whereBetween('or_.date', [$filters['date_from'], $filters['date_to']]);
        }

        return $query->get()->toArray();
    }

    // REQUISICIONES PENDIENTES
    private function getPendingRequisitions(array $filters): array
    {
        $query = DB::table('requisitions as r')
            ->join('areas as a', 'r.area_id', '=', 'a.id')
            ->join('users as u', 'r.requested_by', '=', 'u.id')
            ->whereIn('r.status', ['sent', 'draft'])
            ->whereNull('r.deleted_at')
            ->whereNull('a.deleted_at')
            ->select('r.id', 'a.name as area', 'u.name as requested_by', 'r.status', 'r.requested_at')
            ->orderBy('r.requested_at', 'DESC')
            ->limit(20);

        if ($filters['area_id']) $query->where('r.area_id', $filters['area_id']);

        return $query->get()->toArray();
    }

    // ALERTAS DE INVENTARIO (SIN area_id en product_warehouses)
    private function getInventoryAlerts(array $filters): array
    {
        $query = DB::table('inventory_alerts as ia')
            ->join('products as p', 'ia.product_id', '=', 'p.id')
            ->whereNull('ia.deleted_at')
            ->whereNull('p.deleted_at')
            ->select('ia.message', 'p.title as product_name', 'ia.created_at')
            ->orderBy('ia.created_at', 'DESC')
            ->limit(10);

        // NO FILTRAR POR ÁREA (product_warehouses no tiene area_id)
        // if ($filters['area_id']) {
        //     $query->join('product_warehouses as pw', 'p.id', '=', 'pw.product_id')
        //           ->where('pw.area_id', $filters['area_id'])
        //           ->whereNull('pw.deleted_at');
        // }

        return $query->get()->toArray();
    }

    
}
