<?php

namespace App\Models\Configuration;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ProductCategorie extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $table = 'product_categories';
    
    protected $fillable = [  //unicamente se colocan los campos que se quieren gestionar.
        "name",
        "imagen",
        "state",
        
        
    ];

    public function setCreatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");

        $this-> attributes["created_at"] = Carbon::now();
        
    }

    public function setUpdatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");

        $this-> attributes["updated_at"] = Carbon::now();
        
    }

    //anotaremos la relacion ya que exista la tabla product
    //public function productrelacion(){
    //    return $this->belongsTo(Product::class, "product_id");
    //}
}
