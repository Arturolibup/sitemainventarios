<?php

namespace App\Http\Controllers\Configuration;

use Illuminate\Http\Request;
use App\Models\Configuration\Area;
use App\Http\Controllers\Controller;
use App\Models\Configuration\Subarea;
use App\Http\Controllers\Concerns\ApiResponses;

class SubareaController extends Controller
{
    use ApiResponses;

    public function __construct()
    {
        $this->middleware('auth:api');
        $this->middleware('permission:subareas.list')->only(['index']);
        $this->middleware('permission:subareas.view')->only(['show']);
        $this->middleware('permission:subareas.create')->only(['store']);
        $this->middleware('permission:subareas.update')->only(['update']);
        $this->middleware('permission:subareas.delete')->only(['destroy']);
    }

    public function index(Request $request)
    {
        $search = $request->get("search");

        $subareas = Subarea::with('area')
        ->where("name", "like", "%".$search."%")
        ->orderBy("id","desc")
        ->paginate(25);

        $areas = Area::orderBy("id", "desc")->get();

        return $this->successResponse([
            "total" => $subareas->total(),
            "subareas" => $subareas->map(function ($subarea) {
                return [
                    "id" => $subarea->id,
                    "name" => $subarea->name,
                    "localidad" => $subarea->localidad,
                    "area_id" => $subarea->area_id,
                    "area" => $subarea->area ? [
                        "id" => $subarea->area->id,
                        "name" => $subarea->area->name,
                        "urs" => $subarea->area->urs,
                        
                    ] : null,
                    "municipio" => $subarea->municipio,
                    "created_at" => $subarea->created_at->format("Y-m-d h:i A")
                ];
            }),
            "areas" => $areas->map(function ($area) {
                return [
                    "id" => $area->id,
                    "name" => $area->name,
                    "urs" => $area->urs,
                ];
            }),
        ]);
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'localidad' => 'required|string|max:255',
            'municipio' => 'required|string|max:255',
            'area_id' => 'required|exists:areas,id'
        ]);


        $if_exist_subarea = Subarea::where("name", $request->name)->first();
        if ($if_exist_subarea) {
            return response()->json([
                "message" => 403,
                "message_text" => "La Subarea ya Existe"
            ]);
        }
        $subarea = Subarea::create($request->all());
        return $this->successResponse([
            "message" => 200,
            "subarea" => [
                "id" => $subarea->id,
                "name" => $subarea->name,
                "localidad" => $subarea->localidad,
                "municipio" => $subarea->municipio,
                "area_id" => $subarea->area_id,
                "area" => $subarea->area ? [
                    "id" => $subarea->area->id,
                    "name" => $subarea->area->name
                ] : null,
                "created_at" => $subarea->created_at->format("Y-m-d h:i A")
            ],
        ]);
    }

    public function show(string $id)
    {
        //
    }

    public function update(Request $request, string $id)
    {

        $request->validate([
            'name' => 'required|string|max:255',
            'localidad' => 'required|string|max:255',
            'municipio' => 'required|string|max:255',
            'area_id' => 'required|exists:areas,id'
        ]);

        $if_exist_subarea = Subarea::where("name", $request->name)
            ->where("id", "<>", $id)->first();
        if ($if_exist_subarea) {
            return response()->json([
                "message" => 403,
                "message_text" => "La Subarea ya Existe"
            ]);
        }
        $subarea = Subarea::findOrFail($id);
        $subarea->update($request->all());
        return $this->successResponse([
            "message" => 200,
            "subarea" => [
                "id" => $subarea->id,
                "name" => $subarea->name,
                "localidad" => $subarea->localidad,
                "municipio" => $subarea->municipio,
                "area_id" => $subarea->area_id,
                "area" => $subarea->area ? [
                    "id" => $subarea->area->id,
                    "name" => $subarea->area->name
                ] : null,
                "created_at" => $subarea->created_at->format("Y-m-d h:i A")
            ],
        ]);
    }

    public function destroy(string $id)
    {
        $subarea = Subarea::findOrFail($id);
        $subarea->delete();
        return $this->successResponse([
            "message" => 200,
        ]);
    }

    public function getMunicipios()
    {
        $municipios = [
            "ACAPONETA", "AHUACATLAN", "AMATLAN DE CAÑAS", "COMPOSTELA", "HUAJICORI",
            "IXTLAN DEL RIO", "JALA", "XALISCO", "DEL NAYAR", "ROSAMORADA",
            "RUIZ", "SAN BLAS", "SAN PEDRO LAGUNILLAS", "SANTA MARIA DEL ORO", "SANTIAGO IXCUINTLA",
            "RECUALA", "TEPIC", "TUXPAN", "LA YESCA", "BAHIA DE BANDERAS"
        ];
        return $this->successResponse($municipios);
    }

    public function validateUniqueness(Request $request)
{
    $field = $request->get('field');
    $value = $request->get('value');

    if (!$field || !$value) {
        return response()->json([
            'exists' => false,
            'error' => 'Parámetros inválidos'
        ], 400);
    }

    $exists = Subarea::where($field, $value)->exists();

    return $this->successResponse([
        'exists' => $exists
    ]);
}

public function search(Request $request)
{
    $search = $request->get('search', ''); // Término de búsqueda

    if (empty($search)) {
        return $this->successResponse(['subareas' => []]);
    }

    $subareas = Subarea::with('area')
        ->searchByNombre($search)
        ->orderBy('name', 'asc')
        ->limit(10) // Límite para eficiencia
        ->get();

    return $this->successResponse([
        'subareas' => $subareas->map(function ($subarea) {
            return [
                'id' => $subarea->id,
                'name' => $subarea->name,
                'localidad' => $subarea->localidad,
                'municipio' => $subarea->municipio,
                'area_id' => $subarea->area_id,
                'area' => $subarea->area ? [
                    'id' => $subarea->area->id,
                    'name' => $subarea->area->name,
                    'urs' => $subarea->area->urs,
                ] : null,
            ];
        }),
    ]);
}

public function getByArea($areaId)
{
    $subareas = Subarea::where('area_id', $areaId)
        ->select('id', 'name', 'area_id', 'localidad', 'municipio')
        ->orderBy('name')
        ->get();

    return $this->successResponse([
        'total' => $subareas->count(),
        'subareas' => $subareas
    ]);
}


}
