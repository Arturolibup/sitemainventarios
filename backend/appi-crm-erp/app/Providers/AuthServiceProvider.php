<?php

namespace App\Providers;

use App\Models\ChatMessage;
use App\Models\ChatConversation;
use Spatie\Permission\Models\Role;
use App\Policies\ChatMessagePolicy;
use Illuminate\Support\Facades\Gate;
use App\Policies\ChatConversationPolicy;
use Spatie\Permission\PermissionRegistrar;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    /**
     * The model to policy mappings for the application.
     *
     * @var array<class-string, class-string>
     */
    protected $policies = [
        
        ChatConversation::class => ChatConversationPolicy::class,
        ChatMessage::class      => ChatMessagePolicy::class,
    ];

    /**
     * Register any authentication / authorization services.
     */
    public function boot(): void
    {
       $this->registerPolicies();

        // Limpia el cache de roles/permissions en cada boot (opcional en dev)
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // 👇 Da acceso total a Super-Admin
        Gate::before(function ($user, $ability) {
            return $user->hasRole('Super-Admin') ? true : null;
        });
    }
    
}
