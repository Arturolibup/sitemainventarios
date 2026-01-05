<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Provider;
use Illuminate\Http\Request;

class ProviderController extends Controller
{
    /**
     * Listar todos los proveedores, con búsqueda por coincidencia
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        $query = Provider::where('deleted_at', null)
            ->select('id', 'full_name', 'rfc', 'email', 'phone');

        // Búsqueda por coincidencia si se proporciona query
        if ($request->has('query') && !empty($request->query)) {
            $searchTerm = $request->query;
            $query->whereRaw('MATCH(full_name) AGAINST(? IN BOOLEAN MODE)', [$searchTerm . '*']);
        }

        // Paginación para limitar los resultados
        $perPage = $request->input('per_page', 10);
        $page = $request->input('page', 1);
        $providers = $query->paginate($perPage, ['*'], 'page', $page);

        \Log::info("Proveedores buscados: " . json_encode($providers));
        return response()->json([
            'total' => $providers->total(),
            'providers' => $providers->items()
        ], 200);
    }
}