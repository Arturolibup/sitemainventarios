<?php

namespace App\Http\Controllers\Signatory;

use Illuminate\Http\Request;

use Illuminate\Validation\Rule;
use Illuminate\Http\JsonResponse;
use App\Models\Signatory\Signatory;
use App\Http\Controllers\Controller;


class SignatoryController extends Controller
{
    /**
     * Lista todos los firmantes con paginación
     */
    public function index(Request $request): JsonResponse
{
    try {
        $perPage = $request->get('per_page', 10);
        $search = $request->get('search', '');
        
        $query = Signatory::query();
        
        if ($search) {
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%$search%")
                  ->orWhere('departament', 'like', "%$search%")
                  ->orWhere('position', 'like', "%$search%");
            });
        }
        
        $signatories = $query->orderBy('departament')
                            ->orderBy('order')
                            ->paginate($perPage);

        // ✅ BUENA PRÁCTICA: Separar datos y metadatos
        return response()->json([
            'success' => true,
            'data' => $signatories->items(), // ← ARRAY puro
            'meta' => [
                'current_page' => $signatories->currentPage(),
                'last_page' => $signatories->lastPage(),
                'per_page' => $signatories->perPage(),
                'total' => $signatories->total(),
            ],
            'message' => 'Lista obtenida exitosamente'
        ]);
        
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Error interno: ' . $e->getMessage()
        ], 500);
    }
}

    /**
     * Crear un nuevo firmante
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $validated = $request->validate([
                'departament' => 'required|string|max:100',
                'position'    => 'required|string|max:150',
                'name'        => 'required|string|max:200',
                'title'       => 'nullable|string|max:50',
                'is_active'   => 'sometimes|boolean',
                'order'       => 'required|integer|min:0',
            ]);

            // Verificar si el departamento ya existe
            $existing = Signatory::where('departament', $validated['departament'])->first();
            
            if ($existing) {
                return response()->json([
                    'success' => false,
                    'message' => 'El departamento ya existe en el sistema',
                    'error' => 'El departamento "' . $validated['departament'] . '" ya está registrado'
                ], 422);
            }

            $signatory = Signatory::create($validated);

            return response()->json([
                'success' => true,
                'data' => $signatory,
                'message' => 'Firmante creado exitosamente'
            ], 201);
            
        } catch (QueryException $e) {
            // Manejo específico de errores de base de datos
            if ($e->getCode() == 23000) {
                return response()->json([
                    'success' => false,
                    'message' => 'Error de duplicado: El departamento ya existe',
                    'error' => $e->getMessage()
                ], 422);
            }
            
            return response()->json([
                'success' => false,
                'message' => 'Error en la base de datos',
                'error' => $e->getMessage()
            ], 500);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al crear: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Mostrar un firmante específico
     */
    public function show(string $id): JsonResponse
    {
        try {
            $signatory = Signatory::findOrFail($id);

            return response()->json([
                'success' => true,
                'data' => $signatory
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Firmante no encontrado'
            ], 404);
        }
    }

    /**
     * Actualizar firmante existente
     */
    public function update(Request $request, string $id): JsonResponse
    {
        try {
            $signatory = Signatory::findOrFail($id);

            $validated = $request->validate([
                'departament' => 'required|string|max:100',
                'position'    => 'required|string|max:150',
                'name'        => 'required|string|max:200',
                'title'       => 'nullable|string|max:50',
                'is_active'   => 'sometimes|boolean',
                'order'       => 'required|integer|min:0',
            ]);

            // Verificar si el departamento ya existe (excluyendo el actual)
            $existing = Signatory::where('departament', $validated['departament'])
                                ->where('id', '!=', $id)
                                ->first();
            
            if ($existing) {
                return response()->json([
                    'success' => false,
                    'message' => 'El departamento ya existe en otro registro',
                    'error' => 'El departamento "' . $validated['departament'] . '" ya está registrado'
                ], 422);
            }

            $signatory->update($validated);

            return response()->json([
                'success' => true,
                'data' => $signatory,
                'message' => 'Firmante actualizado exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al actualizar: ' . $e->getMessage()
            ], 500);
        }
    }

    public function destroy(string $id): JsonResponse
    {
        try {
            $signatory = Signatory::findOrFail($id);
            
            // 1. Verificar si el firmante está siendo usado
            $isUsed = $this->isSignatoryUsed($signatory);
            
            if ($isUsed) {
                // 2. Si está usado, solo permitir desactivar
                return response()->json([
                    'success' => false,
                    'message' => 'No se puede eliminar el firmante',
                    'reason' => 'Está siendo utilizado en documentos del sistema',
                    'suggestion' => 'Puede desactivarlo en lugar de eliminarlo',
                    'action' => 'deactivate_only', // Nueva clave para el frontend
                    'usage_details' => $this->getUsageDetails($signatory)
                ], 422);
            }
            
            // 3. Si NO está usado, eliminar físicamente (solo para pruebas o errores)
            $signatory->delete();
            
            return response()->json([
                'success' => true,
                'message' => 'Firmante eliminado permanentemente',
                'action' => 'deleted'
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al eliminar: ' . $e->getMessage()
            ], 500);
        }
    }

    // Método para verificar uso
    private function isSignatoryUsed(Signatory $signatory): bool
    {
        // Aquí debes verificar si el firmante está siendo usado
        // Por ahora, verificamos solo si está activo (como ejemplo)
        // En producción, verificarías tablas relacionadas
        
        // Ejemplo: Verificar en tabla de vales
        // return Voucher::where('signatory_id', $signatory->id)->exists();
        
        // Por ahora, retornamos false para permitir eliminación en pruebas
        return false;
    }

    // Método para obtener detalles de uso
    private function getUsageDetails(Signatory $signatory): array
    {
        // Ejemplo de datos de uso
        return [
            'vouchers_count' => 0, // Voucher::where('signatory_id', $signatory->id)->count(),
            'requisitions_count' => 0, // Requisition::where('signatory_id', $signatory->id)->count(),
            'last_used' => null, // Última fecha de uso
            'can_deactivate' => true // Siempre se puede desactivar
        ];
    }

    // NUEVO MÉTODO: Para desactivar firmante
    public function deactivate(string $id): JsonResponse
    {
        try {
            $signatory = Signatory::findOrFail($id);
            
            $signatory->update(['is_active' => false]);
            
            return response()->json([
                'success' => true,
                'data' => $signatory,
                'message' => 'Firmante desactivado exitosamente',
                'action' => 'deactivated'
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al desactivar: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Método config para obtener datos de configuración
     */
    public function config(): JsonResponse
    {
        try {
            $departments = Signatory::distinct()
                ->whereNotNull('departament')
                ->pluck('departament')
                ->sort()
                ->values();
            
            $positions = Signatory::distinct()
                ->whereNotNull('position')
                ->pluck('position')
                ->sort()
                ->values();
            
            $titles = Signatory::distinct()
                ->whereNotNull('title')
                ->pluck('title')
                ->sort()
                ->values();
            
            return response()->json([
                'success' => true,
                'data' => [
                    'departments' => $departments,
                    'positions' => $positions,
                    'titles' => $titles,
                    'stats' => [
                        'total' => Signatory::count(),
                        'active' => Signatory::where('is_active', true)->count(),
                        'inactive' => Signatory::where('is_active', false)->count(),
                    ]
                ]
            ]);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error en configuración: ' . $e->getMessage()
            ], 500);
        }
    }
}