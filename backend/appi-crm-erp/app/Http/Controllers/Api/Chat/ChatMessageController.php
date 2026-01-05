<?php

namespace App\Http\Controllers\Api\Chat;

use App\Models\ChatMessage;
use Illuminate\Http\Request;
use App\Models\ChatMessageFile;
use App\Models\ChatParticipant;
use App\Models\ChatConversation;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Controller;
use App\Http\Resources\Chat\ChatMessageResource;

class ChatMessageController extends Controller
{
    public function index(Request $request, ChatConversation $conversation)
    {
        $this->authorize('view', $conversation);

        $request->validate([
            'page'     => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'between:10,100'],
        ]);

        $perPage = $request->input('per_page', 30);

        $messages = ChatMessage::where('conversation_id', $conversation->id)
            ->with('attachments')
            ->orderBy('sent_at', 'desc')
            ->paginate($perPage);

        return ChatMessageResource::collection($messages)->additional([
            'meta' => [
                'current_page' => $messages->currentPage(),
                'last_page'    => $messages->lastPage(),
                'per_page'     => $messages->perPage(),
                'total'        => $messages->total(),
            ],
        ]);
    }

    public function store(Request $request, ChatConversation $conversation)
    {
        $this->authorize('view', $conversation);

        $user = $request->user();

        $data = $request->validate([
            'body'    => ['nullable', 'string', 'max:5000'],
            'files.*' => ['file', 'max:10240'],
        ], [
            'files.*.max' => 'Cada archivo no debe superar los 10 MB.',
        ]);

        if (empty($data['body']) && !$request->hasFile('files')) {
            return response()->json([
                'message' => 'Debes escribir un mensaje o adjuntar al menos un archivo.',
            ], 422);
        }

        $message = DB::transaction(function () use ($request, $conversation, $user, $data) {
            $message = ChatMessage::create([
                'conversation_id' => $conversation->id,
                'sender_id'       => $user->id,
                'body'            => $data['body'] ?? null,
                'has_attachments' => $request->hasFile('files'),
                'is_system'       => false,
                'sent_at'         => now(),
            ]);

            if ($request->hasFile('files')) {
                foreach ($request->file('files') as $file) {
                    $storedPath = $file->store
                    (
                        'conversations/' . $conversation->id,
                        'chat_private'
                    );

                    ChatMessageFile::create([
                        'message_id'    => $message->id,
                        'original_name' => $file->getClientOriginalName(),
                        'stored_name'   => basename($storedPath),
                        'mime_type'     => $file->getClientMimeType(),
                        'size_bytes'    => $file->getSize(),
                        'disk'          => 'chat_private',
                        'path'          => $storedPath,
                    ]);
                }
            }

            $conversation->update([
                'last_message_id' => $message->id,
            ]);

            ChatParticipant::where('conversation_id', $conversation->id)
                ->where('user_id', $user->id)
                ->update(['last_read_at' => now()]);

            return $message;
        });

        $message->load('attachments');

        return new ChatMessageResource($message);
    }

    public function markAsRead(Request $request, ChatConversation $conversation)
{
    $this->authorize('view', $conversation);

    $user = $request->user();

    // 1️⃣ Marcar MENSAJES como leídos
    ChatMessage::where('conversation_id', $conversation->id)
        ->where('sender_id', '!=', $user->id)   // solo mensajes del otro
        ->whereNull('read_at')
        ->update([
            'read_at' => now(),
        ]);

    // 2️⃣ Marcar PARTICIPANTE como leído
    ChatParticipant::where('conversation_id', $conversation->id)
        ->where('user_id', $user->id)
        ->update([
            'last_read_at' => now(),
        ]);

    return response()->json([
        'success' => true,
    ]);
}
    
    /*
    public function markAsRead(Request $request, ChatConversation $conversation)
    {
        $this->authorize('view', $conversation);

        $user = $request->user();

        ChatParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->update(['last_read_at' => now()]);

        return response()->json([
            'message' => 'Conversación marcada como leída.',
        ]);
    }
    */
}
    