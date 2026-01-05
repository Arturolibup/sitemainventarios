<?php

namespace App\Models\Configuration;

use Carbon\Carbon;
use App\Models\Configuration\Unit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Unit extends Model
{
    use HasFactory;
    use SoftDeletes;
    protected $fillable = [  //unicamente se colocan los campos que se quieren gestionar.
        "name",
        "state",
        "description",
       
        
    ];

    public function setCreatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");

        $this-> attributes["created_at"] = Carbon::now();
        
    }

    public function setUpdatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");

        $this-> attributes["updated_at"] = Carbon::now();
        
    }

    public function transforms(){    //definimos la relacion
        return $this->hasMany(UnitTransform::class);
    }
}
