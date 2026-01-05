<?php

namespace App\Models\Product;


use Carbon\Carbon;
use App\Models\User;
use App\Models\Product\Product;
use App\Models\Configuration\Area;
use App\Models\Product\ExitProduct;
use App\Models\Product\ProductEntry;
use App\Models\Configuration\Subarea;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ProductExit extends Model
{
    use HasFactory;
    use SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        
        'area_id', 
        'folio',
        'subarea_id',
        'requisition_id', 
        'reference', 
        'exit_date', 
        'received_by', 
        'delivered_by', 
        'authorized_by', 
        'pdf_path',
        'exit_status', // Añadido
        'created_by',  // Para auditoría
        'updated_by',
        'pending_products',
        'pending_expires_at',  // Para auditoría
    ];
    protected $dates = ['exit_date', 'pending_expires_at'];

    public function getReferenceAttribute($value)
    {
        return $value ?? 'SIN REFERENCIA';
    }

    public function getExitDateAttribute($value)
    {
        return $value ? Carbon::parse($value)->format('Y-m-d') : null;
    }

    public function getPendingExpiresAtAttribute($value)
    {
        return $value ? Carbon::parse($value)->format('Y-m-d H:i:s') : null;
    }
    public function setCreatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");

        $this-> attributes["created_at"] = Carbon::now();
        
    }

    public function setUpdatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");

        $this-> attributes["updated_at"] = Carbon::now();
    }
    
    public function products()
    {
        return $this->hasMany(ExitProduct::class, 'product_exit_id');
    }

                    

    public function area()
    {
        return $this->belongsTo(Area::class);
    }

    public function subarea()
    {
        return $this->belongsTo(Subarea::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
