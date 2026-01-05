<?php

namespace App\Http\Controllers\OP;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Storage;
use App\Models\Configuration\ProductCategorie;
use App\Http\Controllers\OP\ProductCateController;

class ProductCateController extends Controller
{
    public function index(Request $request)
    {
        $search = $request->get("search");

   
        $categories = ProductCategorie::where("name", "like", "%".$search."%")->orderBy("id","desc")->paginate(25);
        
        return response()->json([
            "total" =>$categories -> total(),
            "categories" => $categories ->map(function ($categorie){
                return [
                    "id"=>$categorie->id,
                    "name"=>$categorie->name,
                    "state"=>$categorie->state, 
                    "imagen"=> $categorie->imagen ? env("APP_URL")."storage/".$categorie->imagen : NULL,
                    "created_at"=>$categorie->created_at->format ("Y-m-d h:i A")
                ];
            }),
        ]);
    }

    


    public function store(Request $request)
    {
        $is_exist_categorie = ProductCategorie::where("name", $request->name)->first();
        if($is_exist_categorie){
            return response()->json([
                "message" => 403,
                "message_text" => "El nombre de la categoria ya Existe"
            ]);
        }

        if($request->hasFile("categorie_imagen"))
        {
            $path = Storage::putFile("categories",$request->file("categorie_imagen"));
            $request->request->add(["imagen"=>$path]); //agregamos la imagen
        }

        $categorie = ProductCategorie::create ($request->all());
        return response ()->json([
            "message" => 200,
            "categorie" => [
                "id"=>$categorie->id,
                    "name"=>$categorie->name,
                    "state"=>$categorie->state ?? 1, 
                    "imagen"=> $categorie->imagen ? env("APP_URL")."storage/".$categorie->imagen : NULL,
                    "created_at"=>$categorie->created_at->format ("Y-m-d h:i A")
            ],
        ]);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $is_exist_categorie = ProductCategorie::where("name", $request->name)
                        -> where ("id", "<>", $id) ->first();
        if($is_exist_categorie){
            return response()->json([
                "message" => 403,
                "message_text" => "La Categoria ya Existe"
            ]);
        }
        $categorie = ProductCategorie::findOrFail ($id);

        if($request->hasFile("categorie_imagen"))
        {
            if($categorie->imagen){  //primero eliminanos la imagen antes de agregarla
                Storage::delete($categorie->imagen);
            }
            $path = Storage::putFile("categories",$request->file("categorie_imagen"));
            $request->request->add(["imagen"=>$path]); //agregamos la imagen
        }
        
        $categorie -> update ($request->all());
        return response ()->json([
            "message" => 200,
            "categorie" => [
                "id"=>$categorie->id,
                    "name"=>$categorie->name,
                    "state"=>$categorie->state, 
                    "imagen"=> $categorie->imagen ? env("APP_URL")."storage/".$categorie->imagen : NULL,
                    "created_at"=>$categorie->created_at->format ("Y-m-d h:i A")
            ],
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $categorie = ProductCategorie :: findOrFail ($id);
        //Validacion por Requisicion o Papeleria y producto 
        $categorie ->delete ();
            return response() ->json([
                "message" => 200,
        ]);
    }

}
