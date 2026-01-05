<?php

namespace App\Http\Resources\Product;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArra(Request $request): array //que campos vamos a poner en el fronted los de product.php
    {
        $stockTotal = $this->resource->warehouses->sum('stock');
        return [
            "id"=> $this->resource->id,
            "title"=> $this->resource->title,
            "product_categorie_id"=>$this->resource->product_categorie_id,
            "product_categorie"=>[
                "id"=>$this->resource->product_categories->id,
                "name"=>$this->resource->product_categories->name,
                //
            ],
            //"imagen" => $this->resource->imagen ? env("APP_URL"), '/' . "storage/" . $this->resource->imagen : null,            
            "imagen" => $this->resource->imagen 
            ? rtrim(env("APP_URL"), '/') . '/storage/' . ltrim($this->resource->imagen, '/') 
            : null,
            "sku"=> $this->resource->sku,
            "price_general"=>$this->resource->price_general,
            "created_at"=>$this->resource->created_at->format ("Y-m-d h:i A"),
            "description"=>$this->resource->description,
            "specifications"=>$this->resource->specifications,
            "umbral"=> $this->resource->umbral,
            "umbral_unit_id"=> $this->resource->umbral_unit_id,
            "umbral_unit"=>$this->resource->umbral_unit ? [ 
                "id"=>$this->resource->umbral_unit->id,
                "name"=>$this->resource->umbral_unit->name,
            ] : NULL,
            "tiempo_de_entrega"=> $this->resource->tiempo_de_entrega,
            "clave"=> $this->resource->clave,
            "marca_id" => $this->resource->marca_id,
            "marca" => $this->resource->marca ? [
                "id" => $this->resource->marca->id,
                "nombre" => $this->resource->marca->nombre,
            ] : null,
            "tipo_id" => $this->resource->tipo_id,
            "tipo" => $this->resource->tipo ? [
                "id" => $this->resource->tipo->id,
                "nombre" => $this->resource->tipo->nombre,
                "tipos" => $this->resource->marca->tipos ? $this->resource->marca->tipos->map(function ($tipo) {
                    return [
                        "id" => $tipo->id,
                        "nombre" => $tipo->nombre,
                    ];
                }) : [],
            ] : null,
            
            "modelo" => $this->resource->modelo,
            "numeroeco" => $this->resource->numeroeco,
            "cilindro" => $this->resource->cilindro,
            "placa" => $this->resource->placa,
            "wallets"=>$this->resource->wallets->map(function ($wallet){
                return[
                    "id" =>$wallet->id,
                    "unit"=>$wallet->unit,
                    //"warehouse"=>$wallet->warehouse,
                    //"quantity"=>$wallet->quantity,
                    "price_general"=>$wallet->price,
                ];

            }),
            "warehouses"=>$this->resource->warehouses->map(function ($warehouse){
                return[
                    "id" =>$warehouse->id,
                    "product_id"=>$warehouse->product,
                    "unit"=>$warehouse->unit,
                    "warehouse"=>$warehouse->warehouse,
                    "quantity"=>$warehouse->stock,
                ];
            }),
            "stock_total" => $stockTotal, // Agregar el stock total
        ];
    }

    public function toArray(Request $request): array
{
    $stockTotal = $this->resource->warehouses->sum('stock');

    return [
        "id" => $this->resource->id,
        "title" => $this->resource->title,
        "product_categorie_id" => $this->resource->product_categorie_id,
        "product_categorie" => $this->resource->product_categories
            ? [
                "id" => $this->resource->product_categories->id,
                "name" => $this->resource->product_categories->name,
              ]
            : ["id" => null, "name" => "Sin categoría"], // 👈 por defecto

        "imagen" => $this->resource->imagen
            ? rtrim(env("APP_URL"), '/') . '/storage/' . ltrim($this->resource->imagen, '/')
            : null,

        "sku" => $this->resource->sku,
        "price_general" => $this->resource->price_general,
        "created_at" => $this->resource->created_at->format("Y-m-d h:i A"),
        "description" => $this->resource->description,
        "specifications" => $this->resource->specifications,
        "umbral" => $this->resource->umbral,
        "umbral_unit_id" => $this->resource->umbral_unit_id,
        "tiempo_de_entrega" => $this->resource->tiempo_de_entrega,
        "clave" => $this->resource->clave,

        // Campos automotrices seguros
        "marca" => $this->resource->marca
            ? ["id" => $this->resource->marca->id, "nombre" => $this->resource->marca->nombre]
            : ["id" => null, "nombre" => "Sin marca"],

        "tipo" => $this->resource->tipo
            ? ["id" => $this->resource->tipo->id, "nombre" => $this->resource->tipo->nombre]
            : ["id" => null, "nombre" => "Sin tipo"],

        "modelo" => $this->resource->modelo,
        "numeroeco" => $this->resource->numeroeco,
        "cilindro" => $this->resource->cilindro,
        "placa" => $this->resource->placa,

        "warehouses" => $this->resource->warehouses->map(function ($warehouse) {
            return [
                "id" => $warehouse->id,
                "product_id" => $warehouse->product,
                "unit" => $warehouse->unit,
                "warehouse" => $warehouse->warehouse,
                "quantity" => $warehouse->stock,
            ];
        }),

        "stock_total" => $stockTotal,
    ];
}
}
