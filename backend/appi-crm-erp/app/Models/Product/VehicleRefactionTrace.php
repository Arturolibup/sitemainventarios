<?php

namespace App\Models\Product;

use App\Models\Vehiculos;
use App\Models\Product\Product;
use App\Models\Product\ExitProduct;
use App\Models\Product\ProductExit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class VehicleRefactionTrace extends Model
{
    use HasFactory;

    protected $table = 'vehicle_refaction_trace';

    protected $fillable = [
        'product_id',
        'exit_product_id',
        'product_exit_id',
        'entry_product_id',
        'cantidad',
        'invoice_number',
        'order_number',
        'partida',
        'vehicle_id',
        'placa',
        'modelo',
        'marca_id',
        'tipo_id',
        'cilindro',
        'fecha_salida',
    ];

    // Relaciones
    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function exitProduct()
    {
        return $this->belongsTo(\App\Models\Product\ExitProduct::class, 'exit_product_id');
    }

    public function productExit()
    {
        return $this->belongsTo(\App\Models\Product\ProductExit::class, 'product_exit_id');
    }

    public function vehicle()
    {
        return $this->belongsTo(Vehiculos::class, 'vehicle_id');
    }
}

