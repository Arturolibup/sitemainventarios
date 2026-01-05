<?php

namespace App\Models\OP;


use App\Models\Car\Car;
use App\Models\Product\Tipo;
use App\Models\Product\Marca;
use App\Models\OP\OrderRequest;
use App\Models\Product\Product;
use App\Models\configuration\Unit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Configuration\ProductCategorie;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class OrderProduct extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $table = 'order_products';
    protected $primaryKey = 'id';
    protected $fillable = [
        'order_request_id',
        'product_id',
        'progresivo',
        'ur_progressive',
        'grupo',
        'subgrupo',
        'oficio',
        'quantity',
        'unit_id',
        'description',
        'brand',
        'marca_id',
        'tipo_id',
        'placa',
        'modelo',
        'cilindro',
        'unit_price',
        'partida',
        'amount',
        'received_quantity',
        'is_delivered',
        'observations',
        'received_at',
        'updated_by',
        'vehicle_id',
    ];

    protected $casts = [
        'is_delivered' => 'boolean',
        'received_at' => 'datetime',
    ];

    protected $dates = ['created_at', 'updated_at', 'deleted_at', 'received_at'];


    // Relación con la orden de pedido
    public function orderRequest()
    {
        return $this->belongsTo(OrderRequest::class, 'order_request_id');
    }

    // Relación con el producto
    public function products()
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    /*public function order()
    {
        return $this->belongsTo(OrderRequest::class, 'order_id');
    }*/

    public function marca()
    {
        return $this->belongsTo(Marca::class, 'marca_id');
    }

    public function tipo()
    {
        return $this->belongsTo(Tipo::class, 'tipo_id');
    }

    // Relación con el vehículo (asumiendo que product_id vincula con vehicles)
    public function vehicle()
    {
        return $this->belongsTo(Car::class, 'vehicle_id');
    }

    // Relación con la unidad de medida
    public function unit()
    {
        return $this->belongsTo(Unit::class, 'unit_id');
    }

    // Relación con la categoría del producto a través del producto
    //public function productCategorie()
    //{
        //return $this->hasOneThrough(ProductCategorie::class, Product::class, 'id', 'id', 'product_id', 'product_categorie_id');
    //}
    public function productCategorie()
{
    return $this->hasOneThrough(
        ProductCategorie::class,
        Product::class,
        'id',              // First key: Product.id
        'id',              // Second key: ProductCategorie.id
        'product_id',      // Local key: en tu tabla
        'product_categorie_id' // Foreign key en Product
    );
}

    // Accessor para el estado de entrega
    public function getDeliveryStatusAttribute()
    {
        return $this->is_delivered ? 'Entregado' : 'No Entregado';
    }
}