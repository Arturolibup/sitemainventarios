<?php

namespace App\Http\Controllers\Configuration;

use Illuminate\Http\Request;
use App\Models\configuration\Unit;
use App\Http\Controllers\Controller;
use App\Models\configuration\UnitTransform;
use App\Http\Controllers\Configuration\UnitController;
use App\Http\Controllers\Concerns\ApiResponses;

class UnitController extends Controller
{
    use ApiResponses;

    public function index(Request $request)
    {
        $search = $request->get("search");

   
        $units = Unit::where("name", "like", "%".$search."%")->orderBy("id","desc")->paginate(25);
        
        return $this->successResponse([
            "total" =>$units -> total(),
            "units" => $units ->map(function ($unit){
                return [
                    "id"=>$unit->id,
                    "name"=>$unit->name,
                    "state"=>$unit->state,
                    "description"=>$unit->description,
                    "created_at"=>$unit->created_at->format ("Y-m-d h:i A"),
                    "transforms"=>$unit->transforms -> map(function ($transfor){
                        $transfor ->unit_to = $transfor ->unit_to;
                        return $transfor;
                        }),//ponemos la relacion 
                ];
            }),
        ]);
    }


    public function store(Request $request)
    {
        $is_exist_unit = Unit::where("name", $request->name)->first();
        if($is_exist_unit){
            return response()->json([
                "message" => 403,
                "message_text" => "El Nombre de la Unidad ya Existe"
            ]);
        }


        $unit = Unit::create ($request->all());
        return $this->successResponse([
            "message" => 200,
            "unit" => [
                "id"=>$unit->id,
                "name"=>$unit->name,
                "state"=>$unit->state ?? 1,
                "description"=>$unit->description,
                "transforms"=>$unit->transforms -> map(function ($transfor){
                        $transfor ->unit_to = $transfor ->unit_to;
                        return $transfor;
                        }), //ponemos la relacion de la lista que esta relacionado
                "created_at"=>$unit->created_at->format ("Y-m-d h:i A")
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
        $is_exist_unit = Unit::where("name", $request->name)
                        -> where ("id", "<>", $id) ->first();
        if($is_exist_unit){
            return response()->json([
                "message" => 403,
                "message_text" => "La Unidad ya Existe"
            ]);
        }
        
        $unit = Unit::findOrFail ($id);
        $unit -> update ($request->all());
        return $this->successResponse([
            "message" => 200,
            "unit" => [
                "id"=>$unit->id,
                "name"=>$unit->name,
                "state"=>$unit->state,
                "description"=>$unit->description,
                "transforms"=>$unit->transforms -> map(function ($transfor){
                        $transfor ->unit_to = $transfor ->unit_to;
                        return $transfor;
                        }),
                "created_at"=>$unit->created_at->format ("Y-m-d h:i A")
        ],
        ]);
    }

    public function delete_transform($id){
        $unit = UnitTransform::findOrFail($id);
        $unit -> delete();
        return $this->successResponse([
            "message" => 200,
        ]);
    }

    public function add_transform(Request $request){
        $is_exist_unit = UnitTransform::where("unit_id", $request->unit_id)
                        ->where("unit_to_id", $request->unit_to_id)
                        ->first();
        if($is_exist_unit){
            return response()->json([
                "message" => 403,
                "message_text" => "La Unidad ya Existe"
            ]);
        }
        $unit = UnitTransform::create ([ // lo que se envia del fronted
            "unit_id" => $request->unit_id,
            "unit_to_id"=>$request->unit_to_id,
        ]);
        return $this->successResponse([
            "message" => 200,
            "unit" => [
                "id"=>$unit->id,
                "unit_id"=>$unit->unit_id,
                "unit_to_id"=>$unit->unit_to_id, 
                "unit_to"=>$unit->unit_to, //la relacion del unitcontroller
                
                "created_at"=>$unit->created_at->format ("Y-m-d h:i A")
            ],
        ]);

    }
    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $unit = Unit:: findOrFail ($id);
        //Validacion por Requisicion o Papeleria y producto 
        $unit ->delete ();
            return $this->successResponse([
                "message" => 200,
        ]);
    }
}
