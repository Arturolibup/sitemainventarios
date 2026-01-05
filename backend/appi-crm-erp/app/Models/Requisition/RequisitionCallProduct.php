<?php

namespace App\Models\Requisition;

use App\Models\Product\Product;

use App\Models\Configuration\Unit;
use Illuminate\Database\Eloquent\Model;
use App\Models\Requisition\RequisitionCall;
use App\Models\Requisition\RequisitionItem;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class RequisitionCallProduct extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'requisition_call_id',
        'product_id',
        'default_unit_id',
        'is_enabled',
        'sort_order',
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
    ];

    // 🔹 Relaciones

    public function call()
    {
        return $this->belongsTo(RequisitionCall::class, 'requisition_call_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function unit()
    {
        return $this->belongsTo(Unit::class, 'default_unit_id');
    }

    public function items()
    {
        return $this->hasMany(RequisitionItem::class, 'requisition_call_product_id');
    }
}