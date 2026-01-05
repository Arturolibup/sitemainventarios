<?php

namespace App\Http\Controllers\OP;

use Carbon\Carbon;
use App\Models\Product\Tipo;
use Illuminate\Http\Request;
use App\Models\Product\Marca;
use Illuminate\Http\JsonResponse;
use App\Http\Controllers\Controller;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class TipoController extends Controller
{
    /**
     * Obtener la lista de tipos, opcionalmente filtrados por marca_id y búsqueda por coincidencia.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $marca_id = $request->query('marca_id');
        $search = $request->query('search', '');

        if ($marca_id && !Marca::where('id', $marca_id)->exists()) {
            return response()->json([
                'error' => 'El marca_id proporcionado no existe',
            ], 404);
        }

        $tipos = Tipo::select('id', 'nombre', 'marca_id')
            ->when($marca_id, function ($query, $marca_id) {
                return $query->where('marca_id', $marca_id);
            })
            ->where('nombre', 'like', "%{$search}%")
            ->get();

        return response()->json(['tipos' => $tipos], 200);
    }

    /**
     * Crear un nuevo tipo.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'nombre' => 'required|string|max:255',
            'marca_id' => 'required|exists:marcas,id',
        ]);

        $tipo = Tipo::create([
            'nombre' => strtoupper($request->nombre),
            'marca_id' => $request->marca_id,
        ]);

        return response()->json([
            'message' => 200,
            'tipo' => [
                'id' => $tipo->id,
                'nombre' => $tipo->nombre,
                'marca_id' => $tipo->marca_id,
                'created_at' => $tipo->created_at->format('Y-m-d h:i A'),
            ],
        ], 200);
    }

    /**
     * Mostrar un tipo específico.
     *
     * @param  string  $id
     * @return JsonResponse
     */
    public function show(string $id): JsonResponse
    {
        $tipo = Tipo::findOrFail($id);

        return response()->json([
            'tipo' => [
                'id' => $tipo->id,
                'nombre' => $tipo->nombre,
                'marca_id' => $tipo->marca_id,
                'created_at' => $tipo->created_at->format('Y-m-d h:i A'),
            ],
        ], 200);
    }

    /**
     * Actualizar un tipo existente.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  string  $id
     * @return JsonResponse
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'nombre' => 'required|string|max:255',
            'marca_id' => 'required|exists:marcas,id',
        ]);

        $tipo = Tipo::findOrFail($id);
        $tipo->update([
            'nombre' => strtoupper($request->nombre),
            'marca_id' => $request->marca_id,
        ]);

        return response()->json([
            'message' => 200,
            'tipo' => [
                'id' => $tipo->id,
                'nombre' => $tipo->nombre,
                'marca_id' => $tipo->marca_id,
                'created_at' => $tipo->created_at->format('Y-m-d h:i A'),
            ],
        ], 200);
    }

    /**
     * Eliminar un tipo (soft delete).
     *
     * @param  string  $id
     * @return JsonResponse
     */
    public function destroy(string $id): JsonResponse
    {
        $tipo = Tipo::findOrFail($id);
        if ($tipo->vehiculos()->count() > 0) {
            return response()->json([
                'message' => 403,
                'message_text' => 'No se puede eliminar el tipo porque está asociado a vehículos',
            ], 403);
        }
        $tipo->delete();

        return response()->json([
            'message' => 200,
        ], 200);
    }
}
