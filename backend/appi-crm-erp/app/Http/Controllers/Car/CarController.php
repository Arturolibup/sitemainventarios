<?php

namespace App\Http\Controllers\Car;

use App\Models\Car\Car;
use Illuminate\Support\Str;
use App\Models\Product\Tipo;
use Illuminate\Http\Request;
use App\Models\Product\Marca;
use Illuminate\Validation\Rule;
use App\Models\Configuration\Area;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Http\Controllers\Controller;
use App\Models\Configuration\Subarea;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class CarController extends Controller
{

    public function __construct()
    {
       
    $this->middleware('auth:api');
    $this->middleware('permission:vehicles.list')->only(['index']);
    $this->middleware('permission:vehicles.view')->only(['show']);
    $this->middleware('permission:vehicles.create')->only(['store']);
    $this->middleware('permission:vehicles.update')->only(['update']);
    $this->middleware('permission:vehicles.delete')->only(['destroy']);
    }/**
     * Lista todos los vehículos con paginación y búsqueda.
     * Optimizado con eager loading para evitar N+1.
     */
    public function index(Request $request)
    {
        
        //Valido parametros 
        $validated = $request->validate([
            'search' => 'sometimes|string|nullable|max:100',
            'per_page' => 'sometimes|integer|min:1|max:100',
            'sort_by' => 'sometimes|in:created_at,numero_eco,placa',
            'sort_dir' => 'sometimes|in:asc,desc'
        ]);

        // 2. Obtener valores con defaults
        $search = $validated['search'] ?? '';
        $perPage = $validated['per_page'] ?? 25;
        $sortBy = $validated['sort_by'] ?? 'created_at';
        $sortDir = $validated['sort_dir'] ?? 'desc';

        // 3. Consulta optimizada
        $query = Car::query()
        ->with([
            'marca:id,nombre',
            'tipo:id,nombre',
            'subarea:id,name,area_id',
            'area:id,name'
        ])
        ->when($search !=='', function ($query) use ($search) {
            $query->where(function($q) use ($search) {
                $q->where('numero_eco', 'like', "%$search%")
                  ->orWhere('placa', 'like', "%$search%")
                  ->orWhere('modelo', 'like', "%$search%")
                  ->orWhereHas('subarea', function($q) use ($search) {
                      $q->where('name', 'like', "%$search%");
                  })
                  ->orWhereHas('marca', function ($q) use ($search) {
                      $q->where('nombre', 'like', "%$search%");
                  })
                  ->orWhereHas('tipo', function ($q) use ($search) {
                      $q->where('nombre', 'like', "%$search%");
                  });
            });
        })
        // 4. Ordenamiento seguro    
        ->orderBy($sortBy, $sortDir)
        // 5. Paginación eficiente
        ->paginate($perPage);
        

        
    // 6. Transformación de datos mejorada
    return response()->json([
        'meta' => [
            'total' => $query->total(),
            'per_page' => $query->perPage(),
            'current_page' => $query->currentPage(),
            'last_page' => $query->lastPage(),
            'search_term' => $search // Para referencia del cliente
        ],
        'data' => $query->map(function ($vehicle) {
            return $this->formatVehicleResponse($vehicle);
        })
    ]);
}

// Método auxiliar para mapear campos de ordenamiento
private function mapSortField(string $field): string
{
    $mapping = [
        'subarea.name' => 'subareas.name' // Mapea a la relación
    ];
    
    return $mapping[$field] ?? $field;
}

// Formateo mejorado de respuesta
private function formatVehicleResponse(Car $vehicle): array
{
    return [
        'id' => $vehicle->id,
        'numero_eco' => $vehicle->numero_eco,
        //'marca_id' => $vehicle->marca_id,
        'marca' => $vehicle->marca ? [
            'id' => $vehicle->marca->id,
            'nombre' => $vehicle->marca->nombre
        ] : null,
        //'tipo_id' => $vehicle->tipo_id,
        'tipo' => $vehicle->tipo ? [
            'id' => $vehicle->tipo->id,
            'nombre' => $vehicle->tipo->nombre
        ] : null,
        'modelo' => $vehicle->modelo,
        'subarea_asigna' => $vehicle->subarea_asigna,
        'subarea' => $vehicle->subarea ? [
            'id' => $vehicle->subarea->id,
            'name' => $vehicle->subarea->name,
            'area' => $vehicle->subarea->area ? [
                'id' => $vehicle->subarea->area->id,
                'name' => $vehicle->subarea->area->name
            ] : null
        ] : null,
        'placa' => $vehicle->placa,
        'placa_anterior' => $vehicle->placa_anterior,
        'cilindro' => $vehicle->cilindro,
        'numero_serie' => $vehicle->numero_serie,
        'numero_inven' => $vehicle->numero_inven,
        'color' => $vehicle->color,
        'estado_actual' => $vehicle->estado_actual,
        'estado_asigna' => $vehicle->estado_asigna,
        "imagen_vehiculo" => $vehicle->imagen_vehiculo ? env("APP_URL")."storage/".$vehicle->imagen_vehiculo : NULL,
        'state' => $vehicle->state,
        'created_at' => $vehicle->created_at->format('Y-m-d H:i'),
        'updated_at' => $vehicle->updated_at->format('Y-m-d H:i')
    ];
}
    
    

    /**
     * Crea un nuevo vehículo con validaciones robustas y manejo de imágenes.
     * Usamos transacción para concurrencia multiusuario.
     */
    public function store(Request $request)
    {

        Log::info('Solicitud para crear vehículo:', ['request'=> $request->all()]);

        $request->merge([
            'numero_eco' => Str::upper($request->numero_eco ?? ''),
            'modelo' => Str::upper($request->modelo ?? ''),
            'placa' => Str::upper($request->placa ?? ''),
            'placa_anterior' => Str::upper($request->placa_anterior ?? ''),
            'cilindro' => Str::upper($request->cilindro ?? ''),
            'numero_serie' => Str::upper($request->numero_serie ?? ''),
            'numero_inven' => Str::upper($request->numero_inven ?? ''),
            'color' => Str::upper($request->color ?? ''),
            //'state' => $request->state === 'Activo' ? 1 : 0,
        ]);

        try {
            $request->validate([
                'numero_eco' => 'required|string|max:50|unique:vehiculos,numero_eco',
                'subarea_asigna' => 'required|exists:subareas,id',
                'area_id' => 'required|exists:areas,id',
                'marca_id' => 'required|exists:marcas,id',
                'tipo_id' => 'nullable|exists:tipos,id',
                'modelo' => 'nullable|string|max:100',
                'placa' => 'nullable|string|max:50|unique:vehiculos,placa',
                'placa_anterior' => 'nullable|string|max:50',
                'cilindro' => 'nullable|string|max:50',
                'numero_serie' => 'nullable|string|max:100|unique:vehiculos,numero_serie',
                'numero_inven' => 'nullable|string|max:100|unique:vehiculos,numero_inven',
                'color' => 'nullable|string|max:50',
                'estado_actual' => 'nullable|in:BUENO,REGULAR,MALO',
                'estado_asigna' => 'nullable|in:FORANEA,LOCAL,TRANSITORIO',
                'state' => 'nullable|in:0,1',
                'imagen_vehiculo' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:2048',
            ]);
        } catch (ValidationException $e) {
            Log::error('Validación fallida al crear vehículo:', ['errors' => $e->errors()]);
            return response()->json(['errors' => $e->errors()], 422);
        }

        return DB::transaction(function () use ($request) {
            $imagePath = null;
            if ($request->hasFile('imagen_vehiculo')) {
                $imagePath = $request->file('imagen_vehiculo')->store('vehiculos', 'public');
                Log::info('Imagen almacenada:', ['path' => $imagePath]);
            }

            $subarea = Subarea::findOrFail($request->subarea_asigna);
            Log::info('Subárea seleccionada:', ['subarea_id' => $request->subarea_asigna, 
                        'area_id' => $subarea->area_id]);
            if (!$subarea->area_id) {
                return response()->json(['message' => 'La subárea no tiene área asociada.'], 403);
            }

            $vehicle = Car::create([
                'numero_eco' => $request->numero_eco,
                'marca_id' => $request->marca_id,
                'tipo_id' => $request->tipo_id,
                'modelo' => $request->modelo,
                'subarea_asigna' => $request->subarea_asigna,
                'area_id' => $subarea->area_id,
                'placa' => $request->placa,
                'placa_anterior' => $request->placa_anterior,
                'cilindro' => $request->cilindro,
                'numero_serie' => $request->numero_serie,
                'numero_inven' => $request->numero_inven,
                'color' => $request->color,
                'estado_actual' => $request->estado_actual ?? 'BUENO',
                'estado_asigna' => $request->estado_asigna ?? 'LOCAL',
                'imagen_vehiculo' => $imagePath,
                'state' => $request->state ?? 1,
            ]);

            Log::info('Vehículo creado:', ['id' => $vehicle->id]);
            return response()->json(['message' => 'Vehículo creado con éxito.', 'vehicle' => $this->formatVehicleResponse($vehicle)], 201);
        });
    }

    /**
     * Muestra detalle de un vehículo.
     */
    public function show($id)
    {
        $vehicle = Car::with(['marca', 'tipo', 'subarea.area'])->findOrFail($id);
        //$area = Area::find($vehicle->subarea->area_id);
        //$vehicle->subarea->area = $area ? ['id' => $area->id, 'name' => $area->name] : null;
        return response()->json(['vehicle' => $this->formatVehicleResponse($vehicle)], 200);
    }

    /**
     * Actualiza un vehículo.
     * Similar a store, con transacción.
     */
    public function update(Request $request, $id)
    {
        $vehicle = Car::findOrFail($id);
        Log::info('Solicitud para actualizar vehículo:', $request->all());

        $request->merge([
            'numero_eco' => Str::upper($request->numero_eco ?? ''),
            'modelo' => Str::upper($request->modelo ?? ''),
            'placa' => Str::upper($request->placa ?? ''),
            'placa_anterior' => Str::upper($request->placa_anterior ?? ''),
            'cilindro' => Str::upper($request->cilindro ?? ''),
            'numero_serie' => Str::upper($request->numero_serie ?? ''),
            'numero_inven' => Str::upper($request->numero_inven ?? ''),
            'color' => Str::upper($request->color ?? ''),
            //'state' => $request->state === 'Activo' ? 1 : 0,
        ]);

        try {
            $request->validate([
                'numero_eco' => ['required', 'string', 'max:50', Rule::unique('vehiculos', 'numero_eco')->ignore($id)],
                'subarea_asigna' => 'required|exists:subareas,id',
                'marca_id' => 'required|exists:marcas,id',
                'tipo_id' => 'nullable|exists:tipos,id',
                'modelo' => 'nullable|string|max:100',
                'placa' => ['nullable', 'required', 'string', 'max:50', Rule::unique('vehiculos', 'placa')->ignore($id)],
                'placa_anterior' => 'nullable|string|max:50',
                'cilindro' => 'nullable|string|max:50',
                'numero_serie' => ['nullable', 'string', 'max:100', Rule::unique('vehiculos', 'numero_serie')->ignore($id)],
                'numero_inven' => ['nullable', 'string', 'max:100', Rule::unique('vehiculos', 'numero_inven')->ignore($id)],
                'color' => 'nullable|string|max:50',
                'estado_actual' => 'nullable|in:BUENO,REGULAR,MALO',
                'estado_asigna' => 'nullable|in:FORANEA,LOCAL,TRANSITORIO',
                'state' => 'nullable|in:0,1',
                'imagen_vehiculo' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:2048',
            ]);
        } catch (ValidationException $e) {
            Log::error('Validación fallida al actualizar vehículo:', ['errors' => $e->errors()]);
            return response()->json(['errors' => $e->errors()], 422);
        }

        return DB::transaction(function () use ($request, $vehicle) {
            $imagePath = $vehicle->imagen_vehiculo;
            if ($request->hasFile('imagen_vehiculo')) {
                if ($imagePath) Storage::delete('public/' . $imagePath);
                $imagePath = $request->file('imagen_vehiculo')->store('vehiculos', 'public');
                Log::info('Imagen actualizada:', ['path' => $imagePath]);
            }

            $subarea = Subarea::findOrFail($request->subarea_asigna);
            if (!$subarea->area_id) {
                return response()->json(['message' => 'La subárea no tiene área asociada.'], 403);
            }

            $vehicle->update([
                'numero_eco' => $request->numero_eco,
                'marca_id' => $request->marca_id,
                'tipo_id' => $request->tipo_id,
                'modelo' => $request->modelo,
                'subarea_asigna' => $request->subarea_asigna,
                'area_id' => $subarea->area_id,
                'placa' => $request->placa,
                'placa_anterior' => $request->placa_anterior,
                'cilindro' => $request->cilindro,
                'numero_serie' => $request->numero_serie,
                'numero_inven' => $request->numero_inven,
                'color' => $request->color,
                'estado_actual' => $request->estado_actual ?? 'BUENO',
                'estado_asigna' => $request->estado_asigna ?? 'LOCAL',
                'imagen_vehiculo' => $imagePath,
                'state' => $request->state
            ]);
            

            Log::info('Vehículo actualizado:', ['id' => $vehicle->id]);
            return response()->json(['message' => 'Vehículo actualizado con éxito.', 'vehicle' => $this->formatVehicleResponse($vehicle)], 200);
        });
    }

    /**
     * Elimina (soft delete) un vehículo.
     */
    public function destroy($id)
    {
        $vehicle = Car::findOrFail($id);
        $vehicle->delete();
        Log::info('Vehículo eliminado (soft delete):', ['id' => $id]);
        return response()->json(['message' => 'Vehículo eliminado con éxito.'], 200);
    }

    /**
     * Valida unicidad para campos clave (para frontend antes de submit).
     */
    public function validateUniqueness(Request $request)
    {
        Log::info('Validación de unicidad:', $request->all());

        $request->merge(['value' => strtoupper($request->value ?? '')]);

        try {
            $request->validate([
                'field' => 'required|in:numero_eco,placa,numero_serie,numero_inven',
                'value' => 'required|string',
                'id' => 'nullable|exists:vehiculos,id',
            ]);
        } catch (ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        }

        $query = Car::where($request->field, $request->value);
        if ($request->id) $query->where('id', '!=', $request->id);
        $exists = $query->exists();

        return response()->json(['exists' => $exists], 200);
    }

    /**
     * Búsqueda por coincidencia para subáreas (autocomplete, min 1-3 chars).
     */
    public function searchSubareas(Request $request)
{
    $query = $request->input('query', '');

    $subareas = strlen($query) > 0
        ? Subarea::searchByNombre($query)
        : Subarea::query();

    $subareas = $subareas->take(10)->get(['id', 'name', 'area_id']);

    $subareas->each(function ($subarea) {
        $area = Area::find($subarea->area_id);
        $subarea->area = $area ? ['id' => $area->id, 'name' => $area->name] : null;
    });

    return response()->json(['subareas' => $subareas], 200);
}
    
    

    /**
     * Búsqueda por coincidencia para marcas.
     */
    public function searchMarcas(Request $request)
{
    $query = $request->input('query', '');

    $marcas = strlen($query) > 0
        ? Marca::searchByNombre($query)
        : Marca::query();

    $marcas = $marcas->take(10)->get(['id', 'nombre']);

    return response()->json(['marcas' => $marcas], 200);
}

    /**
     * Búsqueda por coincidencia para tipos (filtrado por marca).
     */
    public function searchTipos(Request $request)
    {
        $query = $request->input('query', '');
        $marcaId = $request->input('marca_id');
        $tipos = Tipo::query()
            ->when(strlen($query) > 0, fn($q) => $q->searchByNombre($query))
            ->when($marcaId, fn($q) => $q->where('marca_id', $marcaId))
            ->take(10)
            ->get(['id', 'nombre', 'marca_id']);


        return response()->json(['tipos' => $tipos], 200);
    }

    /**
     * Crea una nueva marca dinámicamente.
     */
    public function storeMarca(Request $request)
    {
        try {
            $request->validate([
                'nombre' => 'required|string|max:255|unique:marcas,nombre',
            ]);
        } catch (ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        }

        $marca = Marca::create(['nombre' => strtoupper($request->nombre)]);
        return response()->json(['message' => 'Marca creada con éxito.', 'marca' => $marca], 201);
    }

    /**
     * Crea un nuevo tipo dinámicamente (relacionado a marca).
     */
    public function storeTipo(Request $request)
    {
        try {
            $request->validate([
                'nombre' => 'required|string|max:255',
                'marca_id' => 'required|exists:marcas,id',
            ]);
        } catch (ValidationException $e) {
            return response()->json(['errors' => $e->errors()], 422);
        }

        $tipo = Tipo::create([
            'nombre' => strtoupper($request->nombre),
            'marca_id' => $request->marca_id,
        ]);
        return response()->json(['message' => 'Tipo creado con éxito.', 'tipo' => $tipo], 201);
    }

    /**
     * Búsqueda de vehículo por numero_eco o placa para módulo de salidas.
     */
    public function searchVehicleForSalidas(Request $request)
    {
        $search = $request->input('search', '');
        $vehicle = Car::with(['marca', 'tipo', 'subarea'])
            ->searchByNumeroEcoOrPlaca($search)
            ->first();

        if (!$vehicle) return response()->json(['message' => 'Vehículo no encontrado.'], 404);

        $area = Area::find($vehicle->subarea->area_id);
        $vehicle->subarea->area = $area ? ['id' => $area->id, 'name' => $area->name] : null;

        return response()->json(['vehicle' => $this->formatVehicleResponse($vehicle)], 200);
    }

    /**
     * Formatea la respuesta de un vehículo para consistencia.
     */
    
}