import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router
} from '@angular/router';
import { AuthService } from './auth.service';
import Swal from 'sweetalert2';
import { map, filter, take } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthGuard {

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {

    return this.auth.currentUser$.pipe(
      filter(user => user !== undefined),
      take(1),
      map(user => {

        // 🔐 1. Usuario y token
        if (!user || !this.auth.token) {
          this.auth.logout();
          this.router.navigate(['/auth/login']);
          return false;
        }

        // 🔐 Validar expiración del token de forma segura y directa
      if (this.auth.token) {
        try {
          const payload = JSON.parse(atob(this.auth.token.split('.')[1]));
          const now = Math.floor(Date.now() / 1000); // Tiempo actual en segundos

          // Si el token está expirado o no tiene campo exp
          if (!payload.exp || now >= payload.exp) {
            this.auth.logout();
            this.router.navigate(['/auth/login']);
            return false;
          }
        } catch (error) {
          // Token mal formado, corrupto o manipulado
          console.warn('Token JWT inválido o corrupto:', error);
          this.auth.logout();
          this.router.navigate(['/auth/login']);
          return false;
        }
}

        // 🚨 SUPER-ADMIN → TODO PERMITIDO
        if (this.auth.hasRole('super-admin')) {
          return true;
        }

       

// 🔐 3. Validación por ROLES (si la ruta los define)
        const allowedRoles = route.data?.['roles'] as string[] | undefined;

        if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
          const hasRole = this.auth.hasRole(allowedRoles);

          if (!hasRole) {
            this.showAccessDenied();
            this.router.navigate(['/dashboard']);
            return false;
          }
        }

        // ✅ Acceso permitido
        return true;
      })
    );
  }
  // 🚫 ALERTA DE ACCESO DENEGADO (UNIFICADA)
  private showAccessDenied(): void {
    Swal.fire({
      icon: 'error',
      title: 'Acceso denegado',
      text: 'No tienes acceso a este módulo.',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#3085d6',
      backdrop: 'rgba(0, 0, 0, 0.6)',
      customClass: {
        popup: 'custom-access-denied-popup'
      }
    });
  }
}

 /*
        // 🔑 3. VALIDACIÓN POR ROLES (MÓDULO)
        const allowedRoles = route.data?.['roles'] as string[] | undefined;

        if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
          const hasRole = this.auth.hasRole(allowedRoles);
          
          if (!hasRole) {
            this.showAccessDenied();
            this.router.navigate(['/dashboard']);
            return false;
          }
        }

        // 🔑 4. VALIDACIÓN POR PERMISOS (ACCIÓN)
        const requiredPermission = route.data?.['permission'] as string | string[] | undefined;
        const anyPermission = route.data?.['anyPermission'] as string[] | undefined;

        let allowed = true;

        if (Array.isArray(requiredPermission)) {
          allowed = this.auth.hasAny(requiredPermission);
        } else if (typeof requiredPermission === 'string') {
          allowed = this.auth.has(requiredPermission);
        } else if (Array.isArray(anyPermission) && anyPermission.length > 0) {
          allowed = this.auth.hasAny(anyPermission);
        }

        if (!allowed) {
          this.showAccessDenied();
          this.router.navigate(['/dashboard']);
          return false;
        }

        // ✅ ACCESO PERMITIDO
        return true;
      })
    );
  }
*/

/*import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import Swal from 'sweetalert2';
import { map, filter, take } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthGuard  {
  
  constructor(
    private auth:AuthService,
    private router: Router
  ) {}

 
  canActivate(
    route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    // ✅ Esperar hasta que currentUser$ emita un usuario (no null)
    return this.auth.currentUser$.pipe(
      filter(user => user !== undefined), // ignora undefined inicial
      take(1), // solo tomar el primer valor emitido
      map(user => {
        // Si no hay usuario, forzar logout
        if (!user || !this.auth.token) {
          this.auth.logout();
          return this.router.createUrlTree(['/auth/login']);
        }

        // Verificar expiración del token
        try {
          const payload = JSON.parse(atob(this.auth.token.split('.')[1]));
          const expiration = payload.exp;
          const now = Math.floor(Date.now() / 1000);
          if (now >= expiration) {
            this.auth.logout();
            return this.router.createUrlTree(['/auth/login']);
          }
        } catch {
          this.auth.logout();
          return this.router.createUrlTree(['/auth/login']);
        }

        // Extraer permisos de la ruta
        const requiredPermission = route.data?.['permission'] as string | string[] | undefined;
        const anyPermission = route.data?.['anyPermission'] as string[] | undefined;

        // Si no se especifican permisos → acceso permitido
        if (!requiredPermission && (!anyPermission || anyPermission.length === 0)) {
          return true;
        }

        let allowed = true;
        if (Array.isArray(requiredPermission)) {
          allowed = this.auth.hasAny(requiredPermission);
        } else if (typeof requiredPermission === 'string') {
          allowed = this.auth.has(requiredPermission);
        } else if (Array.isArray(anyPermission) && anyPermission.length > 0) {
          allowed = this.auth.hasAny(anyPermission);
        }

        // Si tiene permiso → acceso
        if (allowed) return true;

        // 🚫 Acceso denegado
        this.showAccessDeniedAlert();
        return this.router.createUrlTree(['/dashboard']);
      })
    );
  }

private showAccessDeniedAlert(): void {
    Swal.fire({
      icon: 'error',
      title: 'Acceso Denegado',
      text: 'No tienes los permisos PARA VER.',
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#3085d6',
      backdrop: `
        rgba(0, 0, 0, 0.6)
        
        center left
        no-repeat
      `,
      customClass: {
        popup: 'custom-access-denied-popup'
      }
    });
  }
}



   

  canActivat(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    // 1. Verificar si el usuario está autenticado (tu código actual)
    if (!this.authService.user || !this.authService.token) {
      this.authService.logout();
      return false;
    }

    // 2. Verificar si el token ha expirado (tu código actual)
    let token = this.authService.token;
    let expiration = (JSON.parse(atob(token.split(".")[1]))).exp;
    if (Math.floor((new Date().getTime()/1000)) >= expiration) {
      this.authService.logout();
      return false;
    }

    // 3. NUEVO: Verificar permisos específicos de la ruta
    const requiredPermission = route.data?.['permission'] as string | undefined;
    const anyPermission = route.data?.['anyPermission'] as string[] | undefined;
    
    // Si la ruta no exige permiso específico => deja pasar
    if (!requiredPermission && (!anyPermission || anyPermission.length === 0)) {
      return true;
    }

    let allowed = true;
    if (anyPermission && anyPermission.length > 0) {
      allowed = this.auth.hasAny(anyPermission);
    } else if (requiredPermission) {
      allowed = this.auth.has(requiredPermission);
    }

    if (allowed) return true;

    // Acceso denegado
    this.showAccessDeniedAlert();
    this.router.navigate(['/dashboard']);
    return false;
  }
    */

/*import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard  {
  
  constructor(private authService: AuthService) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
    const currentUser = this.authService.currentUserValue;
   
    if (!this.authService.user || !this.authService.token){
      this.authService.logout();
      return false;
    }
    let token = this.authService.token;

    let expiration = (JSON.parse(atob(token.split(".")[1]))).exp;
    if(Math.floor((new Date().getTime()/1000)) >= expiration){
      this.authService.logout();
      return false;
    }
    return true;
  }
}*/
