<?php

namespace App\Models\Configuration;

use App\Models\Configuration\Subarea;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Area extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'municipio',
        'urs',
        'address',
    ];

    public function subareas()
    {
        return $this->hasMany(Subarea::class, 'area_id');
    }

    public function users()
    {
        return $this->hasMany(\App\Models\User::class, 'area_id');
    }
}