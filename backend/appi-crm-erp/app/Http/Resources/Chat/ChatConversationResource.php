<?php

namespace App\Http\Resources\Chat;

use Illuminate\Http\Request;
use App\Models\ChatParticipant;
use App\Http\Resources\Chat\ChatMessageResource;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Http\Resources\Chat\ChatParticipantResource;

class ChatConversationResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $authUser = $request->user();

        $participant = ChatParticipant::where('conversation_id', $this->id)
            ->where('user_id', $authUser->id)
            ->first();

        $lastReadAt = $participant?->last_read_at;

        $unreadCount = $this->messages()
            ->when($lastReadAt, function ($q) use ($lastReadAt) {
                $q->where('sent_at', '>', $lastReadAt);
            })
            ->where('sender_id', '!=', $authUser->id)
            ->count();

        return [
            'id'           => $this->id,
            'type'         => $this->type,
            'title'        => $this->title,
            'last_message' => new ChatMessageResource($this->whenLoaded('lastMessage')),
            'participants' => ChatParticipantResource::collection(
                $this->whenLoaded('participants')
            ),
            'unread_count' => $unreadCount,
        ];
    }
}
