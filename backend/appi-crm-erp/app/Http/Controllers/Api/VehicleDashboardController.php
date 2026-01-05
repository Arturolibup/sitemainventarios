<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Http;
use App\Services\Ai\VehicleAnalyticsService;

class VehicleDashboardController extends Controller
{

    protected string $baseUrl;
    protected string $apiKey;
    protected ?string $agentId;
    protected VehicleAnalyticsService $service;

    public function __construct(VehicleAnalyticsService $service)
    {
        $this->service = $service;
    }

    /* ============================================================
     * 📌 1) CATÁLOGOS COMPLETOS DESDE LA VISTA
     * ============================================================ */
    public function filters()
    {
        $view = DB::table('ai_vehicle_refactions_view');

        return response()->json([
            // =======================
            // ÁREAS
            // =======================
            'areas' => $view->select('area_id as id', 'area_nombre as name')
                ->whereNotNull('area_id')
                ->groupBy('area_id', 'area_nombre')
                ->orderBy('area_nombre')
                ->get(),

            // =======================
            // SUBÁREAS
            // =======================
            'subareas' => $view->select('subarea_id as id', 'subarea_nombre as name', 'area_id')
                ->whereNotNull('subarea_id')
                ->groupBy('subarea_id', 'subarea_nombre', 'area_id')
                ->orderBy('subarea_nombre')
                ->get(),

            // =======================
            // PRODUCTOS
            // =======================
            'products' => $view->select('product_id as id', 'producto_titulo as title', 'marca_refaccion', 'partida')
                ->whereNotNull('product_id')
                ->groupBy('product_id', 'producto_titulo', 'marca_refaccion', 'partida')
                ->orderBy('producto_titulo')
                ->get(),

            // =======================
            // PROVEEDORES
            // =======================
            'providers' => $view->select('proveedor_id as id', 'proveedor_nombre as full_name')
                ->whereNotNull('proveedor_id')
                ->groupBy('proveedor_id', 'proveedor_nombre')
                ->orderBy('proveedor_nombre')
                ->get(),

            // =======================
            // VEHÍCULOS
            // =======================
            'vehicles' => $view->select(
                    'vehicle_id as id',
                    'numero_eco',
                    'vehiculo_placa as placa',
                    'marca_vehiculo',
                    'tipo_vehiculo',
                    'vehiculo_modelo',
                    'vehiculo_cilindro',
                    'color',
                    'estado_actual'
                )
                ->whereNotNull('vehicle_id')
                ->groupBy(
                    'vehicle_id',
                    'numero_eco',
                    'vehiculo_placa',
                    'marca_vehiculo',
                    'tipo_vehiculo',
                    'vehiculo_modelo',
                    'vehiculo_cilindro',
                    'color',
                    'estado_actual'
                )
                ->orderBy('numero_eco')
                ->get(),

            // =======================
            // CATÁLOGOS COMPLEMENTARIOS
            // =======================
            'marcas_refaccion' => $this->distinctField($view, 'marca_refaccion'),
            'marcas_vehiculo' => $this->distinctField($view, 'marca_vehiculo'),
            'tipos_vehiculo' => $this->distinctField($view, 'tipo_vehiculo'),
            'partidas'        => $this->distinctField($view, 'partida'),
            'grupo'           => $this->distinctField($view, 'grupo'),
            'subgrupo'        => $this->distinctField($view, 'subgrupo'),
            'oficios'         => $this->distinctField($view, 'oficio'),
            'categorias'      => $this->distinctField($view, 'categoria_nombre'),
            'modelos'         => $this->distinctField($view, 'vehiculo_modelo'),
            'cilindros'       => $this->distinctField($view, 'vehiculo_cilindro'),
            'colores'         => $this->distinctField($view, 'color'),
            'estados'         => $this->distinctField($view, 'estado_actual'),
        ]);
    }

    private function distinctField($view, $field)
    {
        return $view->select($field)
            ->whereNotNull($field)
            ->groupBy($field)
            ->orderBy($field)
            ->pluck($field);
    }


    /* ============================================================
     * 📌 2) SUMMARY (KPIs + CHARTS)
     * ============================================================ */
    public function summary(Request $request)
    {
        $rows = $this->applyFilters($request, DB::table('ai_vehicle_refactions_view'))->get();

        return [
            'kpis' => [
                'gasto_total' => $rows->sum('amount'),
                'vehiculos_con_refacciones' => $rows->groupBy('vehicle_id')->count(),
                'total_lineas' => $rows->count(),
                'vehiculo_mas_costoso' => $rows
                    ->groupBy('vehicle_id')
                    ->map(fn($g) => [
                        'vehicle_id' => $g->first()->vehicle_id,
                        'numero_eco' => $g->first()->numero_eco,
                        'vehiculo_placa' => $g->first()->vehiculo_placa,
                        'total' => $g->sum('amount')
                    ])
                    ->sortByDesc('total')
                    ->first(),
            ],

            'charts' => [
                // --- Gasto mensual ---
                'monthly' => $rows
                        ->groupBy(function($r){
                            return $r->anio . '-' . $r->mes;
                        })
                        ->map(function($g){
                            return [
                                'anio' => $g->first()->anio,
                                'mes'  => $g->first()->mes,
                                'total_mes' => $g->sum('amount'),
                            ];
                        })
                        ->sortBy('anio')
                        ->sortBy('mes')
                        ->values(),

                // --- Top vehículos ---
                'top_vehicles' => $rows
                    ->groupBy('vehicle_id')
                    ->map(fn($g) => [
                        'numero_eco' => $g->first()->numero_eco,
                        'vehiculo_placa' => $g->first()->vehiculo_placa,
                        'total' => $g->sum('amount'),
                    ])
                    ->sortByDesc('total')
                    ->take(10)
                    ->values(),

                // --- Top áreas ---
                'top_areas' => $rows
                    ->groupBy('area_id')
                    ->map(fn($g) => [
                        'area_nombre' => $g->first()->area_nombre,
                        'total' => $g->sum('amount'),
                    ])
                    ->sortByDesc('total')
                    ->take(10)
                    ->values(),
            ]
        ];
    }


    /* ============================================================
     * 📌 3) TABLAS
     * ============================================================ */
    public function tables(Request $request)
    {
        $rows = $this->applyFilters($request, DB::table('ai_vehicle_refactions_view'))->get();

        return [
            'productos_frecuentes' => $rows
                ->groupBy('product_id')
                ->map(fn($g) => [
                    'producto' => $g->first()->producto,
                    'veces' => $g->count(),
                    'total' => $g->sum('amount'),
                ])
                ->sortByDesc('veces')
                ->take(20)
                ->values(),

            'vehiculos_costosos' => $rows
                ->groupBy('vehicle_id')
                ->map(fn($g) => [
                    'numero_eco' => $g->first()->numero_eco,
                    'vehiculo_placa' => $g->first()->vehiculo_placa,
                    'total' => $g->sum('amount'),
                ])
                ->sortByDesc('total')
                ->take(20)
                ->values()
        ];
    }


    /* ============================================================
     * 📌 4) DETAIL PAGINADO
     * ============================================================ */
    public function detail(Request $request)
    {
        $query = $this->applyFilters($request, DB::table('ai_vehicle_refactions_view'));

        return $query->paginate($request->get('per_page', 20));
    }


    /* ============================================================
     * 📌 5) INSIGHTS IA
     * ============================================================ */
    public function aiInsights(Request $request)
    {
        $rows = $this->applyFilters($request, DB::table('ai_vehicle_refactions_view'))->select(
            'producto',
                'marca_refaccion',
                'partida',
                'grupo',
                'subgrupo',
                'oficio',
                'numero_eco',
                'vehiculo_placa',
                'marca_vehiculo',
                'tipo_vehiculo',
                'area_nombre',
                'subarea_nombre',
                'cantidad',
                'amount',
                'fecha_op',
                'anio',
                'mes'
            )
            ->limit(200) // evitar exceso de tokens
            ->get();
        

        $prompt = "
        Realiza un análisis técnico de consumo de refacciones vehiculares con base en el siguiente dataset.
        Considera tendencias, áreas, subáreas, vehículos, partidas, proveedores y productos frecuentes.

        Dataset:
        " . json_encode($rows, JSON_PRETTY_PRINT);

        try {

        $response = Http::timeout(25)
            ->withHeaders([
                'Authorization' => 'Bearer ' . env('OPENAI_API_KEY'),
            ])
            ->post('https://api.openai.com/v1/chat/completions', [
                'model' => 'gpt-4o-mini',
                'messages' => [
                    ['role' => 'system', 'content' => self::PROMPT_GOBIERNO],
                    ['role' => 'user', 'content' => $prompt],
                ],
                'max_tokens' => 600,
                'temperature' => 0.4,
            ]);

        if (!$response->successful()) {
            Log::error('[Vehicle IA] Error OpenAI: ' . $response->body());
            return response()->json([
                'error' => 'No se pudo obtener el análisis IA'
            ], 500);
        }

        $content = data_get($response->json(), 'choices.0.message.content', '');

        return response()->json([
            'analysis' => $content
        ]);

    } catch (\Throwable $e) {
        Log::error('[Vehicle IA] Exception: ' . $e->getMessage());
        return response()->json([
            'error' => 'Error interno al procesar IA'
        ], 500);
    }
}
    private const PROMPT_GOBIERNO = "
        Actúa como analista experto del sector público.
        Lenguaje estrictamente institucional: servicio público, consumo, asignaciones presupuestarias y continuidad operativa.
        Prohibido todo término comercial.
        Analiza los datos y responde en exactamente 6 apartados:

        Contexto
        Hallazgos por área
        Riesgos operativos
        Patrones y anomalías
        Recomendaciones técnicas
        Conclusión ejecutiva
        Máximo 10 líneas totales. Sé conciso, técnico y orientado a decisión pública inmediata.
    ";


    /* ============================================================
     * 📌 6) EXPORT PDF
     * ============================================================ */
    public function exportPdf(Request $request)
    {
        return $this->service->exportPdf($request->all());
    }


    /* ============================================================
     * 📌 7) FILTROS (NÚCLEO)
     * ============================================================ */
    private function applyFilters(Request $r, $query)
    {
        // MAPA: Angular → Vista SQL
        $map = [
            'area'            => 'area_nombre',
            'subarea'         => 'subarea_nombre',
            'producto'        => 'producto',
            'proveedor_nombre'=> 'proveedor_nombre',
            'marca_refaccion' => 'marca_refaccion',
            'marca_vehiculo'  => 'marca_vehiculo',
            'tipo_vehiculo'   => 'tipo_vehiculo',
            'numero_eco'      => 'numero_eco',
            'partida'         => 'partida',
            'grupo'           => 'grupo',
            'subgrupo'        => 'subgrupo',
            'oficio'          => 'oficio',
            'categoria_nombre'=> 'categoria_nombre'
        ];

        foreach ($map as $input => $column) {
            if ($value = $r->get($input)) {
                $query->where($column, 'LIKE', "%$value%");
            }
        }

        // Fechas
        if ($r->fecha_desde) {
            $query->whereDate('fecha_op', '>=', $r->fecha_desde);
        }
        if ($r->fecha_hasta) {
            $query->whereDate('fecha_op', '<=', $r->fecha_hasta);
        }

        // Año / mes
        if ($r->anio) {
            $query->where('anio', $r->anio);
        }
        if ($r->mes) {
            $query->where('mes', $r->mes);
        }

        // Rangos de importe
        if ($r->importe_min) {
            $query->where('amount', '>=', $r->importe_min);
        }
        if ($r->importe_max) {
            $query->where('amount', '<=', $r->importe_max);
        }

        return $query;
    }
}
