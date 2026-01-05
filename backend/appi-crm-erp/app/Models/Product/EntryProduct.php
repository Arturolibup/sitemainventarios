<?php

namespace App\Models\Product;

use Carbon\Carbon;
use App\Models\Product\Product;
use App\Models\Product\ProductExit;
use App\Models\Product\ProductEntry;
use Illuminate\Database\Eloquent\Model;
use App\Models\Product\ProductWarehouse;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class EntryProduct extends Model
{
    use HasFactory;
    use SoftDeletes;



    protected $table = 'entry_product';
    protected $fillable = ['entry_id', 'product_id', 'quantity', 'partida', 'unit_price', 'item_code', 'invoice_number'];

    public function setCreatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");

        $this-> attributes["created_at"] = Carbon::now();
        
    }

    public function setUpdatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");

        $this-> attributes["updated_at"] = Carbon::now();
    }

    // Relación con ProductEntry
    public function productEntry()
    {
        return $this->belongsTo(ProductEntry::class, 'entry_id');
    }

    // Relación con Product
    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
    
    public function warehouse()
    {
        return $this->belongsTo(ProductWarehouse::class, 'product_id');
    }


    
}
    