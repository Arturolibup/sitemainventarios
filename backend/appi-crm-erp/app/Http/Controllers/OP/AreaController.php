<?php

namespace App\Http\Controllers\OP;

use Illuminate\Http\Request;
use App\Models\Configuration\Area;
use App\Http\Controllers\Controller;

class AreaController extends Controller
{
    /**
     * Listar todas las áreas
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $areas = Area::where('deleted_at', null)->get();
        return response()->json($areas, 200); // Devolver el array directamente
    }
}
