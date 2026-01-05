<?php

namespace App\Models\Product;

use Carbon\Carbon;
use App\Models\User;
use App\Models\Product\Product;
use App\Models\Product\EntryEvidence;
use App\Models\Configuration\Provider;
use Illuminate\Database\Eloquent\Model;
use App\Models\Product\ProductWarehouse;
use App\Models\Product\PurchaseDocument;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ProductEntry extends Model
{
    
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'provider_id', 'resource_origin', 'federal_program', 'invoice_number', 
        'order_number', 'process', 'entry_date', 'subtotal', 'iva', 'total', 
        'partida', 'created_by', 'entry_status',
    ];

    protected $dates =['deleted_at'];

    /*public function setCreatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");

        $this-> attributes["created_at"] = Carbon::now();
        
    }

    public function setUpdatedAtAttribute($value){
        date_default_timezone_set("America/Mazatlan");

        $this-> attributes["updated_at"] = Carbon::now();
    }*/
    
    //relacion con el proveedor
    public function provider() {
        return $this->belongsTo(Provider::class);
    }
    //relacion con evidencias
    public function evidences() {
        return $this->hasMany(EntryEvidence::class, 'entry_id');
    }

    //realcion con productos por entry_id
    public function products()
    {
    
        return $this->hasMany(EntryProduct::class, 'entry_id');
    //    return $this->belongsToMany(Product::class, 'entry_product','entry_id', 'product_id') //La relación belongsToMany ya incluye automáticamente 
      //          ->withPivot('quantity', 'unit_price', 'item_code', 'invoice_number'); //las claves foráneas (entry_id y product_id), 
    }                                                               //por lo que no es necesario agregar product_id en el withPivot. 

    //relacion con warehouse con product_id para stock
    public function warehouses(){
        return $this->hasMany(ProductWarehouse::class, 'product_id');
    }

    // Relación con los documentos de compra
    public function purchaseDocuments()
    {
        return $this->hasMany(PurchaseDocument::class, 'entry_id');
    }

    //relacion para listar usarios y creacion de entradas
    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
