<?php

namespace App\Models\Car;

use App\Models\Configuration\Area;
use App\Models\Configuration\Subarea;
use App\Models\Product\Marca;
use App\Models\Product\Tipo;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Car extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'vehiculos';

    protected $fillable = [
        'marca_id',
        'tipo_id',
        'modelo',
        'numero_eco',
        'cilindro',
        'subarea_asigna',
        'area_id',
        'placa',
        'placa_anterior',
        'numero_inven',
        'numero_serie',
        'state',
        'imagen_vehiculo',
        'color',
        'estado_actual',
        'estado_asigna',
    ];

    public function marca()
    {
        return $this->belongsTo(Marca::class);
    }

    public function tipo()
    {
        return $this->belongsTo(Tipo::class);
    }

    public function subarea()
    {
        return $this->belongsTo(Subarea::class, 'subarea_asigna');
    }

    public function area()
    {
        return $this->belongsTo(Area::class, 'area_id');
    }

    // Scope para búsqueda por número económico o placa (útil para módulo de salidas)
    public function scopeSearchByNumeroEcoOrPlaca($query, $search)
    {
        return $query->where('numero_eco', 'LIKE', "%{$search}%")
                     ->orWhere('placa', 'LIKE', "%{$search}%");
    }
}