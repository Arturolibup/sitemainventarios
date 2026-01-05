<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;
use App\Models\User;

class PermissionsDemoSeeder extends Seeder
{
    public function run(): void
    {
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        $guard = 'api';

        // 1) Define MÓDULOS y ACCIONES (tu "fuente de verdad")
        $modules = [
            'areas'     => ['list','view','create','update','delete'],//areasLISTO
            'categories'  => ['list','view','create','update','delete'],//product_CategoriesLISTO
            'providers' => ['list','view','create','update','delete'],//providersLISTO
            'subareas'  => ['list','view','create','update','delete'],//subareasLISTO
            'units'     => ['list','view','create','update','delete'],//unitsLISTO
            'invoices' => ['list','view','create','update','delete'],//invoicesLISTO
            'product'  => ['list','view','create','update','delete'],//productsLISTO
            'products'  => ['list','view','create','update','delete'],// order_productsLISTO
            'product_entries' => ['list','view','create','update','delete'],//product_entriesLISTO
            'product_exits'   => ['list','view','create','update','delete'],//product_existsLISTO
            'users'     => ['list','view','create','update','delete'],//usersLISTO
            'roles'     => ['list','view','create','update','delete'],//rolesLISTO
            'tipos'     => ['list','view','create','update','delete'],//tiposLISTO
            'marca'    => ['list','view','create','update','delete'],// marcasLISTO
            'vehicles'  => ['list','view','create','update','delete'],//vehiculosLISTO
            'orders' => [
                        'list',             //listar 
                        'view',         //ver detalle
                        'create_pdf',          //crear pdf
                        'create_sf',        // Área 1: crear suficiencia
                        'add_order_number', // Área 1: asignar número de orden
                        'update',           // Area 1 : actualizar sf ? o order number ?
                        'validate_sf',         // Validar suficiencia  ???
                        'assign_partidas',  // Área 2: asignar partida y financiamiento
                        'receive',          // Área 3: recepción en almacén
                        'delete'
                        ],

            'list_dashboard' => ['dashboard.view'],
            'AI_estadistica' => ['reports.view'],
            'requisitions' => ['list','view','create','update','approve','delete'],
            'signatory' => ['list','view','create','update','delete'],
            'IA DASHABOARD' => ['list','view','create','update','delete'],
            'IA chat' => ['ai_chat.view'],

        ];

        // 2) Construir la lista oficial de permisos: recurso.acción
        $ALL_PERMS = collect($modules)->flatMap(function($actions, $module){
            return collect($actions)->map(fn($a) => "{$module}.{$a}");
        })->unique()->values();

        // 3) Crear permisos que falten
        foreach ($ALL_PERMS as $name) {
            Permission::findOrCreate($name, $guard);
        }

        // 4) Eliminar permisos SOBRANTES (solo del guard 'api')
        $toDelete = Permission::where('guard_name', $guard)
            ->whereNotIn('name', $ALL_PERMS)
            ->get();

        if ($toDelete->isNotEmpty()) {
            $permIds = $toDelete->pluck('id');
            DB::table('role_has_permissions')->whereIn('permission_id', $permIds)->delete();
            DB::table('model_has_permissions')->whereIn('permission_id', $permIds)->delete();
            Permission::whereIn('id', $permIds)->delete();
        }

       
       // 5) Crear roles base
        $roles = ['Super-Admin','Admin','Rec.Materiales','Contabilidad','Almacen','Invitado'];
        foreach ($roles as $r) Role::findOrCreate($r, $guard);

        $admin        = Role::where('name','Admin')->first();
        $recMat       = Role::where('name','Rec.Materiales')->first(); // Área 1
        $contabilidad = Role::where('name','Contabilidad')->first();   // Área 2
        $almacen      = Role::where('name','Almacen')->first();        // Área 3
        $invitado     = Role::where('name','Invitado')->first();
        $superAdmin   = Role::where('name','Super-Admin')->first();

        $allApiPerms = Permission::pluck('name')->toArray();

        // 5) Sincronizar permisos por rol

        // Super-Admin: todo
        $superAdmin->syncPermissions($allApiPerms);

        // Admin: todo también
        $admin->syncPermissions($allApiPerms);

        // Rec.Materiales (Área 1): crear/editar/validar OP + productos/catálogos mínimos
        $recMat->syncPermissions([
                'orders.list','orders.view',
                'orders.create_sf','orders.add_order_number',
                'orders.update','orders.validate_sf',
                'products.list','products.view',
                'providers.list','areas.list','subareas.list',
                'units.list','vehicles.list','categories.list','marca.list','tipos.list',
            ]);

        // Contabilidad (Área 2): validar suficiencia y asignar partidas
        $contabilidad->syncPermissions([
                'orders.list','orders.view',
                'orders.update',
                'orders.assign_partidas',
                'products.list','products.view',
                'providers.list','areas.list','subareas.list',
                'units.list','vehicles.list','categories.list','marca.list','tipos.list',
            ]);

            // Almacén (Área 3): permisos completos (como admin)
        /*$almacen->syncPermissions([
                'orders.list','orders.view','orders.receive',
                'products.list','providers.list','areas.list','subareas.list',
                'units.list','categories.list','vehicles.list'
            ]);*/

        $almacen->syncPermissions($allApiPerms);

        // Invitado: solo lectura
        $invitado->syncPermissions([
            'orders.list','orders.view','products.list','products.view'
        ]);

        // 6) Crear usuario demo superadmin
        $user = User::where('email', 'devcode@gmail.com')->first();
        if (!$user) {
            $user = User::factory()->create([
                'name' => 'Super-Admin',
                'email' => 'devcode@gmail.com',
                'password' => bcrypt('12345678'),
            ]);
        }
        $user->syncRoles([$superAdmin]);

        app()[PermissionRegistrar::class]->forgetCachedPermissions();
    }
}
