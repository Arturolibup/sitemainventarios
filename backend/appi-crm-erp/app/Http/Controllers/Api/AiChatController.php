<?php

namespace App\Http\Controllers\Api;


use Illuminate\Http\Request;
use App\Services\Ai\AiAgentService;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\Controller;

class AiChatController extends Controller
{
   


    public function chat(Request $request)
{
    Log::info('🚀 [AI CHAT] Petición recibida', [
        'question' => $request->input('question'),
        'filters' => $request->input('filters'),
        'ip' => $request->ip()
    ]);

    $message = $request->input('question');
    $filters = $request->input('filters', []);

    if (!$message) {
        Log::warning('⚠️ [AI CHAT] Mensaje vacío');
        return response()->json(['reply' => 'Escribe algo.'], 400);
    }

    /*// RESPUESTA RÁPIDA PARA PRUEBA
    if (strtolower(trim($message)) === 'hola') {
        Log::info('👋 [AI CHAT] Respuesta rápida a "hola"');
        return response()->json([
            'reply' => '¡Hola! Soy tu asistente de inventarios. Prueba: *gráfico*, *stock bajo*.'
        ]);
    }*/

    $ai = app(AiAgentService::class);
    $response = $ai->chat($message, $filters);

    Log::info('✅ [AI CHAT] Respuesta generada', ['reply_length' => strlen($response)]);

    return response()->json(['reply' => $response]);
}

}
 