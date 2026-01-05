<?php

namespace App\Models\Product;

use Carbon\Carbon;
use App\Models\Product\Product;
use App\Models\Configuration\Area;
use App\Models\configuration\Unit;
use App\Models\Configuration\Subarea;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ProductWallet extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        "product_id",
        "unit_id",
        "area_id",
        "subarea_id",
        "price"

    ];
    
    public function setCreatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");

        $this-> attributes["created_at"] = Carbon::now();
        
    }

    public function setUpdatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");

        $this-> attributes["updated_at"] = Carbon::now();
    }
    
    public function product(){
        return $this->belongsTo(Product::class, "product_id");
    }
    
    public function unit(){
        return $this->belongsTo(Unit::class, "unit_id");
    }
    
    public function area(){ //esta como sucursale
        return $this->belongsTo(Area::class, "area_id");
    }
    
    public function subarea(){ //esta como saber cuanto se va a las subareas
        return $this->belongsTo(Subarea::class, "subarea_id");
    }
    

}
