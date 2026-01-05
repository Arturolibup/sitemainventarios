<?php

namespace App\Http\Controllers\Configuration;

use Illuminate\Http\Request;
use App\Models\Configuration\Area;
use App\Http\Controllers\Controller;

class AreaController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth:api');
        $this->middleware('permission:areas.list')->only(['index']);
        $this->middleware('permission:areas.view')->only(['show']);
        $this->middleware('permission:areas.create')->only(['store']);
        $this->middleware('permission:areas.update')->only(['update']);
        $this->middleware('permission:areas.delete')->only(['destroy']);
    }/**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $search = $request->get("search");

   
        $areas = Area::where("name", "like", "%".$search."%")->orderBy("id","desc")->paginate(25);
    

    return response()->json([
        "total" =>$areas -> total(),
        "areas" => $areas ->map(function ($areas){
            return [
                "id"=>$areas->id,
                "name"=>$areas->name,
                "address"=>$areas->address,
                "municipio"=>$areas->municipio,
                "created_at"=>$areas->created_at->format ("Y-m-d h:i A")
            ];
        }),
    ]);

    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $if_exist_area = Area::where("name", $request->name)->first();
        if($if_exist_area){
            return response()->json([
                "message" => 403,
                "message_text" => "El Area ya Existe"
            ]);
        }
        $area = Area::create ($request->all());
        return response ()->json([
            "message" => 200,
            "area" => [
                "id"=> $area -> id,
                "name"=> $area ->name,
                "municipio"=> $area-> municipio,
                "address"=> $area -> address,
                "created_at"=> $area -> created_at -> format ("Y-m-d h:i A")
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
        $if_exist_area = Area::where("name", $request->name)
                        -> where ("id", "<>", $id) ->first();
        if($if_exist_area){
            return response()->json([
                "message" => 403,
                "message_text" => "El Area ya Existe"
            ]);
        }
        $area = Area::findOrFail ($id);
        $area -> update ($request->all());
        return response ()->json([
            "message" => 200,
            "area" => [
                "id"=> $area -> id,
                "name"=> $area ->name,
                "municipio"=> $area-> municipio,
                "address"=> $area -> address,
                "created_at"=> $area -> created_at -> format ("Y-m-d h:i A")
            ],
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $area = Area :: findOrFail ($id);
        //Validacion por Requisicion o Papeleria
        $area ->delete ();
            return response() ->json([
                "message" => 200,
        ]);
    }
// agregar municipios
    public function getMunicipios()
    {
    $municipios = [
        "ACAPONETA", "AHUACATLAN", "AMATLAN DE CAÑAS", "COMPOSTELA", "HUAJICORI",
        "IXTLAN DEL RIO", "JALA", "XALISCO", "DEL NAYAR", "ROSAMORADA",
        "RUIZ", "SAN BLAS", "SAN PEDRO LAGUNILLAS", "SANTA MARIA DEL ORO", "SANTIAGO IXCUINTLA",
        "RECUALA", "TEPIC", "TUXPAN", "LA YESCA", "BAHIA DE BANDERAS"
    ];
    
    return response()->json($municipios);
    }
}
