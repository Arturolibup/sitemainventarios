<?php

namespace App\Models\Requisition;


use App\Models\Product\Product;
use App\Models\configuration\Unit;
use App\Models\Product\ProductExit;
use App\Models\Requisition\Requisition;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Requisition\RequisitionCallProduct;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class RequisitionItem extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'requisition_id',
        'requisition_call_product_id',
        'product_id',
        'unit_id',
        'requested_qty',
        'suggested_qty',
        'approved_qty',
        'exit_id',
        'notes',
    ];

    protected $casts = [
        'requested_qty' => 'integer',
        'suggested_qty' => 'integer',
        'approved_qty'  => 'integer',
    ];

    // 🔹 Relaciones

    public function requisition()
    {
        return $this->belongsTo(Requisition::class, 'requisition_id');
    }

    public function callProduct()
    {
        return $this->belongsTo(RequisitionCallProduct::class, 'requisition_call_product_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function unit()
    {
        return $this->belongsTo(Unit::class, 'unit_id');
    }

    public function exit()
    {
        return $this->belongsTo(ProductExit::class, 'exit_id');
    }
}
