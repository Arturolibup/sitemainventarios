<?php

namespace App\Models\OP;

use App\Models\User;
use App\Models\OP\OrderRequest;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Notification extends Model
{
    use HasFactory;

    protected $table = 'notifications';
    protected $primaryKey = 'id';
    protected $fillable = [
        'user_id',
        'order_request_id',
        'message',
        'created_at',
        'type',
        'is_read'
    ];
    protected $dates = ['created_at'];
    protected $casts = ['is_read' => 'boolean'];

    // Relación con el usuario destinatario
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    // Relación con la orden de pedido
    public function orderRequest()
    {
        return $this->belongsTo(OrderRequest::class, 'order_request_id');
    }
}
