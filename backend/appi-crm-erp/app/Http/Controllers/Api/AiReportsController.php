<?php

namespace App\Http\Controllers\Api;

use stdClass;
use Illuminate\Http\Request;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Http;

class AiReportsController extends Controller
{
    


public function latest(Request $request)
{
    try {
        $year = $request->input('year', date('Y'));

        // Base query con todas las relaciones correctas
        $base = DB::table('exit_products as ep')
            ->join('product_exits as pe', 'pe.id', '=', 'ep.product_exit_id')
            ->join('products as p', 'p.id', '=', 'ep.product_id')
            ->join('areas as a', 'a.id', '=', 'pe.area_id')
            ->leftJoin('subareas as s', 's.id', '=', 'pe.subarea_id')
            ->whereYear('pe.exit_date', $year)
            ->whereNotNull('pe.exit_date');

        // Aplicar filtros
        if ($request->filled('area_id') && $request->area_id !== 'all') {
            $base->where('pe.area_id', $request->area_id);
        }
        if ($request->filled('subarea_id') && $request->subarea_id !== 'all') {
            $base->where('pe.subarea_id', $request->subarea_id);
        }
        if ($request->filled('category_id') && $request->category_id !== 'all') {
            $base->where('p.product_categorie_id', $request->category_id);
        }
        if ($request->filled('product_id') && $request->product_id !== 'all') {
            $base->where('ep.product_id', $request->product_id);
        }

        // 1. Forecast mensual
        $forecast = (clone $base)
            ->selectRaw('MONTH(pe.exit_date) as mes, SUM(ep.quantity) as total')
            ->groupBy('mes')
            ->orderBy('mes')
            ->pluck('total', 'mes');

        // 2. Consumo por área o subárea
        $groupField = ($request->filled('area_id') && $request->area_id !== 'all') ? 's.name' : 'a.name';
        $groupAlias = ($request->filled('area_id') && $request->area_id !== 'all') ? 'Subárea' : 'Área';

        $byArea = (clone $base)
            ->selectRaw("$groupField as name, SUM(ep.quantity) as total")
            ->groupByRaw($groupField)
            ->pluck('total', 'name');

        // 3. TOP PRODUCTOS (¡ESTO FALTABA!)
        $topProducts = (clone $base)
    ->join('product_categories as pc', 'pc.id', '=', 'p.product_categorie_id')
    ->selectRaw('
        p.id,
        p.title as producto,
        pc.name as categoria,
        a.name as area,
        SUM(ep.quantity) as cantidad
    ')
    ->groupBy('p.id', 'p.title', 'pc.name', 'a.name')
    ->orderByDesc('cantidad')
    ->limit(100)
    ->get()
    ->map(function ($item) {
        return [
            'id' => $item->id,
            'producto' => $item->producto,
            'categoria' => $item->categoria ?? 'Sin categoría',
            'area' => $item->area ?? 'Sin área',
            'cantidad' => (int) $item->cantidad,
        ];
    });

        // Si hay un solo producto seleccionado, forzamos que aparezca en el top
        if ($request->filled('product_id') && $request->product_id !== 'all') {
            $selectedProduct = DB::table('products')
                ->where('id', $request->product_id)
                ->select('title')
                ->first();

            if ($selectedProduct && $topProducts->isEmpty()) {
                $topProducts = collect([[
                    'producto' => $selectedProduct->title,
                    'area' => $byArea->keys()->first() ?? 'Filtrado',
                    'cantidad' => $forecast->sum() ?? 0,
                ]]);
            }
        }

        Log::info('TOP PRODUCTS', $topProducts->take(3)->toArray());
        return response()->json([
            'success' => true,
            'data' => [
                'forecast'     => $forecast->isEmpty() ? new stdClass() : $forecast,
                'by_area'      => $byArea->isEmpty() ? new \stdClass() : $byArea,
                'top_products' => $topProducts, // ¡AHORA SÍ EXISTE!
                'insights'     => [],
                'confianza'    => 0.96,
                'comentario'   => $topProducts->isEmpty()
                    ? "No hay consumo registrado para los filtros seleccionados."
                    : "Análisis actualizado del año {$year}",
            ],
        ]);

    } catch (Throwable $th) {
        Log::error('Error en AiReportsController@latest: ' . $th->getMessage());
        return response()->json([
            'success' => false,
            'message' => 'Error interno del servidor de IA.',
        ], 500);
    }
}


    private function saveInsights(array $insights): void
{
    foreach ($insights as $insight) {
        DB::table('ai_insights')->updateOrInsert(
            [
                'type' => $insight['type'] ?? 'unknown',
                'period' => $insight['period'] ?? now()->format('Y-m'),
            ],
            [
                'product_id' => $insight['product_id'] ?? null,
                'area_id' => $insight['area_id'] ?? null,
                'subarea_id' => $insight['subarea_id'] ?? null,
                'severity' => $insight['severity'] ?? 3,
                'summary' => $insight['summary'] ?? '',
                'details' => isset($insight['details']) ? json_encode($insight['details']) : null,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }
}


public function analyzeProduct(Request $request)
{
    try {
        $product = $request->input('product');
        $series = $request->input('series', []);

        if (!$product || empty($series)) {
            return response()->json(['error' => 'Datos insuficientes para análisis IA'], 400);
        }

        $prompt = "
                    Eres un experto analista de inventarios. Analiza el siguiente producto institucional:
                    Producto: {$product['title']}
                    Consumo mensual histórico (enero a diciembre): " . json_encode($series) . "
                    Responde **solo** en formato JSON, sin comentarios ni texto adicional.
                    El JSON debe tener esta estructura exacta:
                    {
                    \"suggestion\": \"texto de recomendación de compra o mantenimiento de stock\",
                    \"justification\": \"razón técnica del análisis\",
                    \"projection\": [3 valores numéricos proyectados para los próximos meses]
                    }
                    ";

        $response = Http::withToken(env('OPENAI_API_KEY'))
            ->timeout(60)
            ->post('https://api.openai.com/v1/chat/completions', [
                'model' => 'gpt-4o-mini',
                'messages' => [
                    ['role' => 'system', 'content' => 'Eres un analista institucional experto en inventarios.'],
                    ['role' => 'user', 'content' => $prompt],
                ],
                'temperature' => 0.3,
            ]);

        if ($response->failed()) {
            return response()->json(['error' => 'Fallo conexión con OpenAI', 'details' => $response->body()], 500);
        }

        $body = json_decode($response->body(), true);
        $content = $body['choices'][0]['message']['content'] ?? '{}';

        // 🧩 Intentar limpiar el contenido de la IA para extraer JSON
        $clean = trim($content);
        $clean = preg_replace('/^```json|```$/', '', $clean);
        $clean = trim($clean);

        $decoded = json_decode($clean, true);

        if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
            // Log interno para depuración
            \Log::error('❌ Error decodificando IA', [
                'raw' => $content,
                'clean' => $clean,
            ]);
            return response()->json(['error' => 'Respuesta IA no válida', 'raw' => $content], 500);
        }

        return response()->json(['data' => $decoded]);
    } catch (\Throwable $th) {
        \Log::error('❌ Excepción en analyzeProduct', [
            'msg' => $th->getMessage(),
            'line' => $th->getLine(),
        ]);
        return response()->json([
            'error' => true,
            'message' => $th->getMessage(),
        ], 500);
    }
}


public function exportPdf(Request $request)
{
    try {
        $product = $request->input('product');
        $analysis = $request->input('analysis');
        $chartBase64 = $request->input('chartBase64');

        if (!$product || !$analysis) {
            return response()->json(['error' => 'Datos incompletos para generar PDF.'], 400);
        }

        // ✅ Verifica si la vista existe
        if (!view()->exists('pdf.ai_report')) {
            return response()->json(['error' => 'Vista Blade pdf.ai_report no encontrada'], 500);
        }

        // ✅ Sanitiza el título del archivo (sin espacios ni acentos)
        $safeTitle = preg_replace('/[^A-Za-z0-9_\-]/', '_', $product['title'] ?? 'producto');

        // ✅ Genera el HTML
        $html = view('pdf.ai_report', compact('product', 'analysis', 'chartBase64'))->render();

        // ✅ Genera el PDF
        $pdf = Pdf::loadHTML($html)->setPaper('a4', 'portrait');

        // ✅ Devuelve el archivo binario (stream)
        return response($pdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="Reporte_IA_' . $safeTitle . '.pdf"',
        ]);

    } catch (Throwable $th) {
        Log::error('❌ Error generando PDF IA', [
            'msg' => $th->getMessage(),
            'line' => $th->getLine(),
            'file' => $th->getFile(),
        ]);
        return response()->json([
            'error' => true,
            'message' => $th->getMessage(),
        ], 500);
    }
}



}



