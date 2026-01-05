<?php

namespace App\Models\OP;

use App\Models\User;
use App\Models\OP\OrderRequest;
use App\Models\Configuration\Area;
use App\Models\Configuration\Subarea;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class OrderValidation extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $table = 'order_validations';
    protected $primaryKey = 'id';
    protected $fillable = [
        'order_request_id',
        'validated_by',
        'area_id',
        'subarea_id',
        'validation_field',
        'status',
        'validated_at',
    ];
    protected $dates = ['created_at', 'updated_at', 'deleted_at', 'validated_at'];

    // Relación con la orden de pedido
    public function orderRequest()
    {
        return $this->belongsTo(OrderRequest::class, 'order_request_id');
    }

    // Relación con el usuario que validó
    public function validatedBy()
    {
        return $this->belongsTo(User::class, 'validated_by');
    }

    // Relación con el área que validó
    public function area()
    {
        return $this->belongsTo(Area::class, 'area_id');
    }

    // Relación con la subárea que validó
    public function subarea()
    {
        return $this->belongsTo(Subarea::class, 'subarea_id');
    }
}
