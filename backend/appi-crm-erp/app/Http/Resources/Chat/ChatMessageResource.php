<?php

namespace App\Http\Resources\Chat;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use App\Http\Resources\Chat\ChatMessageFileResource;

class ChatMessageResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id'              => $this->id,
            'conversation_id' => $this->conversation_id,
            'sender_id'       => $this->sender_id,
            'body'            => $this->body,
            'has_attachments' => $this->has_attachments,
            'is_system'       => $this->is_system,
            'sent_at'         => optional($this->sent_at)->toDateTimeString(),
            'attachments'     => ChatMessageFileResource::collection($this->whenLoaded('attachments')),
        ];
    }
}
