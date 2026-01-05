<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class AiGlobalController extends Controller
{
    
/*
public function analyze(Request $request)
{
    try {
        // 🔹 1. Filtros recibidos (del front)
        $year        = $request->input('year', date('Y'));
        $areaId      = $request->input('area_id');
        $subareaId   = $request->input('subarea_id');
        $categoryId  = $request->input('category_id');
        $productId   = $request->input('product_id');

        // 🔹 2. Query base: consumo mensual (enero–diciembre)
        $query = DB::table('exit_products as ep')
            ->join('product_exits as pe', 'pe.id', '=', 'ep.product_exit_id')
            ->join('products as p', 'p.id', '=', 'ep.product_id')
            ->leftJoin('areas as a', 'a.id', '=', 'pe.area_id')
            ->leftJoin('subareas as sa', 'sa.id', '=', 'pe.subarea_id')
            ->select(
                DB::raw('MONTH(pe.exit_date) as mes'),
                DB::raw('SUM(ep.quantity) as total_mes')
            )
            ->whereYear('pe.exit_date', $year)
            ->whereNull('pe.deleted_at')
            ->whereNull('ep.deleted_at')
            ->groupBy(DB::raw('MONTH(pe.exit_date)'))
            ->orderBy(DB::raw('MONTH(pe.exit_date)'));

        // 🔹 3. Aplicar filtros dinámicos
        if ($areaId && $areaId !== 'all') {
            $query->where('pe.area_id', $areaId);
        }
        if ($subareaId && $subareaId !== 'all') {
            $query->where('pe.subarea_id', $subareaId);
        }
        if ($categoryId && $categoryId !== 'all') {
            $query->where('p.product_categorie_id', $categoryId);
        }
        if ($productId && $productId !== 'all') {
            $query->where('p.id', $productId);
        }

        $result = $query->get();

        // 🔹 4. Serie normalizada a 12 meses
        $series = [];
        for ($m = 1; $m <= 12; $m++) {
            $row = $result->firstWhere('mes', $m);
            $series[] = $row ? (int) $row->total_mes : 0;
        }

        $allZero = collect($series)->every(fn ($v) => $v === 0);

        // 🔹 5. Si NO hay datos → respuesta sencilla sin llamar a IA
        if ($allZero) {
            return response()->json([
                'success' => true,
                'data' => [
                    'narrativa_global' => 'No se detecta consumo registrado en el periodo y filtros seleccionados.',
                    'proyeccion_consumo' => [
                        '3_meses'  => [0, 0, 0],
                        '6_meses'  => [0, 0, 0, 0, 0, 0],
                        '12_meses' => array_fill(0, 12, 0),
                    ],
                    'historico_consumo' => $series,
                    'insights' => [],
                    'confianza' => 0.0,
                    'recomendacion_compra' => null,
                    'generated_at' => now()->toIso8601String(),
                ],
            ]);
        }

        // 🔹 6. Contexto adicional para la IA (ayuda a razonar mejor)
        $totalAnual   = array_sum($series);
        $maxMes       = array_search(max($series), $series, true) + 1; // 1–12
        $minMes       = array_search(min($series), $series, true) + 1;
        $mesesConConsumo = collect($series)->filter(fn ($v) => $v > 0)->count();

        $context = [
            'año' => $year,
            'filtros' => [
                'area_id'     => $areaId,
                'subarea_id'  => $subareaId,
                'category_id' => $categoryId,
                'product_id'  => $productId,
            ],
            'serie_mensual' => $series,
            'total_anual'   => $totalAnual,
            'mes_max'       => $maxMes,
            'mes_min'       => $minMes,
            'meses_con_consumo' => $mesesConConsumo,
        ];

        // ==========================================
            // 🔍 Crear DESCRIPCIÓN del objeto analizado
            // ==========================================

            $descripcion = "Análisis general del consumo anual.";

            // Área
            if ($areaId && $areaId !== 'all') {
                $area = DB::table('areas')->where('id', $areaId)->value('name');
                $descripcion = "Análisis del consumo del área: {$area}.";
            }

            // Área + Subárea
            if ($subareaId && $subareaId !== 'all') {
                $sub = DB::table('subareas')->where('id', $subareaId)->value('name');
                $descripcion = "Análisis del consumo de la subárea: {$sub}.";
            }

            // Categoría
            if ($categoryId && $categoryId !== 'all') {
                $cat = DB::table('product_categories')->where('id', $categoryId)->value('name');
                $descripcion = "Análisis de la categoría de productos: {$cat}.";
            }

            // Producto
            if ($productId && $productId !== 'all') {
                $prod = DB::table('products')->where('id', $productId)->value('title');
                $descripcion = "Análisis del producto específico: {$prod}.";
            }

            // Producto + Área
            if ($productId && $areaId && $areaId !== 'all' && $productId !== 'all') {
                $area = DB::table('areas')->where('id', $areaId)->value('name');
                $prod = DB::table('products')->where('id', $productId)->value('title');

                $descripcion = "Análisis del consumo del producto {$prod} en el área {$area}.";
            }


        // 🔹 7. PROMPT NUEVO: pedimos proyección + recomendación de compra
        $prompt = "
            Eres un analista experto en consumo de inventarios institucionales.
            
            Usa la siguiente serie de consumo mensual (enero–diciembre) y el contexto
            para:

            1) Detectar picos, anomalías y estacionalidad.
            2) Calcular una proyección de consumo para 3, 6 y 12 meses.
            3) Sugerir una recomendación de compra (cantidad y mes recomendado),
            suponiendo que se quiere evitar quiebres de stock y mantener un
            nivel de seguridad razonable.
            4) Devolver una medida de confianza entre 0.0 y 1.0.
            5) Proponer de 1 a 5 insights ejecutivos clave.

            IMPORTANTE: Omite las palabras, venta, ingresos, ganancia y cualquier palabra de ambito publico
            ya que somos una institucion de gobierno y Responde ÚNICAMENTE un JSON VÁLIDO con **este formato EXACTO**:

            {
            \"narrativa_global\": \"texto profesional y breve\",
            \"confianza\": 0.93,
            \"proyeccion_consumo\": {
                \"3_meses\": [100,120,130],
                \"6_meses\": [100,120,130,140,145,150],
                \"12_meses\": [12 valores numericos...]
            },
            \"recomendacion_compra\": {
                \"cantidad_sugerida\": 45,
                \"mes_recomendado\": \"Julio 2025\",
                \"motivo\": \"Texto explicando por qué se recomienda esta compra\"
            },
            \"insights\": [
                {\"summary\": \"Consumo inusualmente alto en abril\", \"severity\": 3}
            ]
            }

            No incluyas nada fuera del JSON (sin comentarios ni markdown).

           Objeto del análisis: {$descripcion}

            Datos de consumo mensual (enero–diciembre):
            " . json_encode($context, JSON_PRETTY_PRINT);

        // 🔹 8. Llamada a OpenAI
        $response = Http::withToken(env('OPENAI_API_KEY'))
            ->timeout(45)
            ->post('https://api.openai.com/v1/chat/completions', [
                'model' => 'gpt-4o-mini',
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'Eres un experto en análisis de datos de consumo institucional. Respondes solo JSON válido.',
                    ],
                    [
                        'role' => 'user',
                        'content' => $prompt,
                    ],
                ],
                'temperature' => 0.25,
            ]);

        if (! $response->successful()) {
            // Fallback si OpenAI falla
            return response()->json([
                'success' => true,
                'data' => [
                    'narrativa_global' => 'No se pudo contactar a la IA. Se muestra únicamente el consumo histórico.',
                    'proyeccion_consumo' => [
                        '3_meses'  => array_slice($series, -3),
                        '6_meses'  => array_slice($series, -6),
                        '12_meses' => $series,
                    ],
                    'historico_consumo' => $series,
                    'insights' => [],
                    'confianza' => 0.0,
                    'recomendacion_compra' => null,
                    'generated_at' => now()->toIso8601String(),
                ],
            ], 200);
        }

        // 🔹 9. Parsear respuesta de OpenAI (limpiando ```json ... ```)
        $rawContent = data_get($response->json(), 'choices.0.message.content', '{}');
        $cleanContent = preg_replace('/```json|```/i', '', $rawContent);
        $decoded = json_decode($cleanContent, true);

        if (json_last_error() !== JSON_ERROR_NONE || ! is_array($decoded)) {
            // Respuesta IA ilegible → fallback
            return response()->json([
                'success' => true,
                'data' => [
                    'narrativa_global' => 'No se pudo interpretar la respuesta IA. Se muestra únicamente el consumo histórico.',
                    'proyeccion_consumo' => [
                        '3_meses'  => array_slice($series, -3),
                        '6_meses'  => array_slice($series, -6),
                        '12_meses' => $series,
                    ],
                    'historico_consumo' => $series,
                    'insights' => [],
                    'confianza' => 0.0,
                    'recomendacion_compra' => null,
                    'generated_at' => now()->toIso8601String(),
                ],
            ], 200);
        }

        // 🔹 10. Normalizar arrays numéricos de proyección
        $normArray = function ($value) {
            if (is_array($value)) {
                return array_map('floatval', $value);
            }
            if (is_object($value)) {
                return array_map('floatval', (array) $value);
            }
            return [];
        };

        $proyRaw = $decoded['proyeccion_consumo'] ?? [];
        $proyeccion = [
            '3_meses'  => $normArray($proyRaw['3_meses']  ?? []),
            '6_meses'  => $normArray($proyRaw['6_meses']  ?? []),
            '12_meses' => $normArray($proyRaw['12_meses'] ?? []),
        ];

        // Si la IA manda vacíos, usamos fallback basado en la serie
        if (! count($proyeccion['3_meses'])) {
            $proyeccion['3_meses'] = array_slice($series, -3);
        }
        if (! count($proyeccion['6_meses'])) {
            $proyeccion['6_meses'] = array_slice($series, -6);
        }
        if (! count($proyeccion['12_meses'])) {
            $proyeccion['12_meses'] = $series;
        }

        // 🔹 11. Recomendación de compra (puede venir null)
        $recomendacion = $decoded['recomendacion_compra'] ?? null;
        if (is_array($recomendacion)) {
            $recomendacion = [
                'cantidad_sugerida' => isset($recomendacion['cantidad_sugerida'])
                    ? (float) $recomendacion['cantidad_sugerida']
                    : null,
                'mes_recomendado' => $recomendacion['mes_recomendado'] ?? null,
                'motivo' => $recomendacion['motivo'] ?? '',
            ];
        } else {
            $recomendacion = null;
        }

        // 🔹 12. Armamos respuesta final para el front
        return response()->json([
            'success' => true,
            'data' => [
                'narrativa_global'    => $decoded['narrativa_global'] ?? 'Análisis completado.',
                'proyeccion_consumo'  => $proyeccion,
                'historico_consumo'   => $series,
                'insights'            => $decoded['insights'] ?? [],
                'confianza'           => isset($decoded['confianza']) ? (float) $decoded['confianza'] : 0.85,
                'recomendacion_compra'=> $recomendacion,
                'generated_at'        => now()->toIso8601String(),
            ],
        ]);

    } catch (\Throwable $th) {
        return response()->json([
            'error'   => true,
            'message' => $th->getMessage(),
        ], 500);
    }
}
    
*/

public function analyze(Request $request)
{
    try {
        // 🔹 1. Filtros recibidos (del front)
        $year        = $request->input('year', date('Y'));
        $areaId      = $request->input('area_id');
        $subareaId   = $request->input('subarea_id');
        $categoryId  = $request->input('category_id');
        $productId   = $request->input('product_id');

        // 🔹 2. Query base: consumo mensual (enero–diciembre)
        $query = DB::table('exit_products as ep')
            ->join('product_exits as pe', 'pe.id', '=', 'ep.product_exit_id')
            ->join('products as p', 'p.id', '=', 'ep.product_id')
            ->leftJoin('areas as a', 'a.id', '=', 'pe.area_id')
            ->leftJoin('subareas as sa', 'sa.id', '=', 'pe.subarea_id')
            ->select(
                DB::raw('MONTH(pe.exit_date) as mes'),
                DB::raw('SUM(ep.quantity) as total_mes')
            )
            ->whereYear('pe.exit_date', $year)
            ->whereNull('pe.deleted_at')
            ->whereNull('ep.deleted_at')
            ->groupBy(DB::raw('MONTH(pe.exit_date)'))
            ->orderBy(DB::raw('MONTH(pe.exit_date)'));

        // 🔹 3. Aplicar filtros dinámicos
        if ($areaId && $areaId !== 'all') {
            $query->where('pe.area_id', $areaId);
        }
        if ($subareaId && $subareaId !== 'all') {
            $query->where('pe.subarea_id', $subareaId);
        }
        if ($categoryId && $categoryId !== 'all') {
            $query->where('p.product_categorie_id', $categoryId);
        }
        if ($productId && $productId !== 'all') {
            $query->where('p.id', $productId);
        }

        $result = $query->get();

        // 🔹 4. Serie normalizada a 12 meses
        $series = [];
        for ($m = 1; $m <= 12; $m++) {
            $row = $result->firstWhere('mes', $m);
            $series[] = $row ? (int) $row->total_mes : 0;
        }

        $allZero = collect($series)->every(fn ($v) => $v === 0);

        // 🔹 5. Si NO hay datos → respuesta sencilla sin llamar a IA
        if ($allZero) {
            return response()->json([
                'success' => true,
                'data' => [
                    'narrativa_global' => 'No se detecta consumo registrado en el periodo y filtros seleccionados.',
                    'proyeccion_consumo' => [
                        '3_meses'  => [0, 0, 0],
                        '6_meses'  => [0, 0, 0, 0, 0, 0],
                        '12_meses' => array_fill(0, 12, 0),
                    ],
                    'historico_consumo' => $series,
                    'insights' => [],
                    'confianza' => 0.0,
                    'recomendacion_compra' => null,
                    'generated_at' => now()->toIso8601String(),
                ],
            ]);
        }

        // 🔹 6. Contexto adicional para la IA (ayuda a razonar mejor)
        $totalAnual   = array_sum($series);
        $maxMesIndex  = array_search(max($series), $series, true); // 0–11
        $maxMes       = $maxMesIndex !== false ? $maxMesIndex + 1 : 1; // 1–12
        $minMesIndex  = array_search(min($series), $series, true);
        $minMes       = $minMesIndex !== false ? $minMesIndex + 1 : 1;
        $mesesConConsumo = collect($series)->filter(fn ($v) => $v > 0)->count();

        // 🔹 7. Cálculo de mes recomendado SIEMPRE FUTURO
        $now           = now();
        $currentYear   = (int) $now->format('Y');
        $currentMonth  = (int) $now->format('n'); // 1–12

        // Usamos el mes de mayor consumo como base (estacionalidad)
        $recommendedMonth = $maxMes;

        // Si ese mes ya pasó en el año actual, saltamos al año siguiente
        $recommendedYear = $currentYear;
        if ($recommendedMonth <= $currentMonth) {
            $recommendedYear++;
        }

        $recommendedMonthLabel = $this->monthNameEs($recommendedMonth) . ' ' . $recommendedYear;

        $context = [
            'año' => $year,
            'filtros' => [
                'area_id'     => $areaId,
                'subarea_id'  => $subareaId,
                'category_id' => $categoryId,
                'product_id'  => $productId,
            ],
            'serie_mensual'         => $series,
            'total_anual'           => $totalAnual,
            'mes_max'               => $maxMes,
            'mes_min'               => $minMes,
            'meses_con_consumo'     => $mesesConConsumo,
            'fecha_actual_servidor' => $now->toDateString(),
            'mes_recomendado_sugerido' => $recommendedMonthLabel,
        ];

        // ==========================================
        // 🔍 Crear DESCRIPCIÓN del objeto analizado
        // ==========================================
        $descripcion = "Análisis general del consumo anual.";

        if ($areaId && $areaId !== 'all') {
            $area = DB::table('areas')->where('id', $areaId)->value('name');
            $descripcion = "Análisis del consumo del área: {$area}.";
        }

        if ($subareaId && $subareaId !== 'all') {
            $sub = DB::table('subareas')->where('id', $subareaId)->value('name');
            $descripcion = "Análisis del consumo de la subárea: {$sub}.";
        }

        if ($categoryId && $categoryId !== 'all') {
            $cat = DB::table('product_categories')->where('id', $categoryId)->value('name');
            $descripcion = "Análisis de la categoría de productos: {$cat}.";
        }

        if ($productId && $productId !== 'all') {
            $prod = DB::table('products')->where('id', $productId)->value('title');
            $descripcion = "Análisis del producto específico: {$prod}.";
        }

        if ($productId && $areaId && $areaId !== 'all' && $productId !== 'all') {
            $area = DB::table('areas')->where('id', $areaId)->value('name');
            $prod = DB::table('products')->where('id', $productId)->value('title');
            $descripcion = "Análisis del consumo del producto {$prod} en el área {$area}.";
        }

        // 🔹 8. PROMPT NUEVO: proyección FUTURA + recomendación de compra
        $prompt = "
Eres un analista experto en consumo de inventarios institucionales.

Usa la siguiente serie de consumo mensual (enero–diciembre) y el contexto
para:

1) Detectar picos, anomalías y estacionalidad.
2) Calcular una PROYECCIÓN DE CONSUMO FUTURA para los próximos 3, 6 y 12 meses
   (no repitas la serie histórica tal cual; estima la demanda futura usando
   los patrones observados, incluyendo estacionalidad).
3) Sugerir una recomendación de compra (cantidad y mes recomendado),
   suponiendo que se quiere evitar quiebres de stock y mantener un
   nivel de seguridad razonable.
4) Devolver una medida de confianza entre 0.0 y 1.0.
5) Proponer de 1 a 5 insights ejecutivos clave.

IMPORTANTE:
- Omite las palabras venta, ingresos, ganancia y cualquier concepto de ámbito privado.
- Somos una institución de gobierno.
- El mes recomendado debe ser SIEMPRE un mes futuro con respecto a la fecha_actual_servidor
  que viene en el JSON de contexto.
- Normalmente debe coincidir con el PRÓXIMO mes en el que se espera mayor consumo,
  por ejemplo: si el pico histórico es en octubre y hoy es diciembre 2025,
  el mes recomendado debe ser \"Octubre 2026\".
- Puedes usar el campo \"mes_recomendado_sugerido\" del contexto como referencia.

Responde ÚNICAMENTE un JSON VÁLIDO con este formato EXACTO:

{
  \"narrativa_global\": \"texto profesional y breve\",
  \"confianza\": 0.93,
  \"proyeccion_consumo\": {
    \"3_meses\": [100,120,130],
    \"6_meses\": [100,120,130,140,145,150],
    \"12_meses\": [12 valores numericos...]
  },
  \"recomendacion_compra\": {
    \"cantidad_sugerida\": 45,
    \"mes_recomendado\": \"Mes Año (por ejemplo: Octubre 2026)\",
    \"motivo\": \"Texto explicando por qué se recomienda esta compra\"
  },
  \"insights\": [
    {\"summary\": \"Consumo inusualmente alto en abril\", \"severity\": 3}
  ]
}

No incluyas nada fuera del JSON (sin comentarios ni markdown).

Objeto del análisis: {$descripcion}

Datos de consumo mensual (enero–diciembre) y contexto:
" . json_encode($context, JSON_PRETTY_PRINT);

        // 🔹 9. Llamada a OpenAI
        $response = Http::withToken(env('OPENAI_API_KEY'))
            ->timeout(45)
            ->post('https://api.openai.com/v1/chat/completions', [
                'model' => 'gpt-4o-mini',
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'Eres un experto en análisis de datos de consumo institucional. Respondes solo JSON válido.',
                    ],
                    [
                        'role' => 'user',
                        'content' => $prompt,
                    ],
                ],
                'temperature' => 0.25,
            ]);

        if (! $response->successful()) {
            // Fallback si OpenAI falla
            return response()->json([
                'success' => true,
                'data' => [
                    'narrativa_global' => 'No se pudo contactar a la IA. Se muestra únicamente el consumo histórico.',
                    'proyeccion_consumo' => [
                        '3_meses'  => array_slice($series, -3),
                        '6_meses'  => array_slice($series, -6),
                        '12_meses' => $series,
                    ],
                    'historico_consumo' => $series,
                    'insights' => [],
                    'confianza' => 0.0,
                    'recomendacion_compra' => null,
                    'generated_at' => now()->toIso8601String(),
                ],
            ], 200);
        }

        // 🔹 10. Parsear respuesta de OpenAI (limpiando ```json ... ```)
        $rawContent   = data_get($response->json(), 'choices.0.message.content', '{}');
        $cleanContent = preg_replace('/```json|```/i', '', $rawContent);
        $decoded      = json_decode($cleanContent, true);

        if (json_last_error() !== JSON_ERROR_NONE || ! is_array($decoded)) {
            // Respuesta IA ilegible → fallback
            return response()->json([
                'success' => true,
                'data' => [
                    'narrativa_global' => 'No se pudo interpretar la respuesta IA. Se muestra únicamente el consumo histórico.',
                    'proyeccion_consumo' => [
                        '3_meses'  => array_slice($series, -3),
                        '6_meses'  => array_slice($series, -6),
                        '12_meses' => $series,
                    ],
                    'historico_consumo' => $series,
                    'insights' => [],
                    'confianza' => 0.0,
                    'recomendacion_compra' => null,
                    'generated_at' => now()->toIso8601String(),
                ],
            ], 200);
        }

        // 🔹 11. Normalizar arrays numéricos de proyección
        $normArray = function ($value) {
            if (is_array($value)) {
                return array_map('floatval', $value);
            }
            if (is_object($value)) {
                return array_map('floatval', (array) $value);
            }
            return [];
        };

        $proyRaw = $decoded['proyeccion_consumo'] ?? [];
        $proyeccion = [
            '3_meses'  => $normArray($proyRaw['3_meses']  ?? []),
            '6_meses'  => $normArray($proyRaw['6_meses']  ?? []),
            '12_meses' => $normArray($proyRaw['12_meses'] ?? []),
        ];

        if (! count($proyeccion['3_meses'])) {
            $proyeccion['3_meses'] = array_slice($series, -3);
        }
        if (! count($proyeccion['6_meses'])) {
            $proyeccion['6_meses'] = array_slice($series, -6);
        }
        if (! count($proyeccion['12_meses'])) {
            $proyeccion['12_meses'] = $series;
        }

        // 🔹 12. Recomendación de compra (ajustando SIEMPRE el mes al futuro)
        $recomendacion = $decoded['recomendacion_compra'] ?? null;
        if (is_array($recomendacion)) {
            $recomendacion = [
                'cantidad_sugerida' => isset($recomendacion['cantidad_sugerida'])
                    ? (float) $recomendacion['cantidad_sugerida']
                    : null,
                // ⚠️ Fuerzo el mes recomendado a la versión FUTURA calculada en PHP
                'mes_recomendado'   => $recommendedMonthLabel,
                'motivo'            => $recomendacion['motivo'] ?? '',
            ];
        } else {
            $recomendacion = null;
        }

        // 1) Identificar las 3 proyecciones futuras más inmediatas
$proy3 = $proyeccion['3_meses'] ?? [];
$proy12 = $proyeccion['12_meses'] ?? [];

// 2) Si por alguna razón la IA devolviera vacíos → fallback
if (count($proy3) < 3 && count($proy12) >= 3) {
    // Tomamos los primeros 3 de los 12 meses
    $proy3 = array_slice($proy12, 0, 3);
}

// 3) Cálculo determinista de cantidad sugerida
$cantidadSugerida = array_sum($proy3);

// 4) Asegurar que el mes recomendado siempre sea FUTURO
$mesRecomendado = $recommendedMonthLabel;

// 5) Armar recomendación final SIN IA (determinista)
$recomendacion = [
    'cantidad_sugerida' => round($cantidadSugerida, 0),
    'mes_recomendado'   => $mesRecomendado,
    'motivo'            => "La cantidad sugerida corresponde a la demanda proyectada para los próximos 3 meses, considerando patrones de consumo históricos y estacionalidad detectada.",
]; 
                           
        // 🔹 13. Respuesta final para el front
        return response()->json([
            'success' => true,
            'data' => [
                'narrativa_global'     => $decoded['narrativa_global'] ?? 'Análisis completado.',
                'proyeccion_consumo'   => $proyeccion,
                'historico_consumo'    => $series,
                'insights'             => $decoded['insights'] ?? [],
                'confianza'            => isset($decoded['confianza']) ? (float) $decoded['confianza'] : 0.85,
                'recomendacion_compra' => $recomendacion,
                'generated_at'         => now()->toIso8601String(),
            ],
        ]);

    } catch (\Throwable $th) {
        return response()->json([
            'error'   => true,
            'message' => $th->getMessage(),
        ], 500);
    }
}


    /**
     * ============================================================
     *  🧠 3) insights() – ranking de productos con monthly_trend
     * ============================================================
     */
    public function insights(Request $request)
    {
        try {
            $year       = $request->input('year', date('Y'));
            $areaId     = $request->input('area_id');
            $subareaId  = $request->input('subarea_id');
            $categoryId = $request->input('category_id');
            $productId  = $request->input('product_id');

            $base = DB::table('exit_products as ep')
                ->join('product_exits as pe', 'pe.id', '=', 'ep.product_exit_id')
                ->join('products as p', 'p.id', '=', 'ep.product_id')
                ->leftJoin('product_categories as pc', 'pc.id', '=', 'p.product_categorie_id')
                ->leftJoin('product_warehouses as pw', 'pw.product_id', '=', 'p.id')
                ->select(
                    'p.id as product_id',
                    'p.title',
                    'p.sku',
                    'p.umbral',
                    'pc.name as categoria',
                    DB::raw('COALESCE(pw.stock, 0) as stock_actual'),
                    DB::raw('ROUND(SUM(ep.quantity)/COUNT(DISTINCT MONTH(pe.exit_date)), 2) as promedio_mensual'),
                    DB::raw('SUM(ep.quantity) as total_anual')
                )
                ->whereYear('pe.exit_date', $year)
                ->whereNull('pe.deleted_at')
                ->whereNull('ep.deleted_at')
                ->groupBy('p.id', 'p.title', 'p.sku', 'p.umbral', 'pc.name', 'pw.stock');

            if ($areaId && $areaId !== 'all') {
                $base->where('pe.area_id', $areaId);
            }
            if ($subareaId && $subareaId !== 'all') {
                $base->where('pe.subarea_id', $subareaId);
            }
            if ($categoryId && $categoryId !== 'all') {
                $base->where('p.product_categorie_id', $categoryId);
            }
            if ($productId && $productId !== 'all') {
                $base->where('p.id', $productId);
            }

            $productos = $base->get();

            if ($productos->isEmpty()) {
                return response()->json([
                    'success' => true,
                    'data'    => [],
                    'message' => 'No se encontraron productos con consumo registrado en el periodo seleccionado.',
                ]);
            }

            foreach ($productos as $p) {
                $mensual = DB::table('exit_products as ep')
                    ->join('product_exits as pe', 'pe.id', '=', 'ep.product_exit_id')
                    ->selectRaw('MONTH(pe.exit_date) as mes, SUM(ep.quantity) as total')
                    ->where('ep.product_id', $p->product_id)
                    ->whereYear('pe.exit_date', $year)
                    ->groupBy(DB::raw('MONTH(pe.exit_date)'))
                    ->orderBy(DB::raw('MONTH(pe.exit_date)'))
                    ->pluck('total', 'mes');

                $trend = [];
                for ($m = 1; $m <= 12; $m++) {
                    $trend[] = (int) ($mensual[$m] ?? 0);
                }
                $p->monthly_trend = $trend;
            }

            $productos = collect($productos)->map(function ($p) {
                $p->umbral     = $p->umbral ?? 0;
                $p->alert      = 'Normal';
                $p->severity   = 1;

                if ($p->stock_actual == 0) {
                    $p->alert    = '🔴 Sin Existencia';
                    $p->severity = 5;
                } elseif ($p->stock_actual <= $p->umbral && $p->umbral > 0) {
                    $p->alert    = '⚠️ Bajo Stock';
                    $p->severity = 4;
                } elseif ($p->stock_actual <= ($p->umbral * 1.5) && $p->umbral > 0) {
                    $p->alert    = '🟠 En Riesgo';
                    $p->severity = 3;
                }

                $p->confidence = 0.96;
                return $p;
            });

            $productos = $productos->sortByDesc('severity')->values();

            return response()->json([
                'success'      => true,
                'data'         => $productos,
                'generated_at' => now()->toDateTimeString(),
            ]);

        } catch (\Throwable $th) {
            return response()->json([
                'success' => false,
                'message' => 'Error interno en análisis IA: ' . $th->getMessage(),
            ], 500);
        }
    }

    /**
 * Calcula nivel de riesgo de stock según umbral.
 */
private function calcularRiesgo($stock, $umbral)
{
    if ($umbral === null || $umbral == 0) return 'Normal';
    if ($stock < $umbral) return 'Crítico';
    if ($stock < ($umbral * 1.5)) return 'Medio';
    return 'Suficiente';
}


/**
 * Devuelve el nombre del mes en español dado un número 1–12.
 */
private function monthNameEs(int $month): string
{
    $names = [
        1  => 'Enero',
        2  => 'Febrero',
        3  => 'Marzo',
        4  => 'Abril',
        5  => 'Mayo',
        6  => 'Junio',
        7  => 'Julio',
        8  => 'Agosto',
        9  => 'Septiembre',
        10 => 'Octubre',
        11 => 'Noviembre',
        12 => 'Diciembre',
    ];

    return $names[$month] ?? 'Mes';
}

}
    
    
    
    
    /*
public function insights(Request $request)
{
    try {
        $year       = $request->input('year', date('Y'));
        $areaId     = $request->input('area_id');
        $subareaId  = $request->input('subarea_id');
        $categoryId = $request->input('category_id');
        $productId  = $request->input('product_id');

        // 🔹 1. Base de productos con JOIN de categoría
        $base = DB::table('exit_products as ep')
            ->join('product_exits as pe', 'pe.id', '=', 'ep.product_exit_id')
            ->join('products as p', 'p.id', '=', 'ep.product_id')
            ->leftJoin('product_categories as pc', 'pc.id', '=', 'p.product_categorie_id') // ← AQUI ESTABA EL PROBLEMA
            ->leftJoin('product_warehouses as pw', 'pw.product_id', '=', 'p.id')
            ->select(
                'p.id as product_id',
                'p.title',
                'p.sku',
                'p.umbral',
                'pc.name as categoria', // ← YA INCLUIDO
                DB::raw('COALESCE(pw.stock, 0) as stock_actual'),
                DB::raw('ROUND(SUM(ep.quantity)/COUNT(DISTINCT MONTH(pe.exit_date)), 2) as promedio_mensual'),
                DB::raw('SUM(ep.quantity) as total_anual')
            )
            ->whereYear('pe.exit_date', $year)
            ->whereNull('pe.deleted_at')
            ->whereNull('ep.deleted_at')
            ->groupBy('p.id', 'p.title', 'p.sku', 'p.umbral', 'pc.name', 'pw.stock');

        // 🔹 Filtros dinámicos
        if ($areaId && $areaId !== 'all') $base->where('pe.area_id', $areaId);
        if ($subareaId && $subareaId !== 'all') $base->where('pe.subarea_id', $subareaId);
        if ($categoryId && $categoryId !== 'all') $base->where('p.product_categorie_id', $categoryId);
        if ($productId && $productId !== 'all') $base->where('p.id', $productId);

        $productos = $base->get();

        if ($productos->isEmpty()) {
            return response()->json([
                'success' => true,
                'data' => [],
                'message' => 'No se encontraron productos con consumo registrado en el periodo seleccionado.'
            ]);
        }

        // 🔹 2. Adjuntar serie mensual (monthly_trend)
        foreach ($productos as $p) {
            $mensual = DB::table('exit_products as ep')
                ->join('product_exits as pe', 'pe.id', '=', 'ep.product_exit_id')
                ->selectRaw('MONTH(pe.exit_date) as mes, SUM(ep.quantity) as total')
                ->where('ep.product_id', $p->product_id)
                ->whereYear('pe.exit_date', $year)
                ->groupBy(DB::raw('MONTH(pe.exit_date)'))
                ->orderBy(DB::raw('MONTH(pe.exit_date)'))
                ->pluck('total', 'mes');

            // Normalizar 12 meses
            $trend = [];
            for ($m = 1; $m <= 12; $m++) {
                $trend[] = (int) ($mensual[$m] ?? 0);
            }

            $p->monthly_trend = $trend;
        }

        // 🔹 3. Calcular severidad / etiquetas
        $productos = collect($productos)->map(function ($p) {
            $p->umbral = $p->umbral ?? 0;
            $p->alert = 'Normal';
            $p->severity = 1;

            if ($p->stock_actual == 0) {
                $p->alert = '🔴 Sin Existencia';
                $p->severity = 5;
            } elseif ($p->stock_actual <= $p->umbral && $p->umbral > 0) {
                $p->alert = '⚠️ Bajo Stock';
                $p->severity = 4;
            } elseif ($p->stock_actual <= ($p->umbral * 1.5) && $p->umbral > 0) {
                $p->alert = '🟠 En Riesgo';
                $p->severity = 3;
            }

            $p->confidence = 0.96;

            return $p;
        });

        // 🔹 4. Ordenar por severidad desc
        $productos = $productos->sortByDesc('severity')->values();

        return response()->json([
            'success' => true,
            'data' => $productos,
            'generated_at' => now()->toDateTimeString(),
        ]);

    } catch (\Throwable $th) {
        return response()->json([
            'success' => false,
            'message' => 'Error interno en análisis IA: ' . $th->getMessage(),
        ], 500);
    }
}

*/

/*
    public function insigh(Request $request)
{
    try {
        $year       = $request->input('year', date('Y'));
        $areaId     = $request->input('area_id');
        $subareaId  = $request->input('subarea_id');
        $categoryId = $request->input('category_id');
        $productId  = $request->input('product_id');

        // 🔹 1. Base de productos con consumo histórico
        $base = DB::table('exit_products as ep')
            ->join('product_exits as pe', 'pe.id', '=', 'ep.product_exit_id')
            ->join('products as p', 'p.id', '=', 'ep.product_id')
            ->leftJoin('product_warehouses as pw', 'pw.product_id', '=', 'p.id')
            ->select(
                'p.id as product_id',
                'p.title',
                'p.sku',
                'p.umbral',
                DB::raw('COALESCE(pw.stock, 0) as stock_actual'),
                DB::raw('ROUND(SUM(ep.quantity)/COUNT(DISTINCT MONTH(pe.exit_date)), 2) as promedio_mensual'),
                DB::raw('SUM(ep.quantity) as total_anual')
            )
            ->whereYear('pe.exit_date', $year)
            ->whereNull('pe.deleted_at')
            ->whereNull('ep.deleted_at')
            ->groupBy('p.id', 'p.title', 'p.sku', 'p.umbral', 'pw.stock');

        if ($areaId && $areaId !== 'all') $base->where('pe.area_id', $areaId);
        if ($subareaId && $subareaId !== 'all') $base->where('pe.subarea_id', $subareaId);
        if ($categoryId && $categoryId !== 'all') $base->where('p.product_categorie_id', $categoryId);
        if ($productId && $productId !== 'all') $base->where('p.id', $productId);

        $productos = $base->get();

        if ($productos->isEmpty()) {
            return response()->json([
                'success' => true,
                'data' => [],
                'message' => 'No se encontraron productos con consumo registrado en el periodo seleccionado.'
            ]);
        }

        // 🔹 2. Adjuntar serie mensual (monthly_trend)
            foreach ($productos as $p) {
                $mensual = DB::table('exit_products as ep')
                    ->join('product_exits as pe', 'pe.id', '=', 'ep.product_exit_id')
                    ->selectRaw('MONTH(pe.exit_date) as mes, SUM(ep.quantity) as total')
                    ->where('ep.product_id', $p->product_id)
                    ->whereYear('pe.exit_date', $year)
                    ->groupBy(DB::raw('MONTH(pe.exit_date)'))
                    ->orderBy(DB::raw('MONTH(pe.exit_date)'))
                    ->get()
                    ->pluck('total', 'mes');

                // Normalizar 12 meses (enero–diciembre)
                $trend = [];
                for ($m = 1; $m <= 12; $m++) {
                    $trend[] = (int) ($mensual[$m] ?? 0);
                }
                $p->monthly_trend = $trend;
            }


        // 🔹 3. Calcular severidad y etiquetas IA
        $productos = collect($productos)->map(function ($p) {
            $p->umbral = $p->umbral ?? 0;
            $p->alert = 'Normal';
            $p->severity = 1;

            if ($p->stock_actual == 0) {
                $p->alert = '🔴 Sin Existencia';
                $p->severity = 5;
            } elseif ($p->stock_actual <= $p->umbral && $p->umbral > 0) {
                $p->alert = '⚠️ Bajo Stock';
                $p->severity = 4;
            } elseif ($p->stock_actual <= ($p->umbral * 1.5) && $p->umbral > 0) {
                $p->alert = '🟠 En Riesgo';
                $p->severity = 3;
            }

            $p->confidence = 0.96;
            return $p;
        });

        // 🔹 4. Ordenar por severidad
        $productos = $productos->sortByDesc('severity')->values();

        return response()->json([
            'success' => true,
            'data' => $productos,
            'generated_at' => now()->toDateTimeString(),
        ]);

    } catch (\Throwable $th) {
        return response()->json([
            'success' => false,
            'message' => 'Error interno en análisis IA: ' . $th->getMessage(),
        ], 500);
    }
}

*/


