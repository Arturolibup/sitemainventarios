<?php

namespace App\Models;

use App\Models\User;
use App\Models\ChatMessageFile;
use App\Models\ChatConversation;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ChatMessage extends Model
{
    use HasFactory;

    protected $fillable = [
        'conversation_id',
        'sender_id',
        'body',
        'has_attachments',
        'is_system',
        'sent_at',
        'read_at',
    ];

    protected $casts = [
        'has_attachments' => 'boolean',
        'is_system'       => 'boolean',
        'sent_at'         => 'datetime',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(ChatConversation::class, 'conversation_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(ChatMessageFile::class, 'message_id');
    }
}
