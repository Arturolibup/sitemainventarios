<?php

namespace App\Models\Product;

use Carbon\Carbon;
use App\Models\configuration\Unit;
use App\Models\Product\Product;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ProductWarehouse extends Model   //no tengo relacion con product y tampoco el controlador de warehouse
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        "product_id",
        "unit_id",
        "warehouse", 
        "stock"
    ];

    public function setWarehouseAttribute($value) // Define default value
    {
        $this->attributes['warehouse'] = "Central Aguamilpa";
    }
    
    public function setCreatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");
        $this->attributes["created_at"] = Carbon::now();
    }

    public function setUpdatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");
        $this->attributes["updated_at"] = Carbon::now();
    }

    public function product(){
        return $this->belongsTo(Product::class, "product_id");
    }
    
    public function unit(){
        return $this->belongsTo(Unit::class, "unit_id");
    }
    
    // Remove or correct the warehouse relationship since 'warehouse' is a string field, not a model
}