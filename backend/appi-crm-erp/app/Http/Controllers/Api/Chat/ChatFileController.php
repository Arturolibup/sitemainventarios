<?php

namespace App\Http\Controllers\Api\Chat;



use Illuminate\Http\Request;
use App\Models\ChatMessageFile;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Storage;

class ChatFileController extends Controller
{
    public function download(ChatMessageFile $file)
{
    

    if (!$file->message || !$file->message->conversation) {
        abort(404, 'Archivo inválido');
    }

    $userId = auth()->id();
    if (!$userId) {
        abort(403, 'No autenticado');
    }

    $conversation = $file->message->conversation;

    $isParticipant = $conversation->participants
        ->contains('user_id', $userId);

    if (!$isParticipant) {
        abort(403, 'No autorizado');
    }

    // ✅ DEFINIR RUTA ABSOLUTA CORRECTAMENTE
    $absolutePath = Storage::disk($file->disk)->path($file->path);

    // 🧪 DEBUG REAL (ESTO ES LO QUE NECESITAMOS VER)
    if (!file_exists($absolutePath) || !is_readable($absolutePath)) {
        dd([
            'disk'          => $file->disk,
            'db_path'       => $file->path,
            'absolute_path' => $absolutePath,
            'exists'        => file_exists($absolutePath),
            'is_readable'   => is_readable($absolutePath),
        ]);
    }

    // ✅ DESCARGA SEGURA (MEJOR QUE Storage::download)
    return response()->download(
        $absolutePath,
        $file->original_name,
        [
            'Content-Type' => $file->mime_type,
        ]
    );
}



}

