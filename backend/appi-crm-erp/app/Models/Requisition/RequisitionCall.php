<?php

namespace App\Models\Requisition;

use App\Models\User;
use App\Models\Configuration\Unit;
use App\Models\Requisition\Requisition;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Requisition\RequisitionCallProduct;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class RequisitionCall extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'year',
        'month',
        'title',
        'open_at',
        'close_at',
        'created_by',
        'is_active',
        'notes',
    ];

    protected $casts = [
        'open_at' => 'datetime',
        'close_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    protected $dates = ['open_at', 'close_at', 'deleted_at'];
    // 🔹 Relaciones

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function products()
    {
        return $this->hasMany(RequisitionCallProduct::class, 'requisition_call_id');
    }

    public function requisitions()
    {
        return $this->hasMany(Requisition::class, 'requisition_call_id');
    }

    public function generalRequisition()
{
    return $this->hasOne(Requisition::class, 'requisition_call_id')
                ->where('type', 'general')
                ->select('id', 'requisition_call_id', 'type');
}

    
}
