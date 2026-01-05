<?php

namespace App\Services\Ai;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Services\Ai\VehicleAnalyticsService;

class VehicleAnalyticsService
{
    
    protected AiAgentService $ai;

    public function __construct(AiAgentService $ai)
    {
        // Guardamos la instancia del agente IA
        $this->ai = $ai;
    }

    /**
     * Construye la consulta base sobre la vista
     */
    protected function buildBaseQuery(array $filters = [])
    {
        $query = DB::table('ai_vehicle_refactions_view as v');

        $this->applyFilters($query, $filters);

        return $query;
    }

    /**
     * FILTROS compatibles 100% con la vista real
     */
    protected function applyFilters($query, array $filters)
    {
        // Fechas
        if (!empty($filters['fecha_desde'])) {
            $query->whereDate('v.fecha_op', '>=', $filters['fecha_desde']);
        }

        if (!empty($filters['fecha_hasta'])) {
            $query->whereDate('v.fecha_op', '<=', $filters['fecha_hasta']);
        }

        // Año / Mes
        if (!empty($filters['anio'])) {
            $query->where('v.anio', $filters['anio']);
        }

        if (!empty($filters['mes'])) {
            $query->where('v.mes', $filters['mes']);
        }

        // Vehículo
        if (!empty($filters['vehicle_id'])) {
            $query->where('v.vehicle_id', $filters['vehicle_id']);
        }

        if (!empty($filters['numero_eco'])) {
            $query->where('v.numero_eco', 'LIKE', "%{$filters['numero_eco']}%");
        }

        if (!empty($filters['vehiculo_placa'])) {
            $query->where('v.vehiculo_placa', 'LIKE', "%{$filters['vehiculo_placa']}%");
        }

        // Área / subárea
        if (!empty($filters['area_id'])) {
            $query->where('v.area_id', $filters['area_id']);
        }

        if (!empty($filters['subarea_id'])) {
            $query->where('v.subarea_id', $filters['subarea_id']);
        }

        // 🔹 Área / subárea por NOMBRE (lo que quieres usar ahora)
        if (!empty($filters['area'])) {
            $query->where('v.area_nombre', 'LIKE', "%{$filters['area']}%");
        }

        if (!empty($filters['subarea'])) {
            $query->where('v.subarea_nombre', 'LIKE', "%{$filters['subarea']}%");
        }

        // Partida
        if (!empty($filters['partida'])) {
            $query->where('v.partida', $filters['partida']);
        }

        // Grupo / Subgrupo
        if (!empty($filters['grupo'])) {
            $query->where('v.grupo', $filters['grupo']);
        }

        if (!empty($filters['subgrupo'])) {
            $query->where('v.subgrupo', $filters['subgrupo']);
        }

        // Producto / descripción
        if (!empty($filters['producto'])) {
            $query->where('v.producto', 'LIKE', "%{$filters['producto']}%");
        }

        if (!empty($filters['descripcion'])) {
            $query->where('v.descripcion', 'LIKE', "%{$filters['descripcion']}%");
        }

        if (!empty($filters['marca_refaccion'])) {
            $query->where('v.marca_refaccion', 'LIKE', "%{$filters['marca_refaccion']}%");
        }

        // Categoría
        if (!empty($filters['product_categorie_id'])) {
            $query->where('v.product_categorie_id', $filters['product_categorie_id']);
        }

        // Marca y tipo vehículo
        if (!empty($filters['marca_vehiculo'])) {
            $query->where('v.marca_vehiculo', 'LIKE', "%{$filters['marca_vehiculo']}%");
        }

        if (!empty($filters['tipo_vehiculo'])) {
            $query->where('v.tipo_vehiculo', 'LIKE', "%{$filters['tipo_vehiculo']}%");
        }

        // Proveedor
        if (!empty($filters['proveedor_id'])) {
            $query->where('v.proveedor_id', $filters['proveedor_id']);
        }

        if (!empty($filters['proveedor_nombre'])) {
            $query->where('v.proveedor_nombre', 'LIKE', "%{$filters['proveedor_nombre']}%");
        }

        // 🔹 Rango de precio / importe
        // Front usa "importe_min / importe_max", backend antes "precio_min / precio_max"
        $min = $filters['precio_min'] ?? $filters['importe_min'] ?? null;
        $max = $filters['precio_max'] ?? $filters['importe_max'] ?? null;

        if ($min !== null && $min !== '') {
            $query->where('v.unit_price', '>=', $min);
        }

        if ($max !== null && $max !== '') {
            $query->where('v.unit_price', '<=', $max);
        }
    }

    /**
     * SUMMARY: KPIs + GRÁFICAS
     */
    public function getSummary(array $filters = [])
    {
        $base = $this->buildBaseQuery($filters);

        // KPIs
        $kpis = (clone $base)
            ->selectRaw("
                SUM(amount) AS gasto_total,
                COUNT(DISTINCT vehicle_id) AS vehiculos_con_refacciones,
                COUNT(*) AS total_lineas
            ")
            ->first();

        // Vehículo más costoso
        $vehiculoMasCostoso = (clone $base)
            ->selectRaw("vehicle_id, numero_eco, vehiculo_placa, SUM(amount) AS total")
            ->groupBy('vehicle_id', 'numero_eco', 'vehiculo_placa')
            ->orderByDesc('total')
            ->first();

        // Área de mayor gasto
        $areaMayor = (clone $base)
            ->selectRaw("area_nombre, SUM(amount) AS total")
            ->groupBy('area_nombre')
            ->orderByDesc('total')
            ->first();

        // Series mensuales
        $monthly = (clone $base)
            ->selectRaw("anio, mes, SUM(amount) AS total_mes")
            ->groupBy('anio', 'mes')
            ->orderBy('anio')
            ->orderBy('mes')
            ->get();

        // Top vehículos
        $topVehicles = (clone $base)
            ->selectRaw("numero_eco, vehiculo_placa, SUM(amount) AS total")
            ->groupBy('numero_eco', 'vehiculo_placa')
            ->orderByDesc('total')
            ->limit(10)
            ->get();

        // Top áreas
        $topAreas = (clone $base)
            ->selectRaw("area_nombre, SUM(amount) AS total")
            ->groupBy('area_nombre')
            ->orderByDesc('total')
            ->limit(10)
            ->get();

        return [
            'filters_applied' => $filters,
            'kpis' => [
                'gasto_total' => (float) ($kpis->gasto_total ?? 0),
                'vehiculos_con_refacciones' => (int) ($kpis->vehiculos_con_refacciones ?? 0),
                'total_lineas' => (int) ($kpis->total_lineas ?? 0),
                'vehiculo_mas_costoso' => $vehiculoMasCostoso,
                'area_mayor_gasto' => $areaMayor,
            ],
            'charts' => [
                'monthly' => $monthly,
                'top_vehicles' => $topVehicles,
                'top_areas' => $topAreas,
            ],
        ];
    }

    /**
     * TABLAS extra
     */
    public function getTables(array $filters = [])
    {
        $base = $this->buildBaseQuery($filters);

        return [
            'productos_frecuentes' => (clone $base)
                ->selectRaw("producto, COUNT(*) AS veces, SUM(amount) AS total")
                ->groupBy('producto')
                ->orderByDesc('veces')
                ->limit(50)
                ->get(),

            'vehiculos_costosos' => (clone $base)
                ->selectRaw("numero_eco, vehiculo_placa, SUM(amount) AS total")
                ->groupBy('numero_eco', 'vehiculo_placa')
                ->orderByDesc('total')
                ->limit(50)
                ->get(),
        ];
    }

    /**
     * DETALLE PAGINADO
     */
    public function getDetail(array $filters = [], int $page = 1, int $perPage = 20)
    {
        return $this->buildBaseQuery($filters)
            ->orderByDesc('fecha_op')
            ->paginate($perPage, ['*'], 'page', $page);
    }

    /**
     * INSIGHTS IA
     */
    public function getAiInsights(array $filters = [])
    {
        $summary = $this->getSummary($filters);
        return $this->ai->handleVehicleDashboardInsights($filters, $summary);
    }

    /**
     * PDF (placeholder)
     */
    public function exportPdf(array $filters = [])
    {
        return response()->json([
            'status' => 'PDF pending',
            'filters' => $filters
        ]);
    }
}