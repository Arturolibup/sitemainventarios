<?php

namespace App\Models\OP;

use App\Models\User;
use App\Models\OP\OrderRequest;
use App\Models\Configuration\Provider;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Invoice extends Model
{
    use HasFactory;

    protected $table = 'invoices';
    protected $primaryKey = 'id';
    protected $fillable = [
        'order_request_id',
        'provider_id',
        'invoice_number',
        'file_path',
        'photos',
        'created_by',
        'updated_by',
        
    ];

    protected $casts = [
        'photos' => 'array',
        
    ];
    protected $dates = ['created_at', 'updated_at', 'deleted_at'];

    // Relación con la orden de pedido
    public function orderRequest()
    {
        return $this->belongsTo(OrderRequest::class, 'order_request_id');
    }

    // Relación con el proveedor
    public function provider()
    {
        return $this->belongsTo(Provider::class, 'provider_id');
    }

    // Relación con el usuario que subió el documento
    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
    // Relación con el usuario que actualizó la factura
    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}