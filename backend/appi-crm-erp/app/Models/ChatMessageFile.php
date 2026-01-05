<?php

namespace App\Models;

use Storage;

use App\Models\ChatMessage;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ChatMessageFile extends Model
{
    use HasFactory;

    protected $fillable = [
        'message_id',
        'original_name',
        'stored_name',
        'mime_type',
        'size_bytes',
        'disk',
        'path',
    ];

    public function message(): BelongsTo
    {
        return $this->belongsTo(ChatMessage::class, 'message_id');
    }

    public function getUrlAttribute(): string
    {
        return Storage::disk($this->disk)->url($this->path);
    }

    /**
     * URL SEGURA para descarga (NO pública)
     * Pasa por Policy de conversación
     */
    public function getDownloadUrlAttribute(): string
    {
        return route('chat.files.download', $this->id);
    }
}
