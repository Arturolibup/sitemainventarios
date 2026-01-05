<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Ai\AiAgentService;
use App\Services\Ai\AiDataBuilderService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;

class AiRequisitionController extends Controller
{
    protected $agent;
    protected $dataBuilder;

    public function __construct(AiAgentService $agent, AiDataBuilderService $dataBuilder)
    {
        $this->agent = $agent;
        $this->dataBuilder = $dataBuilder;
    }

 

    
public function analyze($id, Request $request)
{
    
    Log::info("AI ANALYZE: Iniciando para requisición #{$id}");

    try {
        $context = $this->dataBuilder->buildRequisitionContext($id);
        Log::info("AI ANALYZE: Contexto recibido", ['items_count' => $context['items']->count() ?? 0]);

        if (empty($context['items'])) {
            return response()->json(['success' => false, 'message' => 'Sin ítems'], 400);
        }

        $recommendations = [];
        foreach ($context['items'] as $item) {
            Log::info("AI ANALYZE: Procesando producto", [
                'id' => $item->product_id,
                'name' => $item->product_name,
                'prev_month_1' => $item->prev_month_1 ?? 0,
                'qty_oficio' => $item->qty_oficio ?? 0
            ]);

            $prompt = $this->buildPrompt($item);
            $response = $this->getOpenAIResponse($prompt);
            Log::info("AI ANALYZE: OpenAI response", ['response' => substr($response, 0, 200)]);

            $json = json_decode($response, true);
            if (json_last_error() === JSON_ERROR_NONE && isset($json['forecast'])) {
                $recommendations[] = [
                    'requisition_item_id' => $item->requisition_item_id,
                    'product_id' => $item->product_id,
                    'requested_qty' => $item->requested_qty,
                    'suggested_qty' => $json['forecast'],
                    'reason' => $json['comentario'] ?? 'Análisis completado',
                    'confidence' => $json['confianza'] ?? 0,
                    'prev_month_1' => $item->prev_month_1,
                    'prev_month_2' => $item->prev_month_2,
                    'prev_month_3' => $item->prev_month_3,
                    'flags' => $this->detectFlags($item, $json['forecast']),
                    'accion' => $json['accion'] ?? 'aprobar',
                    'alerta' => $json['alerta'] ?? null,
                    'sugerencia_preventiva' => $json['sugerencia_preventiva'] ?? null,
                    'qty_requisicion' => $item->qty_requisicion,
                    'qty_oficio' => $item->qty_oficio,
                ];
            }
        }

        Log::info("AI ANALYZE: Recomendaciones generadas", ['count' => count($recommendations)]);

        return response()->json([
            'success' => true,
            'recommendations' => $recommendations
        ]);

    } catch (Exception $e) {
        Log::error('AI ANALYZE ERROR: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
        return response()->json([
            'success' => true,
            'message' => 'IA no disponible',
            'recommendations' => []
        ]);
    }
}


/*
private function buildPromp($item): string
{
    $total_salidas = $item->qty_requisicion + $item->qty_oficio;
    $oficio_pct = $total_salidas > 0 
        ? round(($item->qty_oficio / $total_salidas) * 100, 1) : 0;

    $trend = ($item->prev_month_1 > $item->prev_month_2)
        ? 'creciente'
        : (($item->prev_month_1 < $item->prev_month_2) ? 'decreciente' : 'estable');

    return "ANÁLISIS ESTRATÉGICO DE INVENTARIOS

            Producto: {$item->product_name}
            Solicitado: {$item->requested_qty}
            Stock actual: {$item->current_stock}

            HISTÓRICO (ÚLTIMOS 3 MESES):
            Hace 3 meses: {$item->prev_month_3}
            Hace 2 meses: {$item->prev_month_2}
            Hace 1 mes: {$item->prev_month_1} (tendencia: $trend)

            SALIDAS (12 MESES):
            Requisición: {$item->qty_requisicion} unidades
            Oficio: {$item->qty_oficio} unidades ($oficio_pct% del total)

            ANÁLISIS REQUERIDO:
            1. ¿El solicitado está justificado por el consumo real?
            2. ¿Hay patrón: rechazan requisición → salen por oficio?
            3. ¿Sobrecarga o falta de control?
            4. Recomendación: aprobar, reducir, rechazar
            5. Sugerencia preventiva

            JSON SOLO:
            {
            \"forecast\": 180,
            \"confianza\": 88,
            \"comentario\": \"99.5% por oficio. Patrón claro: rechazan requisición. Reducir a 180.\",
            \"accion\": \"reducir\",
            \"alerta\": \"oficio_sospechoso\",
            \"sugerencia_preventiva\": \"Auditar requisiciones rechazadas y capacitar en uso correcto.\"
            }";
        }

        */

private function buildPrompt($item): string
{
    $total_salidas = $item->qty_requisicion + $item->qty_oficio;
    $oficio_pct = $total_salidas > 0 
        ? round(($item->qty_oficio / $total_salidas) * 100, 1) 
        : 0;

    $trend = match (true) {
        $item->prev_month_1 > $item->prev_month_2 * 1.2 => 'creciente fuerte',
        $item->prev_month_1 > $item->prev_month_2 => 'creciente',
        $item->prev_month_1 < $item->prev_month_2 * 0.8 => 'decreciente fuerte',
        $item->prev_month_1 < $item->prev_month_2 => 'decreciente',
        default => 'estable'
    };

    return "Eres un analista experto en control de inventarios del gobierno.

Producto: {$item->product_name}
Cantidad solicitada: {$item->requested_qty} {$item->unit_name}
Stock actual: {$item->current_stock}

Consumo real últimos 3 meses:
• Hace 3 meses: {$item->prev_month_3}
• Hace 2 meses: {$item->prev_month_2}
• Hace 1 mes: {$item->prev_month_1} ← tendencia: $trend

Salidas reales en 12 meses:
• Por requisición oficial: {$item->qty_requisicion} unidades
• Por oficio (sin requisición): {$item->qty_oficio} unidades ← {$oficio_pct}% del total

INSTRUCCIONES CLARAS:
1. Analiza si la cantidad solicitada está justificada por el consumo real
2. Detecta si hay patrón de rechazar requisición → salir por oficio
3. Recomienda cantidad realista (puede ser más, menos o igual)
4. Sé honesto y crítico

Responde SOLO con JSON válido (nada más, ni ```json ni texto):

{
  \"forecast\": número_entero,
  \"confianza\": 0-100,
  \"comentario\": \"tu análisis en 1-2 frases\",
  \"accion\": \"aprobar\"|\"reducir\"|\"aumentar\"|\"rechazar\",
  \"alerta\": \"oficio_sospechoso\"|\"sobreconsumo\"|\"subconsumo\"|null,
  \"sugerencia_preventiva\": \"acción concreta para mejorar control\" o null
}";
}


        private function getOpenAIResponse($prompt): string
{
    try {
        $response = Http::timeout(30)
            ->withHeaders([
                'Authorization' => 'Bearer ' . env('OPENAI_API_KEY'),
                'Content-Type' => 'application/json',
            ])
            ->post('https://api.openai.com/v1/chat/completions', [
                'model' => 'gpt-4o-mini',
                'messages' => [
                    ['role' => 'user', 'content' => $prompt]
                ],
                'temperature' => 0.3,
                'max_tokens' => 500
            ]);

        if (!$response->successful()) {
            Log::error('OpenAI API Error', [
                'status' => $response->status(),
                'body' => $response->body()
            ]);
            return '';
        }

        $content = data_get($response->json(), 'choices.0.message.content', '');
        
        // LIMPIAR BLOQUES DE CÓDIGO (esto es lo que arregla TODO)
        $clean = trim($content);
        
        // Quitar ```json al inicio y ``` al final (con o sin salto de línea)
        $clean = preg_replace('/^```json\s*/i', '', $clean);
        $clean = preg_replace('/\s*```$/i', '', $clean);
        
        // Quitar cualquier otro ``` que pueda haber quedado
        $clean = trim($clean, "` \n\r\t");

        Log::info('OpenAI Response Limpia', ['clean' => $clean]);

        return $clean;

    } catch (\Exception $e) {
        Log::error('Excepción en OpenAI', [
            'message' => $e->getMessage(),
            'prompt' => substr($prompt, 0, 200)
        ]);
        return '';
    }
}

private function detectFlags($item, $forecast): array
{
    $flags = [];
    $diff = abs($forecast - $item->requested_qty) / $item->requested_qty;
    if ($diff > 0.3) $flags[] = 'desviacion_alta';
    if ($forecast > $item->current_stock) $flags[] = 'stock_insuficiente';
    return $flags;
}


}


/*
 * 📊 Analiza una requisición completa y guarda las recomendaciones IA
 
public function analyze($id, Request $request)
{
    DB::beginTransaction();
    try {
        // 1️⃣ Validar que exista la requisición
        $requisition = DB::table('requisitions')->where('id', $id)->first();
        if (!$requisition) {
            return response()->json([
                'success' => false,
                'message' => 'La requisición no existe o fue eliminada.',
            ], 404);
        }

        // 2️⃣ Construir contexto
        $context = $this->dataBuilder->buildRequisitionContext($id);

        if (empty($context['items'])) {
            return response()->json([
                'success' => false,
                'message' => 'La requisición no tiene productos asociados.',
            ], 400);
        }

        // 3️⃣ Intentar análisis IA (pero NO bloquear si falla)
        $recommendations = [];
        $iaMessage = null;

        try {
            $response = $this->agent->analyzeRequisition($context);

            if (isset($response['recommendations']) && is_array($response['recommendations'])) {
                $recommendations = $response['recommendations'];
            } else {
                Log::warning('IA devolvió respuesta sin recomendaciones válidas', $response ?? []);
                $iaMessage = 'La IA no cuenta con datos suficientes para generar recomendaciones en este momento.';
            }
        } catch (\Throwable $e) {
            Log::error('Error en OpenAI (no bloquea aprobación): ' . $e->getMessage());
            $iaMessage = 'La IA no cuenta con datos suficientes para generar recomendaciones en este momento.';
        }

        // 4️⃣ Guardar solo si hay recomendaciones
        if (!empty($recommendations)) {
            foreach ($recommendations as $item) {
                DB::table('ai_requisition_recommendations')->updateOrInsert(
                    [
                        'requisition_id' => $id,
                        'requisition_item_id' => $item['requisition_item_id'] ?? 0,
                        'product_id' => $item['product_id'] ?? 0,
                    ],
                    [
                        'requested_qty' => $item['requested_qty'] ?? 0,
                        'suggested_qty' => $item['suggested_qty'] ?? 0,
                        'reason' => $item['reason'] ?? 'Sin motivo especificado',
                        'details' => json_encode($item),
                        'updated_at' => now(),
                        'created_at' => now(),
                    ]
                );
            }
        }

        DB::commit();

        return response()->json([
            'success' => true,
            'message' => $iaMessage ?? 'Análisis IA procesado correctamente.',
            'requisition_id' => $id,
            'recommendations' => $recommendations,
        ]);
    } catch (Throwable $e) {
        DB::rollBack();
        Log::error('Error crítico en análisis IA: ' . $e->getMessage());
        return response()->json([
            'success' => true,
            'message' => 'La IA no cuenta con datos suficientes para generar recomendaciones en este momento.',
            'requisition_id' => $id,
            'recommendations' => [],
        ]);
    }
}

*/

/*
public function analyze($id, Request $request)
{
    try {
        $context = $this->dataBuilder->buildRequisitionContext($id);
        if (empty($context['items'])) {
            return response()->json(['success' => false, 'message' => 'Sin ítems'], 400);
        }

        $recommendations = [];
        foreach ($context['items'] as $item) {
            $prompt = $this->buildPrompt($item);
            $response = $this->getOpenAIResponse($prompt);
            $json = json_decode($response, true);

            if (json_last_error() === JSON_ERROR_NONE && isset($json['forecast'])) {
                $recommendations[] = [
                    'requisition_item_id' => $item->requisition_item_id,
                    'product_id' => $item->product_id,
                    'requested_qty' => $item->requested_qty,
                    'suggested_qty' => $json['forecast'],
                    'reason' => $json['comentario'] ?? 'Análisis completado',
                    'confidence' => $json['confianza'] ?? 0,
                    'prev_month_1' => $item->prev_month_1,
                    'prev_month_2' => $item->prev_month_2,
                    'prev_month_3' => $item->prev_month_3,
                    'flags' => $this->detectFlags($item, $json['forecast'])
                ];
            }
        }

        return response()->json([
            'success' => true,
            'recommendations' => $recommendations
        ]);

    } catch (\Exception $e) {
        return response()->json([
            'success' => true,
            'message' => 'IA no disponible',
            'recommendations' => []
        ]);
    }
}
*/