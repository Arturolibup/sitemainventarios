<?php

namespace App\Http\Controllers;


use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\Configuration\Area;
use App\Http\Controllers\Controller;
use App\Models\Configuration\Subarea;

class SubareaController extends Controller
{
    /**
     * Listar todas las subáreas, con búsqueda por coincidencia y opcionalmente filtradas por área
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function index(Request $request)
    {
        $query = Subarea::where('deleted_at', null)
            ->select('id', 'name', 'area_id')
            ->with(['area' => function ($q) {
                $q->select('id', 'name');
            }]);

        // Filtrar por área si se proporciona area_id
        if ($request->has('area_id')) {
            $query->where('area_id', $request->area_id);
        }

        // Búsqueda por coincidencia si se proporciona query
        if ($request->has('query') && !empty($request->query('query'))) {
            $searchTerm = $request->query('query');
            $query->whereRaw('MATCH(name) AGAINST(? IN BOOLEAN MODE)', [$searchTerm . '*']);
        }

        // Paginación para limitar los resultados
        $perPage = $request->input('per_page', 10);
        $page = $request->input('page', 1);
        $subareas = $query->paginate($perPage, ['*'], 'page', $page);

        // Añadimos un log para depurar los valores de area_id
        $areaIds = $subareas->items()->pluck('area_id')->unique()->toArray();
        \Log::info("Valores de area_id en las subáreas: " . json_encode($areaIds));

        // Verificamos si las áreas existen en la tabla areas
        $existingAreas = Area::whereIn('id', $areaIds)->pluck('id')->toArray();
        \Log::info("Áreas existentes en la tabla areas: " . json_encode($existingAreas));

        \Log::info("Subáreas buscadas con relaciones: " . json_encode($subareas->items()));

        return response()->json([
            'total' => $subareas->total(),
            'subareas' => $subareas->items()
        ], 200);
    }

}