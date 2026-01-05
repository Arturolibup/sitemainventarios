<?php

namespace App\Models\Product;

use Carbon\Carbon;
use App\Models\Product\Tipo;
use App\Models\Product\Marca;
use App\Models\configuration\Unit;
use Illuminate\Support\Facades\DB;
use App\Models\Product\ProductEntry;
use App\Models\Product\ProductWallet;
use App\Models\Configuration\Provider;
use Illuminate\Database\Eloquent\Model;
use App\Models\Product\ProductWarehouse;
use App\Models\Product\ProductPriceHistory;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Configuration\ProductCategorie;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Product extends Model
{
    use HasFactory;
    use SoftDeletes;
    

    protected $fillable=[
        "title",
        "product_categorie_id",
        "imagen",
        "sku",
        "price_general",
        "description",
        "specifications",
        "umbral",
        "umbral_unit_id",
        "tiempo_de_entrega",
        "clave",
        "created_at",
        'unit_id', //agregado
        "marca_id",
        "tipo_id",
        "modelo",
        "numeroeco",
        "cilindro",
        "placa",
        "created_by",
        "updated_by",
        "source",
        
         
    ];
    
    public function setCreatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");

        $this-> attributes["created_at"] = Carbon::now();
        
    }

    public function setUpdatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");

        $this-> attributes["updated_at"] = Carbon::now();
    }

    public function umbral_unit(){   //tendra relacion a wallet y warehouse con el id umbral_unit_id
        return $this->belongsTo(Unit::class, "umbral_unit_id"); //Relacion del modelo con la tabla unidad units
    }
    
    public function product_categories(){
        return $this->belongsTo(ProductCategorie::class,"product_categorie_id");
    }


    public function provider(){
        return $this->belongsTo(Provider::class,"provider_id");
    }

    public function wallets(){
        return $this->hasMany(ProductWallet::class);
    }

    public function warehouses(){
        return $this->hasMany(ProductWarehouse::class, 'product_id');
    }

    public function price_history(){
        return $this->hasMany(ProductPriceHistory::class, 'product_id');
    }

    public function created_by_user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updated_by_user()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
   
    public function scopeFilterAdvance($query, $search, $product_categorie_id)
    {
        
        $table = $this->getTable();
        
        if ($search) {
            $query->whereRaw(
                "({$table}.title LIKE ? OR {$table}.sku LIKE ? OR DATE({$table}.created_at) LIKE ?)",
                ["%{$search}%", "%{$search}%", "%{$search}%"]
            );
        }
        
        if ($product_categorie_id) {
            $query->whereRaw("{$table}.product_categorie_id = ?", [$product_categorie_id]);
        }
        
        return $query;
    }
    public function entries() {
        return $this->belongsToMany(ProductEntry::class, 'entry_product')
                    ->withPivot('quantity', 'unit_price', 'item_code', 'invoice_number');
    }

    public function unit() {
        return $this->belongsTo(Unit::class, "unit_id");
    }

    //agregar relacion entre marcas y tipo
    public function marca()
    {
        return $this->belongsTo(Marca::class, 'marca_id');
    }

    // Relación: Un producto pertenece a un tipo
    public function tipo()
    {
        return $this->belongsTo(Tipo::class, 'tipo_id');
    }
}
