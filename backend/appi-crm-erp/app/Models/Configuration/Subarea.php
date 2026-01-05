<?php

namespace App\Models\Configuration;

use App\Models\Configuration\Area;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Subarea extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'localidad',
        'municipio',
        'area_id',
    ];

    public function area()
    {
        return $this->belongsTo(Area::class, 'area_id', 'id','urs');
    }

    public function users()
    {
        return $this->hasMany(\App\Models\User::class, 'subarea_id');
    }

    // Scope para búsqueda por coincidencia
    public function scopeSearchByNombre($query, $search)
    {
        return $query->where('name', 'LIKE', "%{$search}%");
    }
}