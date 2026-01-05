<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Laravel\Sanctum\HasApiTokens;

use Spatie\Permission\Models\Role;

use Spatie\Permission\Traits\HasRoles;
use Tymon\JWTAuth\Contracts\JWTSubject;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable implements JWTSubject
{
    use HasApiTokens, HasFactory, Notifiable;
    use HasRoles;
    use SoftDeletes;

    protected $guard_name = 'api';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        "name",
        "email",
        "password",
        "surname",
        "phone",
        "role_id",
        "sucursal_id",
        "type_document",
        "n_document",
        "gender",
        "avatar",
        "address",
        "area_id",
        "subarea_id",
        
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    
    /**
    * The attributes that should be cast.
    * @var array<string, string>
    */
    
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];
    // roles devuelve un array con los roles que tiene relacionados.
    public function role(){ //primera relacion a una tabla Role
        return $this->belongsTo (Role::class);
    }

    // Relación con Área
    public function area()
    {
        return $this->belongsTo(\App\Models\Configuration\Area::class, 'area_id');
    }

    // Relación con Subárea
    public function subarea()
    {
        return $this->belongsTo(\App\Models\Configuration\Subarea::class, 'subarea_id');
    }
    /**
     * Get the identifier that will be stored in the subject claim of the JWT.
     *
     * @return mixed
     */
    public function getJWTIdentifier()
    {
        return $this->getKey();
    }
 
    /**
     * Return a key value array, containing any custom claims to be added to the JWT.
     *
     * @return array
     */
    public function getJWTCustomClaims()
    {
        return [];
    }
}
