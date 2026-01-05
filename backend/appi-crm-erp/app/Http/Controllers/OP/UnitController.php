<?php

namespace App\Http\Controllers\OP;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class UnitController extends Controller
{
    /**
     * Listar todas las unidades de medida
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $units = Unit::where('deleted_at', null)->get();
        return response()->json($units, 200); // Devolver el array directamente
    }
}
