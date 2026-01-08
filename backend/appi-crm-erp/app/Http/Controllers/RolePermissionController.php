<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Http\Controllers\Concerns\ApiResponses;

class RolePermissionController extends Controller
{
    use ApiResponses;

    public function __construct()
    {
        $this->middleware('auth:api');
        $this->middleware('permission:roles.create')->only(['store']);
        $this->middleware('permission:roles.list')->only('index');
        $this->middleware('permission:roles.view')->only('show');
        $this->middleware('permission:roles.update')->only(['update']);
        $this->middleware('permission:roles.delete')->only(['destroy']);
    }

    /**
     * GET /api/roles?page=1&search=
     */
    public function index(Request $request)
    {
        $search  = trim((string) $request->get('search', ''));
        $perPage = (int) ($request->get('per_page', 25)) ?: 25;

        $query = Role::query()
            ->where('guard_name', 'api')
            ->when($search !== '', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%");
            })
            ->with('permissions')
            ->orderBy('id', 'desc');

        $roles = $query->paginate($perPage);

        // Ajuste seguro: transformar sobre la colección del paginator
        $data = $roles->getCollection()->map(function (Role $rol) {
            // Campos "compat" como tu respuesta original
            $rol->permission_pluck   = $rol->permissions->pluck('name');
            $rol->created_format_at  = $rol->created_at?->format('Y-m-d h:i A');
            return $rol;
        });

        return $this->successResponse([
            'total' => $roles->total(),
            'roles' => $data,
        ]);
    }

    /*
    public function store(Request $request)
{
    $request->validate([
        'name' => [
            'required', 'string', 'max:255',
            Rule::unique('roles', 'name')->where('guard_name', 'api'),
        ],
        'permissions' => ['sometimes', 'array'],
        'permissions.*' => ['exists:permissions,id'],
    ]);

    $role = Role::create([
        'name'       => $request->name,
        'guard_name' => 'api',
    ]);

    $permissionsInput = $request->input('permissions', []);

    if (is_array($permissionsInput) && !empty($permissionsInput)) {
        $permissionsIds = array_map('intval', $permissionsInput);
        $existing = Permission::whereIn('id', $permissionsIds)->pluck('id')->toArray();
        
        if (count($existing) !== count($permissionsIds)) {
            return response()->json(['message' => 'Algunos permisos no existen'], 422);
        }
        
        $role->syncPermissions($existing);
    }

    $role->load('permissions');

    return response()->json([
        'message' => 'Rol creado correctamente',
        'role'    => $role
    ], 201);
}
    */

    /**
     * POST /api/roles
     * body: { name: string, permissions?: string[] }  (acepto 'permisions' legacy)
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => [
                'required', 'string', 'max:255',
                Rule::unique('roles', 'name')->where('guard_name', 'api'),
            ],
            'permissions'   => ['sometimes', 'array'],
            'permissions.*' => ['string'],
            
        ]); 

        $role = Role::create([
            'name'       => $data['name'],
            'guard_name' => 'api',
        ]);

        $permissions = $request->input('permissions', []);
        if (!empty($permissions)) {
            $role->syncPermissions($permissions);
        }

        $role->load('permissions');

        return $this->successResponse(
            [
                'message' => 200,
                'role'    => [
                    'id'                => $role->id,
                    'name'              => $role->name,
                    'permission'        => $role->permissions,                 // array de objetos
                    'permission_pluck'  => $role->permissions->pluck('name'),  // array de nombres
                    'created_format_at' => $role->created_at?->format('Y-m-d h:i A'),
                ],
            ],
            null,
            201
        );
    }


    /**
 * PUT/PATCH /api/roles/{id}
 */
public function update(Request $request, string $id)
{
    $role = Role::where('guard_name', 'api')->findOrFail($id);

    $data = $request->validate([
        'name' => [
            'sometimes', 'required', 'string', 'max:255',
            Rule::unique('roles', 'name')
            ->ignore($role->id)
            ->where('guard_name', 'api'),
        ],
        'permissions'   => ['sometimes', 'array'],
        'permissions.*'  => ['string'],
    ]);

    // Actualizar nombre si viene
    if ($request->has('name')) {
        $role->name = $data['name'];
        $role->save();
    }

    // 🔥 PERMISOS POR NOMBRE (COHERENTE)
    if ($request->has('permissions')) {
        $permissions = $request->input('permissions', []);
        $role->syncPermissions($permissions);
    }

    $role->load('permissions');

    return $this->successResponse([
        'message' => 'Rol actualizado correctamente',
        'role'    => [
            'id'               => $role->id,
            'name'             => $role->name,
            'permission'       => $role->permissions,
            'permission_pluck' => $role->permissions->pluck('name'),
            'created_format_at'=> $role->created_at?->format('Y-m-d h:i A'),
        ],
    ]);
}
    /*
     * PUT/PATCH /api/roles/{id}
     * body: { name?: string, permissions?: string[] }  (acepto 'permisions' legacy)
     
    public function update(Request $request, string $id)
    {
        $role = Role::where('guard_name', 'api')->findOrFail($id);

        $data = $request->validate([
            'name' => [
                'sometimes', 'string', 'max:255',
                Rule::unique('roles', 'name')->ignore($role->id)->where('guard_name', 'api'),
            ],
            'permissions'   => ['sometimes', 'array'],
            'permissions.*' => ['string'],
            'permisions'    => ['sometimes', 'array'],   // legacy
            'permisions.*'  => ['string'],
        ]);

        if (array_key_exists('name', $data)) {
            $role->name = $data['name'];
            $role->save();
        }

        $perms = $request->input('permissions', $request->input('permisions', []));
        if (!is_null($perms)) {
            $role->syncPermissions($perms);
        }

        $role->load('permissions');

        return response()->json([
            'message' => 200,
            'role'    => [
                'id'                => $role->id,
                'name'              => $role->name,
                'permission'        => $role->permissions,
                'permission_pluck'  => $role->permissions->pluck('name'),
                'created_format_at' => $role->created_at?->format('Y-m-d h:i A'),
            ],
        ]);
    }
*/
    /**
     * DELETE /api/roles/{id}
     */
    public function destroy(string $id)
    {
        $role = Role::where('guard_name', 'api')->findOrFail($id);

        if (strtolower($role->name) === 'super-admin') {
            return response()->json([
                'message' => 422,
                'message_text' => 'No se puede eliminar el rol Super-Admin',
            ], 422);
        }

        $role->delete();
        return $this->successResponse(['message' => 200]);
    }
}
