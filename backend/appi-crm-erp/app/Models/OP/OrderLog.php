<?php

namespace App\Models\OP;

use App\Models\User;
use App\Models\OP\OrderRequest;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class OrderLog extends Model
{
    use HasFactory;
    protected $table = 'order_logs';
    protected $primaryKey = 'id';
    protected $fillable = [
        'order_request_id',
        'user_id',
        'action',
        'details',
    ];
    protected $dates = ['created_at'];

    // Relación con la orden de pedido
    public function orderRequest()
    {
        return $this->belongsTo(OrderRequest::class, 'order_request_id');
    }

    // Relación con el usuario que realizó la acción
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
