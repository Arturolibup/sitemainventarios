<?php

namespace App\Models\Product;

use Carbon\Carbon;
use App\Models\Product\Product;
use App\Models\Product\ProductExit;
use App\Models\Product\EntryProduct;
use App\Models\Product\ProductEntry;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ExitProduct extends Model
{
    use HasFactory;
    use SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<string>
     */
    protected $fillable = [
        'product_exit_id',
        'requisition_id',
        'entry_id',
        'product_id', 
        'quantity', 
        'warehouse', 
        'invoice_number'
    ];

    public function setCreatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");

        $this-> attributes["created_at"] = Carbon::now();
        
    }

    public function setUpdatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");

        $this-> attributes["updated_at"] = Carbon::now();
    }
    /**
     * Relación con la salida (ProductExit).
     * Un producto de salida pertenece a una salida específica.
     */
    public function exit()
    {
        return $this->belongsTo(ProductExit::class, 'product_exit_id');
    }

    /**
     * Relación con el producto (Product).
     * Un producto de salida está relacionado con un producto específico.
     */
    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    //public function entry()
    //{
        //return $this->belongsTo(ProductEntry::class, 'entry_id');
    //}
    
    public function entry()
    {
        return $this->belongsTo(EntryProduct::class, 'entry_id');
    }
}

