<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

use App\Models\Configuration\Area;
use Spatie\Permission\Models\Role;
use App\Models\Configuration\Subarea;
use Illuminate\Support\Facades\Storage;
use App\Http\Controllers\Concerns\ApiResponses;

class UserAccessController extends Controller
{
    use ApiResponses;

    public function __construct()
    {
        $this->middleware('auth:api');
        $this->middleware('permission:users.list')->only(['index']);
        $this->middleware('permission:users.view')->only(['show']);
        $this->middleware('permission:users.create')->only(['store']);
        $this->middleware('permission:users.update')->only(['update']);
        $this->middleware('permission:users.delete')->only(['destroy']);
    }
    
       
    
    
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $search = $request->get ("search");

        $users = User::where ("name", "like","%".$search."%")->orderBy("id","desc")->paginate(25);

        return $this->successResponse([
            "total" => $users-> total(),
            "users" => $users-> map(function($user) {
                return [
                    "id" => $user ->id,
                    "name"=>$user ->name,
                    "surname"=>$user -> surname,
                    "full_name"=>$user -> name.' '.$user -> surname,
                    "email"=>$user -> email,
                    "address"=>$user -> address,
                    "gender"=> $user ->gender,
                    "phone"=> $user ->phone,
                    "avatar"=>$user ->avatar ? env("APP_URL")."storage/".$user->avatar: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
                    "role_id"=> $user ->role_id,
                    "role"=> $user ->role, //la relacion que tiene con la clase Role que es belognsto Role::class
                    "roles"=> $user ->roles, //multiple roles asingados a un usuario, esto lo maneja internamente
                    "sucursal_id"=> $user ->sucursal_id,
                    "n_document"=> $user ->n_document,
                    "type_document"=> $user ->type_document,
                    "area_id" => $user->area_id,
                    "area" => $user->area ? [
                        "id" => $user->area->id,
                        "name" => $user->area->name,
                        "urs" => $user->area->urs,
                    ] : null,
                    "subarea_id" => $user->subarea_id,
                    "subarea" => $user->subarea ? [
                        "id" => $user->subarea->id,
                        "name" => $user->subarea->name,
                        "localidad" => $user->subarea->localidad,
                    ] : null,
                    "create_format_at"=> $user->created_at->format("Y-m-d h:i A"),
                    
                ];
                  //return $user;
            }),
        ]);
    }

    //traer todos los roles.
    public function config(){
        return $this->successResponse([
            "roles" => Role::all(),
            "areas" => Area::select('id', 'name', 'urs')->get(),
            "subareas" => Subarea::with('area')->select('id', 'name', 'area_id')->get(),
        ]);
    }


    public function store(Request $request)
    {
        //validacion para no duplicar 2 usuario con el mismo correo  electronico
        $USER_EXIST = User::where("email",$request ->email)->first(); 
        if ($USER_EXIST){
            return response ()->json ([
                "message" => 403,
                "message_text" => "El USUARIO YA EXISTE" 

            ]);   
        }
            //luego vamos a crear el link para poder accesar a las imagenes php artisan storage:link
        if($request->hasFile("imagen")){         //almacenamos la imagen del usuario
            $path = Storage::putFile("users", $request->file("imagen"));
            $request -> request ->add(["avatar" => $path]);
        }
        //seteamos la contraseña
        if($request->password){
            $request->request->add(["password" => bcrypt($request->password)]);
        }

        //creamos el usuario 
        $role = Role::findOrFail($request->role_id); //asingarlo al rol que estamos buscando
        $user = User::create($request ->all());
        $user->assignRole($role); // asignarlo a un rol


        return $this->successResponse([
            "message" => 200,
            "user" => $this->formatUserResponse($user)
        ]);

        
    }

    /**
     * FUNCIÓN AUXILIAR: FORMATEAR RESPUESTA DE USUARIO
     */
    private function formatUserResponse($user)
    {
        $user->load(['area', 'subarea']); // Carga relaciones si no están

        return [
            "id" => $user->id,
            "name" => $user->name,
            "surname" => $user->surname,
            "full_name" => $user->name . " " . $user->surname,
            "email" => $user->email,
            "address" => $user->address,
            "gender" => $user->gender,
            "phone" => $user->phone,
            "avatar" => $user->avatar
                ? env("APP_URL") . "storage/" . $user->avatar
                : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
            "role_id" => $user->role_id,
            "role" => $user->role,
            "roles" => $user->roles,
            "sucursal_id" => $user->sucursal_id,
            "n_document" => $user->n_document,
            "type_document" => $user->type_document,
            "area_id" => $user->area_id,
            "area" => $user->area ? [
                "id" => $user->area->id,
                "name" => $user->area->name,
                "urs" => $user->area->urs,
            ] : null,
            "subarea_id" => $user->subarea_id,
            "subarea" => $user->subarea ? [
                "id" => $user->subarea->id,
                "name" => $user->subarea->name,
                "localidad" => $user->subarea->localidad,
            ] : null,
            "create_format_at" => $user->created_at->format("Y-m-d h:i A"),
        ];
    }
/*
    return response() ->json([
            "message" => 200,
            "user" => [ 
                "id" => $user ->id,
                    "name"=>$user ->name,
                    "surname"=>$user -> surname,
                    "full_name"=>$user -> name." ".$user -> surname,
                    "email"=>$user -> email,
                    "address"=>$user -> address,
                    "gender"=> $user ->gender,
                    "phone"=> $user ->phone,
                    "avatar"=>$user ->avatar ? env ("APP_URL"). "storage/".$user ->avatar: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png", 
                    "role_id"=> $user ->role_id,
                    "role"=> $user ->role, //la relacion que tiene con la clase Role que es belognsto Role::class
                    "roles"=> $user ->roles, //multiple roles asingados a un usuario, esto lo maneja internamente
                    "sucursal_id"=> $user ->sucursal_id,
                    "n_document"=> $user ->n_document,
                    "type_document"=> $user ->type_document,
                    "create_format_at"=> $user->created_at->format("Y-m-d h:i A"),
            ]
        ]);
*/
    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        //tiene que ser diferente al usuario que queremos actualizar
        $USER_EXIST = User::where("email",$request ->email)
                        ->where("id", "<>", $id)->first(); 
        if ($USER_EXIST){
            return response ()->json ([
                "message" => 403,
                "message_text" => "El usuario Ya Existe" 

            ]);   
        }
         
        $user = User::findOrFail($id); //usuario que queremos editar

        if($request->hasFile("imagen")){   
            if($user -> avatar){
                Storage::delete($user -> avatar);
            }   
            
            //almacenamos la imagen del usuario
            $path = Storage::putFile("users", $request->file("imagen"));
            $request -> request ->add(["avatar" => $path]);
        }
        //seteamos la contraseña
        if($request->password){
            $request->request->add(["password" => bcrypt($request->password)]);
        }

        // El viejo rol
        if($request->role_id !=$user->role_id){  //checo la data que quiere mandar si es diferente al rol que manda
            $role_old = Role::findOrFail($user->role_id);
            $user->removeRole($role_old);
        
        
        // El nuevo rol
        //if($request->role_id !=$user->role_id){
            $role = Role::findOrFail($request->role_id);
            $user ->assignRole($role);
        }
        
        //creamos el usuario 
        $user->update($request->all());

        return $this->successResponse([
            "message" => 200,
            "user" => [ 
                "id" => $user ->id,
                    "name"=>$user ->name,
                    "surname"=>$user -> surname,
                    "full_name"=>$user -> name." ".$user -> surname,
                    "email"=>$user -> email,
                    "address"=>$user -> address,
                    "gender"=> $user ->gender,
                    "phone"=> $user ->phone,
                    "avatar"=>$user ->avatar ? env ("APP_URL"). "storage/".$user ->avatar: "https://cdn-icons-png.flaticon.com/512/3135/3135715.png",
                    "role_id"=> $user ->role_id,
                    "role"=> $user ->role, //la relacion que tiene con la clase Role que es belognsto Role::class
                    "roles"=> $user ->roles, //multiple roles asingados a un usuario, esto lo maneja internamente
                    "sucursal_id"=> $user ->sucursal_id,
                    "n_document"=> $user ->n_document,
                    "type_document"=> $user ->type_document,
                    "create_format_at"=> $user->created_at->format("Y-m-d h:i A"),
                    "area_id" => $user->area_id,
                    "subarea_id" => $user->subarea_id,
            ]
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $user = User::findOrFail($id);
        if($user->avatar){
            Storage::delete($user->avatar);
        }
        $user->delete();
        return $this->successResponse([
            "message" => 200,
        ]);
    }
}
