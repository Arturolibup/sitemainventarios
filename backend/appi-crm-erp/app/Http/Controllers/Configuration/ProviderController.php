<?php

namespace App\Http\Controllers\Configuration;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use App\Models\Configuration\Provider;
use Illuminate\Support\Facades\Storage;

class ProviderController extends Controller
{
    public function index(Request $request)
    {
        $search = $request->get("search");

   
        $providers = Provider::where("full_name", "like", "%".$search."%")->orderBy("id","desc")->paginate(25);
        
        return response()->json([
            "total" =>$providers -> total(),
            "providers" => $providers ->map(function ($provider){
                return [
                    "id"=>$provider->id,
                    "full_name"=>$provider->full_name,
                    "rfc"=>$provider->rfc,
                    "email"=>$provider->email,
                    "phone"=>$provider->phone,
                    "address"=>$provider->address,
                    "imagen"=> $provider->imagen ? env("APP_URL")."storage/".$provider->imagen : NULL,
                    "state"=>$provider->state,
                    "created_at"=>$provider->created_at->format ("Y-m-d h:i A")
                ];
            }),
        ]);
    }

    


    public function store(Request $request)
    {
        $is_exist_provider = Provider::where("full_name", $request->full_name)->first();
        if($is_exist_provider){
            return response()->json([
                "message" => 403,
                "message_text" => "El Nombre del Proveedor ya Existe"
            ]);
        }

        $is_exist_provider = Provider::where("rfc", $request->rfc)->first();
        if($is_exist_provider){
            return response()->json([
                "message" => 403,
                "message_text" => "El RFC del Proveedor ya Existe"
            ]);
        }

        if($request->hasFile("provider_imagen"))
        {
            $path = Storage::putFile("providers",$request->file("provider_imagen"));
            $request->request->add(["imagen"=>$path]); //agregamos la imagen
        }

        $provider = Provider::create ($request->all());
        return response ()->json([
            "message" => 200,
            "provider" => [
                "id"=>$provider->id,
                    "full_name"=>$provider->full_name,
                    "rfc"=>$provider->rfc,
                    "email"=>$provider->email,
                    "phone"=>$provider->phone,
                    "address"=>$provider->address,
                    "imagen"=> $provider->imagen ? env("APP_URL")."storage/".$provider->imagen : NULL,
                    "state"=>$provider->state,
                    "created_at"=>$provider->created_at->format ("Y-m-d h:i A")
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
        $is_exist_provider = Provider::where("full_name", $request->full_name)
                        -> where ("id", "<>", $id) ->first();
        if($is_exist_provider){
            return response()->json([
                "message" => 403,
                "message_text" => "El Nombre del Proveedor ya Existe"
            ]);
        }
        $is_exist_provider = Provider::where("rfc", $request->rfc)
                        -> where ("id", "<>", $id) ->first();
        if($is_exist_provider){
            return response()->json([
                "message" => 403,
                "message_text" => "El RFC del Proveedor ya Existe"
            ]);
        }


        $provider = Provider::findOrFail ($id);

        if($request->hasFile("provider_imagen"))
        {
            if($provider->imagen){  //primero eliminanos la imagen antes de agregarla
                Storage::delete($provider->imagen);
            }
            $path = Storage::putFile("providers",$request->file("provider_imagen")); //key provider_imagen
            $request->request->add(["imagen"=>$path]); //agregamos la imagen
        }
        
        $provider -> update ($request->all());
        return response ()->json([
            "message" => 200,
            "provider" => [
                "id"=>$provider->id,
                "full_name"=>$provider->full_name,
                "rfc"=>$provider->rfc,
                "email"=>$provider->email,
                "phone"=>$provider->phone,
                "address"=>$provider->address,
                "imagen"=> $provider->imagen ? env("APP_URL")."storage/".$provider->imagen : NULL,
                "state"=>$provider->state,
                "created_at"=>$provider->created_at->format ("Y-m-d h:i A")
            ],
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $provider = Provider:: findOrFail ($id);
        //Validacion por Requisicion o Papeleria y producto 
        $provider ->delete ();
            return response() ->json([
                "message" => 200,
        ]);
    }
}
