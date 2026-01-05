<?php

namespace App\Models\Requisition;

use App\Models\User;
use App\Models\Configuration\Area;
use App\Models\Product\ProductExit;
use App\Models\Configuration\Subarea;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use App\Models\Requisition\RequisitionCall;
use App\Models\Requisition\RequisitionItem;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Requisition\RequisitionCallProduct;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Requisition extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'requisition_call_id',
        'area_id',
        'subarea_id',
        'requested_by',
        'status',
        'type',      // ← NUEVO
        'requested_at',
        'approved_by',
        'approved_at',
        'observations',
        'pdf_path',
        'created_by',
        'updated_by', //actualizacion o borrador de usuario id. 
        'exit_id',
        'exit_generated',
        'exit_folio',
        'exit_draft_path',   // ← NUEVO
        'exit_pdf_path',     // ← NUEVO
        'exit_status',
        
    ];

    protected $visible = [
        'id',
        'requisition_call_id',
        'area_id',
        'subarea_id',
        'requested_by',
        'status',
        'type',      // ← NUEVO
        'requested_at',
        'approved_by',
        'approved_at',
        'observations',
        'pdf_path',
        'created_by',
        'updated_by', //actualizacion o borrador de usuario id. 
        'exit_id',
        'exit_generated',
        'exit_folio',
        'exit_pdf_path',
        'exit_draft_path',   // ← NUEVO
        'exit_pdf_path',     // ← NUEVO
        'exit_status',
        'call',
        'area',
        'subarea',
        'items',
        'exit_pdf_url',
        'exit_draft_url',
     
    ];
    protected $casts = [
        'requested_at' => 'datetime',
        'approved_at' => 'datetime',
        'exit_generated'=> 'boolean'
    ];

    // 🔹 AÑADIR ESTO: CARGAR SIEMPRE LAS RELACIONES
    protected $with = [
        'call',
        'area',
        'subarea',
        'items.product',
        'items.unit'
    ];

    // 🔹 Para que siempre se incluyan aunque no los selecciones a mano
    protected $appends = [
        'exit_pdf_url',
        'exit_draft_url',
    ];

    

    // 🔹 Relaciones principales

    public function callProduct()
    {
        return $this->belongsTo(RequisitionCallProduct::class, 'requisition_call_product_id');
    }

    public function call()
    {
        return $this->belongsTo(RequisitionCall::class, 'requisition_call_id');
    }

    public function items()
    {
        return $this->hasMany(RequisitionItem::class, 'requisition_id');
    }

    public function area()
    {
        return $this->belongsTo(Area::class, 'area_id');
    }

    public function subarea()
    {
        return $this->belongsTo(Subarea::class, 'subarea_id');
    }

    public function requestedBy()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function exit()
    {
        return $this->belongsTo(ProductExit::class, 'exit_id');
    }

    public function getExitGeneratedAttribute($value)
{
    return (bool) $value;
}


// === ACCESOR PARA URL DEL VALE FIRMADO ===
/**
     * URL pública del vale firmado.
     * Ej: /storage/requisition_exits/REQ_EXIT_000057.pdf
     */
    public function getExitPdfUrlAttribute()
{
    if (!$this->exit_pdf_path) {
        return null;
    }

    // Storage::url(...) → "/storage/requisition_exits/....pdf"
    // url(...)         → "http://127.0.0.1:8000/storage/....pdf"
    return url(Storage::url($this->exit_pdf_path));
}

public function getExitDraftUrlAttribute()
{
    if (!$this->exit_draft_path) {
        return null;
    }

    return url(Storage::url($this->exit_draft_path));
}

}