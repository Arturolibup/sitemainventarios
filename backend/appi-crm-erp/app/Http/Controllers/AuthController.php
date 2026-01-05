<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Auth;

use Validator;
use App\Models\User;
use Illuminate\Http\JsonResponse;


class AuthController extends Controller
{
    /**
     * Create a new AuthController instance.
     *
     * @return void
     */
    public function __construct()
    {
        $this->middleware('auth:api', ['except' => ['login', 'register']]);
    }
 
 
    /**
     * Register a User.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function register() {
        //$this->authorize("create", User::class);
        $validator = Validator::make(request()->all(), [
            'name' => 'required',
            'email' => 'required|email|unique:users',
            'password' => 'required|min:8',
        ]);
 
        if($validator->fails()){
            return response()->json($validator->errors()->toJson(), 400);
        }
 
        $user = new User;
        $user->name = request()->name;
        $user->email = request()->email;
        $user->password = bcrypt(request()->password);
        $user->save();
 
        return response()->json($user, 201);
    }
 
 
    /**
     * Get a JWT via given credentials.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function login()
    {
        $credentials = request(['email', 'password']);
 
        if (! $token = auth('api')->attempt($credentials)) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }
 
        return $this->respondWithToken($token);
    }
 
    /**
     * Get the authenticated User.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function me()
    {

        $user = auth('api')->user();

        $user->load(['area:id,name', 'subarea:id,name']);

        // Obtener todos los permisos del usuario
        $permissions = $user->getAllPermissions()->map(function($perm) {
            return $perm->name;
        });

        // obtener roles
        $roles = $user->getRoleNames();

        return response()->json([
        'id' => $user->id,
        'firstname' => $user->name ?? '',
        'lastname' => $user->surname ?? '',
        'fullname' => ($user->name ?? '') . ' ' . ($user->surname ?? ''),
        'email' => $user->email ?? '',
        'avatar' => $user->avatar ? env('APP_URL') . 'storage/' . $user->avatar : 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        'role' => $user->role->name ?? '',
        'permissions' => $permissions->toArray(), //obtener permisos.
        'roles'=> $roles->toArray(), //obtener roles
        'phone' => $user->phone ?? '',
        'address' => $user->address ?? '',
        'occupation' => $user->occupation ?? '',
        'company_name' => $user->company_name ?? '',
        'website' => $user->website ?? '',
        'language' => $user->language ?? '',
        'time_zone' => $user->time_zone ?? '',

        // NUEVOS CAMPOS:
        'area_id' => $user->area_id,
        'area_name' => optional($user->area)->name,
        'subarea_id' => $user->subarea_id,
        'subarea_name' => optional($user->subarea)->name,
    ]);
}
    
 
    /**
     * Log the user out (Invalidate the token).
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function logout()
    {
        auth('api')->logout();
 
        return response()->json(['message' => 'Successfully logged out']);
    }
 
    /**
     * Refresh a token.
     *
     * @return JsonResponse
     */
    public function refresh()
    {
        return $this->respondWithToken(auth('api')->refresh());
    }
 
    public function show($id)
    {
        $user = User::find($id);
        if (!$user) {
            return response()->json(['error' => 'Usuario no encontrado'], 404);
        }
        return response()->json($user, 200);
    }
    /**
     * Get the token array structure.
     *
     * @param  string $token
     *
     * @return \Illuminate\Http\JsonResponse
     */

    protected function respondWithToken($token)
{
    $user = auth('api')->user();

    $user->load(['area:id,name', 'subarea:id,name']);
    
    // Obtener permisos de manera segura
    $permissions = [];
    if ($user) {
        $permissionsCollection = $user->getAllPermissions();
        if ($permissionsCollection) {
            $permissions = $permissionsCollection->map(function($perm) {
                return $perm->name;
            })->toArray();
        }
    }

    return response()->json([
        'access_token' => $token,
        'token_type' => 'bearer',
        'expires_in' => auth('api')->factory()->getTTL() * 60,
        'user' => [
            'id' => $user->id ?? null,
            'firstname' => $user->name ?? '',
            'lastname' => $user->surname ?? '',
            'fullname' => ($user->name ?? '') . ' ' . ($user->surname ?? ''),
            'email' => $user->email ?? '',
            'avatar' => $user->avatar ? env('APP_URL') . 'storage/' . $user->avatar : 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
            'role' => $user->role->name ?? '',
            'permissions' => $permissions, // ← Ya corregido
            'phone' => $user->phone ?? '',
            'address' => $user->address ?? '',
            'occupation' => $user->occupation ?? '',
            'company_name' => $user->company_name ?? '',
            'website' => $user->website ?? '',
            'language' => $user->language ?? '',
            'time_zone' => $user->time_zone ?? '',

            // NUEVOS CAMPOS:
            'area_id' => $user->area_id,
            'area_name' => optional($user->area)->name,
            'subarea_id' => $user->subarea_id,
            'subarea_name' => optional($user->subarea)->name,
        ]
    ]);
}
     
/*
protected function respondWithTo($token)
     {
         $permissions = auth('api')->user()->getAllPermissions()->map(function($perm){
             return $perm->name;
         });
         return response()->json([
             'access_token' => $token,
             'token_type' => 'bearer',
             'expires_in' => auth('api')->factory()->getTTL() * 60,
             'user' => [
                 'id' => auth('api')->user()->id, // Añadido: ID del usuario para auditoría
                 'firstname' => auth('api')->user()->name ?? '', // Separar name como firstname
                 'lastname' => auth('api')->user()->surname ?? '', // Separar surname como lastname
                 'fullname' => (auth('api')->user()->name ?? '') . ' ' . (auth('api')->user()->surname ?? ''), // Mantenido para compatibilidad
                 'email' => auth('api')->user()->email ?? '',
                 'avatar' => auth('api')->user()->avatar ? env('APP_URL') . 'storage/' . auth('api')->user()->avatar : 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
                 'role' => auth('api')->user()->role->name ?? '', // Cambiado de role_name a role
                 'permissions' => auth('api')->user()->$permissions->toArray(),
                 'permissions' => $permissions->toArray(),
                 'phone' => auth('api')->user()->phone ?? '',
                 'address' => auth('api')->user()->address ?? '',
                 'occupation' => auth('api')->user()->occupation ?? '', // Añadido para UserModel
                 'company_name' => auth('api')->user()->company_name ?? '', // Añadido para UserModel
                 'website' => auth('api')->user()->website ?? '', // Añadido para UserModel
                 'language' => auth('api')->user()->language ?? '', // Añadido para UserModel
                 'time_zone' => auth('api')->user()->time_zone ?? '', // Añadido para UserModel
             ]
         ]);
     }

    protected function respondWith($token)
    {
        $permissions = auth ('api')->user()->getAllPermissions()->map(function($perm){
            return $perm -> name;
        });
        return response()->json([
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => auth('api')->factory()->getTTL() * 120,
            'user' => [
                "full_name" => auth("api")->user()->name.' '.auth("api")->user()->surname,
                "email"=> auth("api")->user()->email,
                "avatar"=> auth("api")->user()->avatar ? env("APP_URL")."storage/".auth('api')->user()->avatar: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
                "role_name" => auth("api")->user()->role->name,
                "permissions" => $permissions,
            ]

        ]);
    }
    */
}
