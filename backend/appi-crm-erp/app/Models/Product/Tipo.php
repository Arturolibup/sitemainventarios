<?php

namespace App\Models\Product;

use App\Models\Product\Marca;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Tipo extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'tipos';

    protected $fillable = [
        'nombre',
        'marca_id',
    ];

    public function marca()
    {
        return $this->belongsTo(Marca::class, 'marca_id');
    }

    // Scope para búsqueda por coincidencia
    public function scopeSearchByNombre($query, $search)
    {
        return $query->where('nombre', 'LIKE', "%{$search}%");
    }
}