<?php

namespace App\Models\OP;

use App\Models\User;
use App\Models\OP\Invoice;
use App\Models\OP\OrderLog;
use App\Models\OP\Notification;
use App\Models\OP\OrderProduct;
use App\Models\Configuration\Area;
use App\Models\OP\OrderValidation;
use App\Models\Configuration\Subarea;
use App\Models\Configuration\Provider;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class OrderRequest extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'order_requests';
    protected $primaryKey = 'id';
    protected $fillable = [
        'order_number',
        'date',
        'date_limited',
        'format_type',
        'created_by',
        'updated_by',
        'process',
        'provider_id',
        'requester_area_id',
        'requester_subarea_id',
        'ur',
        'delivery_place',
        'concept_total',
        'iva',
        'isr_retention',
        'total',
        'pdf_path',
        'suficiencia_pdf_path',
        'is_pdf_sent',
        'created_at',
        'updated_at',
        'deleted_at',
        'no_beneficiarios',
        'oficio_origen',
        'folio',
        'foliosf',
        'subsidio_estatal',
        'ingresos_propios',
        'federal',
        'mixto',
        'general_observations',
        'validated_area2_at',
        'validated_area1_at',
        'received_at',
        'status',
    ];

    protected $casts = [
        'subsidio_estatal' => 'boolean',
        'ingresos_propios' => 'boolean',
        'federal' => 'boolean',
        'mixto' => 'boolean',
        'date' => 'date',
        'date_limited' => 'date',
        'validated_area2_at' => 'datetime',
        'validated_area1_at' => 'datetime',
        'received_at' => 'datetime',
    ];

    protected $dates = ['created_at', 'updated_at', 'deleted_at', 'validated_area2_at', 'validated_area1_at', 'received_at'];

    // Relación con el usuario que creó la OP
    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

        public function user()
    {
        return $this->createdBy();
    }

    // Relación con el proveedor
    public function provider()
    {
        return $this->belongsTo(Provider::class, 'provider_id');
    }

    // Relación con el área solicitante
    public function requesterArea()
    {
        return $this->belongsTo(Area::class, 'requester_area_id');
    }

    // Relación con la subárea solicitante
    public function requesterSubarea()
    {
        return $this->belongsTo(Subarea::class, 'requester_subarea_id');
    }

    // Relación con los productos de la OP
    public function products()
    {
        return $this->hasMany(OrderProduct::class, 'order_request_id');
    }

    // Relación con los documentos (invoices)
    public function invoices()
    {
        return $this->hasMany(Invoice::class, 'order_request_id');
    }

    // Relación con las notificaciones
    public function notifications()
    {
        return $this->hasMany(Notification::class, 'order_request_id');
    }

    // Relación con las validaciones de la orden (si la tabla existe)
    public function orderValidations()
    {
        return $this->hasMany(OrderValidation::class, 'order_request_id');
    }

    // Relación con los logs de auditoría (si la tabla existe)
    public function orderLogs()
    {
        return $this->hasMany(OrderLog::class, 'order_request_id');
    }

    // Método para verificar transiciones de estado
    public function canTransitionTo($newStatus)
    {
        $allowed = [
            'pending_sf_validation' => ['sf_validated'],
            'sf_validated' => ['pending_warehouse'],
            'pending_warehouse' => ['partially_received', 'completed'],
            'partially_received' => ['completed'],
        ];

        return in_array($newStatus, $allowed[$this->status] ?? []);
    }

    // Accessor para el campo "elaboro"
    public function getElaboroAttribute()
    {
        return $this->createdBy ? $this->createdBy->name . ' ' . ($this->createdBy->surname ?? '') : 'Desconocido';
    }

    // Accessor para el estado actual
    public function getCurrentStatusAttribute()
    {
        switch ($this->status) {
            
            case 'pending_sf_validation':
                return 'Pendiente Validación Suficiencia';
            case 'sf_validated':
                return 'Suficiencia Validada';
            case 'pending_warehouse':
                return 'Pendiente Almacén';
            case 'partially_received':
                return 'Parcialmente Recibida';
            case 'completed':
                return 'Completada';
            default:
                return 'Desconocido';
        }
    }
}