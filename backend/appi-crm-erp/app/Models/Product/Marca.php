<?php

namespace App\Models\Product;

use App\Models\Product\Tipo;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Marca extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'marcas';

    protected $fillable = [
        'nombre',
    ];

    public function tipos()
    {
        return $this->hasMany(Tipo::class, 'marca_id');
    }

    // Scope para búsqueda por coincidencia
    public function scopeSearchByNombre($query, $search)
    {
        return $query->where('nombre', 'LIKE', "%{$search}%");
    }
}