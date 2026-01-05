<?php

namespace App\Http\Controllers\Api\Chat;

use Illuminate\Http\Request;
use App\Models\ChatParticipant;
use App\Models\ChatConversation;
use Illuminate\Support\Facades\DB;
use App\Http\Controllers\Controller;
use App\Http\Resources\Chat\ChatConversationResource;

class ChatConversationController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $conversations = ChatConversation::query()
            ->whereHas('participants', fn($q) => $q->where('user_id', $user->id))
            ->with([
                'participants.user',
                'lastMessage.attachments',
            ])
            ->orderByDesc('updated_at')
            ->get();

        return ChatConversationResource::collection($conversations);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'receiver_id' => ['required', 'exists:users,id'],
        ], [
            'receiver_id.required' => 'Debes seleccionar un usuario para chatear.',
            'receiver_id.exists'   => 'El usuario seleccionado no existe.',
        ]);

        if ($data['receiver_id'] == $user->id) {
            return response()->json([
                'message' => 'No puedes crear una conversación contigo mismo.',
            ], 422);
        }

        $receiverId = $data['receiver_id'];

        $conversation = ChatConversation::where('type', 'direct')
            ->whereHas('participants', fn($q) => $q->where('user_id', $user->id))
            ->whereHas('participants', fn($q) => $q->where('user_id', $receiverId))
            ->first();

        if (!$conversation) {
            $conversation = DB::transaction(function () use ($user, $receiverId) {
                $c = ChatConversation::create([
                    'type'       => 'direct',
                    'title'      => null,
                    'created_by' => $user->id,
                ]);

                ChatParticipant::create([
                    'conversation_id' => $c->id,
                    'user_id'         => $user->id,
                    'joined_at'       => now(),
                ]);

                ChatParticipant::create([
                    'conversation_id' => $c->id,
                    'user_id'         => $receiverId,
                    'joined_at'       => now(),
                ]);

                return $c;
            });
        }

        $conversation->load(['participants.user', 'lastMessage.attachments']);

        return new ChatConversationResource($conversation);
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, ChatConversation $conversation)
    {
        $this->authorize('view', $conversation);

        $conversation->load(['participants.user', 'lastMessage.attachments']);

        return new ChatConversationResource($conversation);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
    }
}
