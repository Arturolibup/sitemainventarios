<?php

namespace App\Models\configuration;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class UnitTransform extends Model
{
    use HasFactory;
    use SoftDeletes;
    protected $fillable = [  //unicamente se colocan los campos que se quieren gestionar.
        "unit_id", //unidad 
        "unit_to_id", //unidad en la que se a convertir
              
        
    ];

    public function setCreatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");

        $this-> attributes["created_at"] = Carbon::now();
        
    }

    public function setUpdatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");

        $this-> attributes["updated_at"] = Carbon::now();
        
    }

    public function unit_to(){
        return $this->belongsTo(Unit::class, "unit_to_id");
    }
}
