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

class MarcaController extends Controller
{
    /**
     * Obtener la lista de marcas, con soporte para búsqueda por coincidencia.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return JsonResponse
     */
    public function index(Request $request): JsonResponse
    {
        $search = $request->query('search', '');
        $marcas = Marca::select('id', 'nombre')
            ->where('nombre', 'like', "%{$search}%")
            ->get();

        return response()->json(['marcas' => $marcas], 200);
    }

    /**
     * Crear una nueva marca.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return JsonResponse
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'nombre' => 'required|string|max:255|unique:marcas,nombre',
        ]);

        $marca = Marca::create([
            'nombre' => strtoupper($request->nombre),
        ]);

        return response()->json([
            'message' => 200,
            'marca' => [
                'id' => $marca->id,
                'nombre' => $marca->nombre,
                'created_at' => $marca->created_at->format('Y-m-d h:i A'),
            ],
        ], 200);
    }

    /**
     * Mostrar una marca específica.
     *
     * @param  string  $id
     * @return JsonResponse
     */
    public function show(string $id): JsonResponse
    {
        $marca = Marca::findOrFail($id);

        return response()->json([
            'marca' => [
                'id' => $marca->id,
                'nombre' => $marca->nombre,
                'created_at' => $marca->created_at->format('Y-m-d h:i A'),
            ],
        ], 200);
    }

    /**
     * Actualizar una marca existente.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  string  $id
     * @return JsonResponse
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'nombre' => 'required|string|max:255|unique:marcas,nombre,' . $id,
        ]);

        $marca = Marca::findOrFail($id);
        $marca->update([
            'nombre' => strtoupper($request->nombre),
        ]);

        return response()->json([
            'message' => 200,
            'marca' => [
                'id' => $marca->id,
                'nombre' => $marca->nombre,
                'created_at' => $marca->created_at->format('Y-m-d h:i A'),
            ],
        ], 200);
    }

    /**
     * Eliminar una marca (soft delete).
     *
     * @param  string  $id
     * @return JsonResponse
     */
    public function destroy(string $id): JsonResponse
    {
        $marca = Marca::findOrFail($id);
        if ($marca->tipos()->count() > 0) {
            return response()->json([
                'message' => 403,
                'message_text' => 'No se puede eliminar la marca porque tiene tipos asociados',
            ], 403);
        }
        $marca->delete();

        return response()->json([
            'message' => 200,
        ], 200);
    }
}

