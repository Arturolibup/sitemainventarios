
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, of, Subscription } from 'rxjs';
import { catchError, finalize, map, switchMap, tap } from 'rxjs/operators';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { UserModel } from '../models/user.model';
import { URL_SERVICIOS } from 'src/app/config/config';

/**
 * ======================================================
 * AuthService – PRODUCCIÓN / COMPATIBLE / ESTABLE
 * ======================================================
 * - Maneja sesión (token + usuario)
 * - Mantiene compatibilidad con código existente
 * - Evita logout prematuro
 * - Funciona con AuthGuard y routing cerrado
 * ======================================================
 */

export type UserType = UserModel | null;

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {

  // ===============================
  // ESTADO INTERNO
  // ===============================
  private subs: Subscription[] = [];

  private currentUserSubject = new BehaviorSubject<UserType>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  /** Compatibilidad: muchos componentes la usan */
  user: UserType = null;

  /** Token JWT */
  token: string | null = null;

  /** Loader legacy */
  private loadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.loadingSubject.asObservable();

  /** Inicialización completa (para guards) */
  private initializedSubject = new BehaviorSubject<boolean>(false);
  isInitialized$ = this.initializedSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.restoreSession();
  }

  private unwrap<T>(res: any): T {
    return res?.data ?? res;
  }

  // ===============================
  // INICIALIZACIÓN DE SESIÓN
  // ===============================
  private restoreSession(): void {
    const token = localStorage.getItem('token');

    if (!token) {
      this.initializedSubject.next(true);
      return;
    }

    this.token = token;

    const sub = this.getUserByToken().pipe(
      finalize(() => this.initializedSubject.next(true))
    ).subscribe({
      next: () => {},
      error: () => {
        this.clearSession();
      }
    });

    this.subs.push(sub);
  }

  // ===============================
  // LOGIN
  // ===============================
  login(email: string, password: string): Observable<boolean> {
    this.loadingSubject.next(true);

    return this.http.post<any>(`${URL_SERVICIOS}/auth/login`, { email, password }).pipe(
      map(res => {
        const payload = this.unwrap<any>(res);
        const token = payload?.access_token || payload?.token;
        if (!token) throw new Error('Token no recibido');

        this.token = token;
        localStorage.setItem('token', token);
        return true;
      }),
      switchMap(() => this.getUserByToken()),
      map(() => true),
      catchError(err => {
        console.error('Login error', err);
        return of(false);
      }),
      finalize(() => this.loadingSubject.next(false))
    );
  }

  // ===============================
  // LOGOUT
  // ===============================
  logout(): void {
    this.clearSession();
    this.router.navigate(['/auth/login']);
  }

  private clearSession(): void {
    this.token = null;
    this.user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('auth_user');
    this.currentUserSubject.next(null);
  }

  
  // ===============================
  // USUARIO ACTUAL (/me)
  // ===============================
  getUserByToken(): Observable<UserModel> {
    if (!this.token) return of(null as any);

    const headers = new HttpHeaders({
      Authorization: `Bearer ${this.token}`
    });

    return this.http.get<any>(`${URL_SERVICIOS}/me`, { headers }).pipe(
      map(res => {
        const payload = this.unwrap<any>(res);
        const user = new UserModel();
        user.setUser({
          ...payload,
          roles: payload.roles || [],
          permissions: payload.permissions || []
        });

        this.user = user;
        this.currentUserSubject.next(user);
        localStorage.setItem('auth_user', JSON.stringify(payload));

        return user;
      })
    );
  }

  // ===============================
  // HELPERS (COMPATIBILIDAD TOTAL)
  // ===============================
  get currentUserValue(): UserType {
    return this.currentUserSubject.value;
  }

  getUserId(): number {
    return this.user?.id ?? 0;
  }

  getUserEmail(): string | null {
    return this.user?.email ?? null;
  }

  getUserRoleNames(): string[] {
    if (!this.user?.roles) return [];
    return this.user.roles.map((r: any) =>
      typeof r === 'string' ? r : r.name
    );
  }

  // ===============================
  // ROLES
  // ===============================
  hasRole(role: string | string[]): boolean {
    if (!this.user) return false;

    const roles = this.getUserRoleNames().map(r => r.toLowerCase());

    if (roles.includes('super-admin')) return true;

    return Array.isArray(role)
      ? role.some(r => roles.includes(r.toLowerCase()))
      : roles.includes(role.toLowerCase());
  }

  // ===============================
  // PERMISOS
  // ===============================
  has(permission: string): boolean {
    if (!this.user) return false;
    if (this.hasRole('super-admin')) return true;

    return (this.user.permissions || []).includes(permission);
  }

  hasAny(perms: string[]): boolean {
    return perms.some(p => this.has(p));
  }

  hasPermission(permission: string): boolean {
    return this.has(permission);
  }

  // ===============================
// ALIASES PARA COMPATIBILIDAD TOTAL
// ===============================

get roles(): string[] {
  return this.getUserRoleNames();
}

// ===============================
// ALIAS LEGACY PARA ROLES
// ===============================
hasRoleLegacy(role: string | string[]): boolean {
  return this.hasRole(role);
}

  // ===============================
  // MÉTODOS LEGACY (NO ROMPEN NADA)
  // ===============================
  registration(data: any): Observable<any> {
    return this.http.post(`${URL_SERVICIOS}/auth/register`, data);
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${URL_SERVICIOS}/auth/forgot-password`, { email });
  }

  resetPassword(data: any): Observable<any> {
    return this.http.post(`${URL_SERVICIOS}/auth/reset-password`, data);
  }

  // ===============================
  // CLEANUP
  // ===============================
  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}







//asi funcionaba antes
/*import { Injectable, OnDestroy } from '@angular/core';
import { Observable, BehaviorSubject, of, Subscription } from 'rxjs';
import { map, catchError, switchMap, finalize, tap } from 'rxjs/operators';
import { UserModel } from '../models/user.model';
import { AuthModel } from '../models/auth.model';
import { AuthHTTPService } from './auth-http';
import { environment } from 'src/environments/environment';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { URL_SERVICIOS } from 'src/app/config/config';

export type UserType = UserModel | undefined;

@Injectable({ providedIn: 'root' })
export class AuthService implements OnDestroy {
  private unsubscribe: Subscription[] = [];
  private authLocalStorageToken = `${environment.appVersion}-${environment.USERDATA_KEY}`;

  currentUser$: Observable<UserType>;
  isLoading$: Observable<boolean>;
  currentUserSubject: BehaviorSubject<UserType>;
  isLoadingSubject: BehaviorSubject<boolean>;

  token: string | null = null;
  user: any = null; // cache de usuario
  roles: string[] = [];
  permissions: string[] = [];
  
  get currentUserValue(): UserType {
    return this.currentUserSubject.value;
  }


  set currentUserValue(user: UserType) {
    this.currentUserSubject.next(user);
  }

  constructor(
    private authHttpService: AuthHTTPService,
    private router: Router,
    private http: HttpClient,
  ) {
    this.isLoadingSubject = new BehaviorSubject<boolean>(false);
    this.currentUserSubject = new BehaviorSubject<UserType>(undefined);
    this.currentUser$ = this.currentUserSubject.asObservable();
    this.isLoading$ = this.isLoadingSubject.asObservable();

    const subscr = this.getUserByToken().subscribe();
    this.unsubscribe.push(subscr);
  }

  // ========== AUTH FLOW ==========

  login(email: string, password: string): Observable<any> {
    this.isLoadingSubject.next(true);
    console.log(this.currentUserValue)
    return this.http.post(`${URL_SERVICIOS}/auth/login`, { email, password }).pipe(
      map((auth: any) => {
        this.setAuthFromLocalStorage(auth);   // guarda token
        this.debugAuthCache();              // log de cache añadido
        return true;
      }),
      switchMap(() => this.getUserByToken()), // hidrata usuario/roles/permisos
      catchError((err) => {
        console.error('Error en login:', err);
        return of(undefined);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  logout() {
    this.currentUserSubject.next(undefined);
    this.token = null;
    this.user = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('auth_user');
    this.router.navigate(['/auth/login'], { queryParams: {} });
  }

  refreshToken(): Observable<any> {
    if (!this.token) return of(undefined);
    this.isLoadingSubject.next(true);
    return this.http.post(`${URL_SERVICIOS}/auth/refresh`, {}, {
      headers: { 'Authorization': 'Bearer ' + this.token }
    }).pipe(
      map((auth: any) => {
        this.setAuthFromLocalStorage(auth);  // actualiza token
        return auth;
      }),
      catchError((err) => {
        console.error('Error al refrescar token:', err);
        this.logout();
        return of(undefined);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  
  
  getUserByToken(): Observable<any> {
    const auth = this.getAuthFromLocalStorage();
    if (!auth || !this.token) {
      this.logout();
      return of(undefined);
    }

    // Verificar expiración del JWT
    try {
      const payload = JSON.parse(atob(this.token.split('.')[1]));
      const expiration = payload.exp;
      const now = Math.floor(Date.now() / 1000);
      if (now >= expiration) {
        // Token vencido → intentar refresh; si falla, logout.
        return this.refreshToken().pipe(
          switchMap((ok) => ok ? this.getUserByToken() : of(undefined))
        );
      }
    } catch (error) {
      console.error('Token inválido:', error);
      this.logout();
      return of(undefined);
    }

    this.isLoadingSubject.next(true);
    return this.http.get(`${URL_SERVICIOS}/me`, {
      headers: { 'Authorization': 'Bearer ' + this.token }
    }).pipe(
      map((res: any) => {
        // roles: array de nombres; permissions: array de strings
        const roles = Array.isArray(res?.roles) ? res.roles : [];
        const rawPerms = Array.isArray(res?.permissions) ? res.permissions : [];

        const normalizedPermissions = this.normalizePermList(rawPerms);

        // Guardar en cache local con permisos normalizados
        const cacheUser = {
          id: res?.id,
          name: res?.name,
          surname: res?.surname,
          email: res?.email,
          area_id: res?.area_id,
          area_name: res?.area_name,
          subarea_id: res?.subarea_id,
          subarea_name: res?.subarea_name,
          roles,
          permissions: normalizedPermissions,
          avatar: res?.avatar,
          avatar_url: res?.avatar
            ? `${environment.URL_BACKEND}/storage/${res.avatar}`
            : null,
        };
       
        this.setUserCache(cacheUser);

        // Mapear a tu UserModel (si lo usas en UI)
        const mappedUser = new UserModel();
        // @ts-ignore: asumimos setUser acepta estos campos
        mappedUser.setUser(cacheUser);

        this.currentUserSubject.next(mappedUser);
        return mappedUser;
      }),
      catchError((err) => {
        console.error('Error al validar usuario (/me):', err);
        this.logout();
        return of(undefined);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

// Devuelve SIEMPRE un usuario válido o lanza error claro
getSafeUser(): UserModel {
  const user = this.currentUserValue;
  if (!user) {
    throw new Error('Usuario no encontrado en AuthService. currentUserValue = undefined.');
  }
  return user;
}

debugAuthCache(): void {
  try {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('auth_user') || localStorage.getItem('user');
    console.log('%c[AUTH] Local cache', 'color:#17a2b8;font-weight:bold;', {
      tokenPresent: !!token,
      tokenPreview: token ? token.slice(0, 18) + '…' : null,
      auth_user: user ? JSON.parse(user) : null,
      currentUserSubject: this.currentUserSubject.value
    });
  } catch (e) {
    console.log('[AUTH] debugAuthCache parse error', e);
  }
}


  registration(user: UserModel): Observable<any> {
    this.isLoadingSubject.next(true);
    return this.authHttpService.createUser(user).pipe(
      switchMap(() => this.login(user.email, user.password)),
      catchError((err) => {
        console.error('err', err);
        return of(undefined);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  forgotPassword(email: string): Observable<boolean> {
    this.isLoadingSubject.next(true);
    return this.authHttpService
      .forgotPassword(email)
      .pipe(finalize(() => this.isLoadingSubject.next(false)));
  }

  // ========== PERMISSIONS & ROLES HELPERS ==========

  private getRoleNamesFromUser(u: any): string[] {
    const raw = u?.roles ?? u?.roleNames ?? [];
    const list = Array.isArray(raw)
      ? raw
      : (typeof raw === 'string' ? [raw] : []);
    return list
      .map((r: any) => (typeof r === 'string' ? r : r?.name))
      .filter(Boolean)
      .map((s: string) => s.toLowerCase());
  }

  hasRole(role: number | string | string[]): boolean {
    const current = this.currentUserValue as any;
    if (!current) return false;

    const roleNames = this.getRoleNamesFromUser(current);
    const checkOne = (r: string | number) => {
      if (typeof r === 'number') {
        return (current.role_id && current.role_id === r) || false;
      }
      return roleNames.includes((r || '').toLowerCase());
    };

    return Array.isArray(role) ? role.some(checkOne) : checkOne(role);
  }

  
  // ✅ Bypass para Super-Admin y verificación de permisos normalizados original
  has(permission: string): boolean {
    const user = this.currentUserValue as any;
    if (!user) return false;

    const roleNames = this.getRoleNamesFromUser(user);
    if (roleNames.includes('super-admin')) return true;

    const normalized = this.normalizePermName(permission);
    const userPerms: string[] = (user.permissions || []).map((p: string) => this.normalizePermName(p));
    return userPerms.includes(normalized);
  }

  hasAny(permissions: string[]): boolean {
    const user = this.currentUserValue as any;
    if (!user) return false;

    const roleNames = this.getRoleNamesFromUser(user);
    if (roleNames.includes('super-admin')) return true;

    const set = new Set((user.permissions || []).map((p: string) => this.normalizePermName(p)));
    return (permissions || []).some((p) => set.has(this.normalizePermName(p)));
  }

  hasAllPermissions(perms: string[]): boolean {
    const current = this.currentUserValue as any;
    if (!current) return false;
    const set = new Set<string>((current.permissions || []).map((p: string) => this.normalizePermName(p)));
    return (perms || []).every((p) => set.has(this.normalizePermName(p)));
  }

  // Alias de compatibilidad
  hasPermission(permission: string): boolean {
    return this.has(permission);
  }



  // ========== STORAGE HELPERS ==========

  private setAuthFromLocalStorage(auth: any): boolean {
    // Guarda solo el token del login; los datos de usuario se guardan con /me
    const token = auth?.access_token || auth?.token;
    if (token) {
      this.token = token;
      localStorage.setItem('token', token);

      // Compatibilidad: si el backend devuelve "user", guárdalo, pero lo sobreescribiremos con /me
      if (auth?.user) {
        const legacyUser = { ...auth.user, token };
        localStorage.setItem('user', JSON.stringify(legacyUser));
      }
      return true;
    }
    return false;
  }

  private setUserCache(u: any) {
    this.user = u;
    localStorage.setItem('auth_user', JSON.stringify(u));
    // compat con código viejo que lee 'user'
    localStorage.setItem('user', JSON.stringify(u));
  }

  private getAuthFromLocalStorage(): AuthModel | undefined {
    try {
      this.token = localStorage.getItem('token');
      const u = localStorage.getItem('auth_user') || localStorage.getItem('user');
      this.user = u ? JSON.parse(u) : null;
      if (!this.token) return undefined;
      return this.user || ({} as any);
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }

  // ========== NORMALIZACIÓN DE PERMISOS ==========

  private normalizePermList(list: string[]): string[] {
    const mapped = (list || []).map((p) => this.normalizePermName(p));
    return Array.from(new Set(mapped));
  }


  // FIX[PT1-B]: usar fallback al usuario cacheado mientras el BehaviorSubject no está listo
private getEffectiveRoles_(): string[] {
  const subjUser: any = this.currentUserValue;       // BehaviorSubject (puede estar vacío en arranques)
  const cacheUser: any = this.user;                   // cache (auth_user / user en localStorage)

  // roles en forma de nombres (lowercase) desde cualquiera de las dos fuentes
  const raw = (subjUser?.roles ?? subjUser?.roleNames ?? cacheUser?.roles ?? cacheUser?.roleNames ?? []);
  const list = Array.isArray(raw) ? raw : (typeof raw === 'string' ? [raw] : []);
  return list
    .map((r: any) => (typeof r === 'string' ? r : r?.name))
    .filter(Boolean)
    .map((s: string) => s.toLowerCase());
}

private getEffectivePerms_(): string[] {
  const subjUser: any = this.currentUserValue;
  const cacheUser: any = this.user;
  const list = (subjUser?.permissions ?? cacheUser?.permissions ?? []) as string[];
  return (list || []).map((p) => this.normalizePermName(p));
}





// ===============================
// FIX[PT2]: Alias de compatibilidad
// ===============================
hasPermissio(permission: string): boolean {
  return this.has(permission);
}
hasAnyPermission(perms: string[]): boolean {
  return this.hasAny(perms);
}



 * Verifica si el usuario puede gestionar convocatorias de requisición.
 * Solo: Rec. Materiales, Almacén Papelería (subarea), o Super-Admin.
 
canManageRequisitionCalls(): boolean {
  const user: any = this.currentUserValue;
  if (!user) return false;

  // Obtener roles normalizados (lowercase) desde el usuario o el cache con helper existente
  const roleNames = this.getEffectiveRoles_();
  if (roleNames.includes('rec.materiales') || roleNames.includes('super-admin')) {
    return true;
  }

  // Compatibilidad: si roles vienen como array de objetos con nombre en la primera entrada
  const firstRole = Array.isArray(user.roles) && user.roles.length ? user.roles[0] : undefined;
  const firstRoleName = typeof firstRole === 'string' ? firstRole : firstRole?.name;
  if (firstRoleName && (firstRoleName === 'Rec.Materiales' || firstRoleName === 'Super-Admin')) {
    return true;
  }

  // 3. Subárea contiene "ALMACEN PAPELERIA"
  const subareaName = user.subarea?.name;
  if (subareaName && subareaName.toUpperCase().includes('ALMACEN PAPELERIA')) {
    return true;
  }

  return false;
}




   * Convierte nombres legacy (snake_case) a la convención nueva (dotCase: modulo.accion)
   * y corrige typos/alias comunes.
  
  private normalizePermName(p: string): string {
    if (!p) return p as any;
    p = p.trim();

    // Ya está en modulo.accion
    if (p.includes('.')) return p.toLowerCase();

    const aliasMap: Record<string, string> = {
  // =======================
  // Roles
  // =======================
  'create_role': 'roles.create',
  'edit_role':   'roles.update',
  'delete_role': 'roles.delete',
  'list_role':   'roles.list',
  // legacy
  'roles':       'roles.list',

  // =======================
  // Users
  // =======================
  'create_user': 'users.create',
  'edit_user':   'users.update',
  'delete_user': 'users.delete',
  'list_user':   'users.list',
  'view_user':   'users.view',
  // legacy dotted
  'user.create': 'users.create',
  'user.update': 'users.update',
  'user.delete': 'users.delete',
  'user.list':   'users.list',
  'user.view':   'users.view',

  // =======================
  // Products (catálogo)
  // =======================
  'create_product': 'products.create',
  'edit_product':   'products.update',
  'delete_product': 'products.delete',
  'list_product':   'products.list',
  'view_product':   'products.view',
  // legacy dotted (singular)
  'product.create': 'products.create',
  'product.update': 'products.update',
  'product.delete': 'products.delete',
  'product.list':   'products.list',
  'product.view':   'products.view',

  // =======================
  // Categories
  // =======================
  'create_category': 'categories.create',
  'edit_category':   'categories.update',
  'delete_category': 'categories.delete',
  'list_category':   'categories.list',
  'view_category':   'categories.view',
  // legacy dotted (singular)
  'category.create': 'categories.create',
  'category.update': 'categories.update',
  'category.delete': 'categories.delete',
  'category.list':   'categories.list',
  'category.view':   'categories.view',

  // =======================
  // Units
  // =======================
  'create_unit': 'units.create',
  'edit_unit':   'units.update',
  'delete_unit': 'units.delete',
  'list_unit':   'units.list',
  'view_unit':   'units.view',
  // legacy dotted (singular)
  'unit.create': 'units.create',
  'unit.update': 'units.update',
  'unit.delete': 'units.delete',
  'unit.list':   'units.list',
  'unit.view':   'units.view',

  // =======================
  // Vehicles
  // =======================
  'create_vehicle': 'vehicles.create',
  'edit_vehicle':   'vehicles.update',
  'delete_vehicle': 'vehicles.delete',
  'list_vehicle':   'vehicles.list',
  'view_vehicle':   'vehicles.view',
  // legacy dotted (singular)
  'vehicle.create': 'vehicles.create',
  'vehicle.update': 'vehicles.update',
  'vehicle.delete': 'vehicles.delete',
  'vehicle.list':   'vehicles.list',
  'vehicle.view':   'vehicles.view',

  // =======================
  // Providers
  // =======================
  'create_provider': 'providers.create',
  'edit_provider':   'providers.update',
  'delete_provider': 'providers.delete',
  'list_provider':   'providers.list',
  'view_provider':   'providers.view',
  // legacy dotted (singular)
  'provider.create': 'providers.create',
  'provider.update': 'providers.update',
  'provider.delete': 'providers.delete',
  'provider.list':   'providers.list',
  'provider.view':   'providers.view',

  // =======================
  // Areas
  // =======================
  'create_areas': 'areas.create',
  'edit_areas':   'areas.update',
  'delete_areas': 'areas.delete',
  'list_areas':   'areas.list',
  'view_areas':   'areas.view',
  // legacy dotted (singular)
  'area.create': 'areas.create',
  'area.update': 'areas.update',
  'area.delete': 'areas.delete',
  'area.list':   'areas.list',
  'area.view':   'areas.view',

  // =======================
  // Subareas
  // =======================
  'create_subareas': 'subareas.create',
  'edit_subareas':   'subareas.update',
  'delete_subareas': 'subareas.delete',
  'list_subareas':   'subareas.list',
  'view_subareas':   'subareas.view',
  // legacy dotted (singular)
  'subarea.create': 'subareas.create',
  'subarea.update': 'subareas.update',
  'subarea.delete': 'subareas.delete',
  'subarea.list':   'subareas.list',
  'subarea.view':   'subareas.view',

  // =======================
  // / Marcas (alias)
  // =======================
  'create_marca': 'marca.create',
  'edit_marca':   'marca.update',
  'delete_marca': 'marca.delete',
  'list_marca':   'marca.list',
  'view_marca':   'marca.view',
  // español (alias )
  'create_marcas': 'marcas.create',
  'edit_marcas':   'marcas.update',
  'delete_marcas': 'marcas.delete',
  'list_marcas':   'marcas.list',
  'view_marcas':   'marcas.view',
  // español (alias )
  'create_tipo': 'tipo.create',
  'edit_tipo':   'tipo.update',
  'delete_tipo': 'tipo.delete',
  'list_tipo':   'tipo.list',
  'view_tipo':   'tipo.view',
   // =======================
  
  'create_tipos': 'tipos.create',
  'edit_tipos':   'tipos.update',
  'delete_tipos': 'tipos.delete',
  'list_tipos':   'tipos.list',
  'view_tipos':   'tipos.view',
  // =======================
  // Inventario - Entradas
  // =======================
  'create_entradas': 'product_entries.create',
  'edit_entradas':   'product_entries.update',
  'delete_entradas': 'product_entries.delete',
  'list_entradas':   'product_entries.list',
  'view_entradas':   'product_entries.view',
  // legacy dotted (singular)
  'product_entries.create': 'product_entries.create',
  'product_entries.update': 'product_entries.update',
  'product_entries.delete': 'product_entries.delete',
  'product_entries.list':   'product_entries.list',
  'product_entries.view':   'product_entries.view',

  // =======================
  // Inventario - Salidas
  // =======================
  'create_salidas': 'product_exits.create',
  'edit_salidas':   'product_exits.update',
  'delete_salidas': 'product_exits.delete',
  'list_salidas':   'product_exits.list',
  'view_salidas':   'product_exits.view',
  // legacy dotted (singular)
  'product_exits.create': 'product_exits.create',
  'product_exits.update': 'product_exits.update',
  'product_exits.delete': 'product_exits.delete',
  'product_exits.list':   'product_exits.list',
  'product_exits.view':   'product_exits.view',

  // =======================
  // Invoices / Facturas
  // =======================
  'create_invoice': 'invoices.create',
  'edit_invoice':   'invoices.update',
  'delete_invoice': 'invoices.delete',
  'list_invoice':   'invoices.list',
  'view_invoice':   'invoices.view',
  // legacy dotted (plural y singular)
  'invoices_create': 'invoices.create',
  'invoices_update': 'invoices.update',
  'invoices_delete': 'invoices.delete',
  'invoices_list':   'invoices.list',
  'invoices_view':   'invoices.view',
  'invoice_create':  'invoices.create',
  'invoice_update':  'invoices.update',
  'invoice_delete':  'invoices.delete',
  'invoice_list':    'invoices.list',
  'invoice_view':    'invoices.view',

  // =======================
  // Órdenes de Pedido (OP)
  // =======================
  'create_sf':       'orders.create',
  'create_op':       'orders.create',
  'createop':       'orders.create',
  'edit_op':         'orders.update',
  'delete_op':       'orders.delete',
  'list_op':         'orders.list',
  'view_op':         'orders.view',
  'validate_op':     'orders.validate',          // Área 1 (validar orden final)
  'validate_sf':     'orders.assign_partidas',          // Área 1 (validar orden final)
  'validateop':     'orders.assign_partidas',          // Área 1 (validar orden final)
  'assign_partidas': 'orders.assign_partidas',   // Área 2 (contabilidad)

 
  'receive_products':'orders.receive',
  'receive':'orders.receive',
  'validate':'orders.validate',           // Área 3 (almacén)
  
  // legacy dotted
  'orders.create_sf':         'orders.create_sf',
  'orders.update':         'orders.update',
  'orders.delete':         'orders.delete',
  'orders.list':           'orders.list',
  'orders.view':           'orders.view',
  'orders.validate':       'orders.assign_partidas',
  'add_order_number':   'orders.add_order_number',
  'orders.receive':        'orders.receive',

  // =======================
  // Dashboard / Reports
  // =======================
  'list_dashboard': 'dashboard.view',
  'view_dashboard': 'dashboard.view',
  'list_estadistica': 'reports.view',
  'view_reports':     'reports.view',
  // legacy dotted
  'dashboard.view': 'dashboard.view',
  'reports.view':   'reports.view',
};

    const k = p.toLowerCase();
    if (aliasMap[k]) return aliasMap[k];

    // Fallback genérico: module_action -> module.action
    if (k.includes('_')) {
      const [mod, ...rest] = k.split('_');
      return `${mod}.${rest.join('_')}`;
    }
    return k;
  }

  // Método para obtener el ID del usuario
  getUserId(): number {
  const user = this.currentUserValue;
  console.log('Current User in getUserId:', user); // Para depuración
  return user ? user.id : 0; // Usa user.id basado en el log
}

  ngOnDestroy() {
    this.unsubscribe.forEach((sb) => sb.unsubscribe());
  }
}





/*
getUserByToken(): Observable<any> {
  const auth = this.getAuthFromLocalStorage();
  if (!auth || !this.token) {
    this.logout();
    return of(undefined);
  }

  // (opcional) log rápido del token
  console.log(
    '%c[AUTH] Using token:',
    'color:#8a2be2;font-weight:bold;',
    this.token ? this.token.slice(0, 18) + '…' : '(no token)'
  );

  this.isLoadingSubject.next(true);

  // 👉 Ajusta a GET /me (como tienes ahora). Si tu backend expone /auth/me por POST, cambia la línea de abajo por el POST.
  return this.http.get(`${URL_SERVICIOS}/me`, {
    headers: { Authorization: 'Bearer ' + this.token }
  }).pipe(
    // 🔵 LOG: respuesta cruda del backend ANTES de mapearla
    tap((raw: any) => {
      console.log('%c[AUTH]/me RAW RESPONSE', 'color:#007bff;font-weight:bold;', raw);
      // log defensivo para ver si llegan campos de área/subárea
      console.log('%c[AUTH]/me FIELDS', 'color:#007bff',
        {
          id: raw?.id,
          name: raw?.name ?? raw?.firstname,
          area_id: raw?.area_id,
          area_name: raw?.area_name,
          subarea_id: raw?.subarea_id,
          subarea_name: raw?.subarea_name,
          roles: raw?.roles,
          permissions: raw?.permissions
        }
      );
    }),

    map((res: any) => {
      // … tu mapeo actual (no lo toco)
      const roles = Array.isArray(res?.roles) ? res.roles : [];
      const rawPerms = Array.isArray(res?.permissions) ? res.permissions : [];
      const normalizedPermissions = this.normalizePermList(rawPerms);

      const cacheUser = {
        id: res?.id,
        name: res?.name,
        surname: res?.surname,
        email: res?.email,
        area_id: res?.area_id,
        area_name: res?.area_name,
        subarea_id: res?.subarea_id,
        subarea_name: res?.subarea_name,
        roles,
        permissions: normalizedPermissions,
        avatar: res?.avatar,
        avatar_url: res?.avatar
          ? `${environment.URL_BACKEND}/storage/${res.avatar}`
          : null,
      };

      this.setUserCache(cacheUser);

      const mappedUser = new UserModel();
      // @ts-ignore
      mappedUser.setUser(cacheUser);
      this.currentUserSubject.next(mappedUser);
      return mappedUser;
    }),

    // 🔴 LOG: error crudo del endpoint
    catchError((err: HttpErrorResponse) => {
      console.log('%c[AUTH]/me ERROR', 'color:#dc3545;font-weight:bold;', {
        status: err.status,
        message: err.message,
        error: err.error
      });
      this.logout();
      return of(undefined);
    }),

    finalize(() => this.isLoadingSubject.next(false))
  );
}

*/













/*import { Injectable, OnDestroy } from '@angular/core';
import { Observable, BehaviorSubject, of, Subscription } from 'rxjs';
import { map, catchError, switchMap, finalize } from 'rxjs/operators';
import { UserModel } from '../models/user.model';
import { AuthModel } from '../models/auth.model';
import { AuthHTTPService } from './auth-http';
import { environment } from 'src/environments/environment';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { URL_SERVICIOS } from 'src/app/config/config';

export type UserType = UserModel | undefined;

@Injectable({
  providedIn: 'root',
})
export class AuthService implements OnDestroy {
  private unsubscribe: Subscription[] = [];
  private authLocalStorageToken = `${environment.appVersion}-${environment.USERDATA_KEY}`;

  currentUser$: Observable<UserType>;
  isLoading$: Observable<boolean>;
  currentUserSubject: BehaviorSubject<UserType>;
  isLoadingSubject: BehaviorSubject<boolean>;

  token: any;
  user: any;

  get currentUserValue(): UserType {
    return this.currentUserSubject.value;
  }

  set currentUserValue(user: UserType) {
    this.currentUserSubject.next(user);
  }

  constructor(
    private authHttpService: AuthHTTPService,
    private router: Router,
    private http: HttpClient,
  ) {
    this.isLoadingSubject = new BehaviorSubject<boolean>(false);
    this.currentUserSubject = new BehaviorSubject<UserType>(undefined);
    this.currentUser$ = this.currentUserSubject.asObservable();
    this.isLoading$ = this.isLoadingSubject.asObservable();
    const subscr = this.getUserByToken().subscribe();
    this.unsubscribe.push(subscr);
  }

  login(email: string, password: string): Observable<any> {
    this.isLoadingSubject.next(true);
    return this.http.post(URL_SERVICIOS + "/auth/login", { email, password }).pipe(
      map((auth: any) => {
        console.log('Respuesta del login:', auth);
        const result = this.setAuthFromLocalStorage(auth);
        if (result) {
          console.log('Token después del login:', this.token);
          this.getUserByToken().subscribe();
        }
        return result;
      }),
      catchError((err) => {
        console.error('Error en login:', err);
        return of(undefined);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  logout() {
    this.currentUserSubject.next(undefined);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    this.router.navigate(['/auth/login'], {
      queryParams: {},
    });
  }

  refreshToken(): Observable<any> {
    this.isLoadingSubject.next(true);
    return this.http.post(`${URL_SERVICIOS}/auth/refresh`, {}, {
      headers: { 'Authorization': 'Bearer ' + this.token }
    }).pipe(
      map((auth: any) => {
        console.log('Token refrescado:', auth);
        this.setAuthFromLocalStorage(auth);
        return auth;
      }),
      catchError((err) => {
        console.error('Error al refrescar token:', err);
        this.logout();
        return of(undefined);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  getUserByToken(): Observable<any> {
    const auth = this.getAuthFromLocalStorage();
    console.log('Auth data desde localStorage:', auth);
    if (!auth) {
      console.log('No se encontró auth data, redirigiendo al login');
      this.logout();
      return of(undefined);
    }

    // Verificar si el token ha expirado
    try {
      const tokenPayload = JSON.parse(atob(this.token.split('.')[1]));
      const expiration = tokenPayload.exp;
      const now = Math.floor(Date.now() / 1000);
      console.log('Token expiration:', expiration, 'Current time:', now);
      if (now >= expiration) {
        console.log('Token ha expirado, redirigiendo al login');
        this.logout();
        return of(undefined);
      }
    } catch (error) {
      console.error('Error al decodificar el token:', error);
      this.logout();
      return of(undefined);
    }

    this.isLoadingSubject.next(true);
    console.log('Token enviado:', this.token);
    return this.http.post(`${URL_SERVICIOS}/auth/me`, {}, {
      headers: { 'Authorization': 'Bearer ' + this.token }
    }).pipe(
      map((user: any) => {
        console.log('Usuario validado desde el backend:', user);
        if (user) {
          const mappedUser = new UserModel();
          mappedUser.setUser(user);
          this.currentUserSubject.next(mappedUser);
          return mappedUser;
        } else {
          console.log('Usuario no válido en el backend, intentando refrescar token');
          return this.refreshToken().pipe(
            switchMap(() => {
              return this.http.post(`${URL_SERVICIOS}/auth/me`, {}, {
                headers: { 'Authorization': 'Bearer ' + this.token }
              }).pipe(
                map((refreshedUser: any) => {
                  console.log('Usuario después de refrescar token:', refreshedUser);
                  if (refreshedUser) {
                    const mappedUser = new UserModel();
                    mappedUser.setUser(refreshedUser);
                    this.currentUserSubject.next(mappedUser);
                    return mappedUser;
                  } else {
                    console.log('Usuario no válido después de refrescar token, redirigiendo al login');
                    this.logout();
                    return undefined;
                  }
                })
              );
            })
          );
        }
      }),
      catchError((err) => {
        console.error('Error al validar usuario:', err);
        this.logout();
        return of(undefined);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  registration(user: UserModel): Observable<any> {
    this.isLoadingSubject.next(true);
    return this.authHttpService.createUser(user).pipe(
      map(() => {
        this.isLoadingSubject.next(false);
      }),
      switchMap(() => this.login(user.email, user.password)),
      catchError((err) => {
        console.error('err', err);
        return of(undefined);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  forgotPassword(email: string): Observable<boolean> {
    this.isLoadingSubject.next(true);
    return this.authHttpService
      .forgotPassword(email)
      .pipe(finalize(() => this.isLoadingSubject.next(false)));
  }

  private setAuthFromLocalStorage(auth: any): boolean {
    if (auth && auth.access_token) {
      localStorage.setItem('token', auth.access_token);
      localStorage.setItem('user', JSON.stringify({ ...auth.user, token: auth.access_token }));
      return true;
    }
    return false;
  }

  hasRole(role: number | string): boolean {
    const user = this.currentUserValue;
    if (!user) {
      return false;
    }
    if (typeof role === 'number') {
      return user.roles.includes(role);
    }
    return user.roleName === role;
  }

  hasPermission(permission: string): boolean {
    const user = this.currentUserValue;
    if (!user) {
      return false;
    }
    return user.permissions.includes(permission);
  }

  private getAuthFromLocalStorage(): AuthModel | undefined {
    try {
      const lsValue = localStorage.getItem('user');
      if (!lsValue) {
        return undefined;
      }
      this.token = localStorage.getItem('token');
      this.user = JSON.parse(lsValue);
      const authData = this.user;
      return authData;
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }

  ngOnDestroy() {
    this.unsubscribe.forEach((sb) => sb.unsubscribe());
  }
}

@Injectable({
  providedIn: 'root',
})
export class AuthService implements OnDestroy {
  // private fields
  private unsubscribe: Subscription[] = []; // Read more: => https://brianflove.com/2016/12/11/anguar-2-unsubscribe-observables/
  private authLocalStorageToken = `${environment.appVersion}-${environment.USERDATA_KEY}`;

  // public fields
  currentUser$: Observable<UserType>;
  isLoading$: Observable<boolean>;
  currentUserSubject: BehaviorSubject<UserType>;
  isLoadingSubject: BehaviorSubject<boolean>;

  get currentUserValue(): UserType {
    return this.currentUserSubject.value;
  }

    set currentUserValue(user: UserType) {
    this.currentUserSubject.next(user);
  }
  token:any;
  user: any;
  
  constructor(
    private authHttpService: AuthHTTPService,
    private router: Router,
    private http: HttpClient,
  ) {
    this.isLoadingSubject = new BehaviorSubject<boolean>(false);
    this.currentUserSubject = new BehaviorSubject<UserType>(undefined);
    this.currentUser$ = this.currentUserSubject.asObservable();
    this.isLoading$ = this.isLoadingSubject.asObservable();
    const subscr = this.getUserByToken().subscribe();
    this.unsubscribe.push(subscr);
  }

  
  //original
   public methods
  login(email: string, password: string): Observable<any> {
    this.isLoadingSubject.next(true);
    return this.http.post(URL_SERVICIOS+"/auth/login",{email, password}).pipe(
      map ((auth : any) => {
        const result = this.setAuthFromLocalStorage(auth);
        return result;
      }),
      //switchMap(() => this.getUserByToken()),
      catchError((err) => {
        console.error('err', err);
        return of(undefined);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

    //anexado en 4 abril
  login(email: string, password: string): Observable<any> {
    this.isLoadingSubject.next(true);
    return this.http.post(URL_SERVICIOS + "/auth/login", { email, password }).pipe(
      map((auth: any) => {
        const result = this.setAuthFromLocalStorage(auth);
        if (result) {
          this.getUserByToken().subscribe(); // Cargar usuario inmediatamente después del login
        }
        return result;
      }),
      catchError((err) => {
        console.error('err', err);
        return of(undefined);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  logout() {
    this.currentUserSubject.next(undefined); // agregado 24/04/25
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    this.router.navigate(['/auth/login'], {
      queryParams: {},
    });
  }

  //dejamos esta de lado.
  /*getUserByTok(): Observable<any> {
    const auth = this.getAuthFromLocalStorage();
    if (!auth) {
      return of(undefined);
    }

    this.isLoadingSubject.next(true);
    return of(auth).pipe(
      map((user: any) => {
        if (user) {
          this.currentUserSubject.next(user);
        } else {
          this.logout();
        }
        return user;
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }
  
    //implementarremos esta para sacar el ususario

  
  getUserByToken(): Observable<any> {
    const auth = this.getAuthFromLocalStorage();
    console.log('Auth data desde localStorage:', auth);
    if (!auth) {
      console.log('No se encontró auth data, redirigiendo al login');
      this.logout();
      return of(undefined);
    }
    this.isLoadingSubject.next(true);
    // Validar el usuario contra el backend
    return this.http.post(`${URL_SERVICIOS}/auth/me`, {
      headers: { 'Authorization': 'Bearer ' + this.token }
    }).pipe(
    
      map((user: any) => {
        if (user) {
          const mappedUser = new UserModel();
          mappedUser.setUser(user);
          console.log('Usuario crudo desde localStorage:', user);
          console.log('Usuario mapeado:', mappedUser);
          this.currentUserSubject.next(mappedUser);
          return mappedUser;
        } else {
          console.log('Usuario no válido en el backend, redirigiendo al login');
          this.logout();
          return undefined;
        }
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // need create new user then login
  registration(user: UserModel): Observable<any> {
    this.isLoadingSubject.next(true);
    return this.authHttpService.createUser(user).pipe(
      map(() => {
        this.isLoadingSubject.next(false);
      }),
      switchMap(() => this.login(user.email, user.password)),
      catchError((err) => {
        console.error('err', err);
        return of(undefined);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  forgotPassword(email: string): Observable<boolean> {
    this.isLoadingSubject.next(true);
    return this.authHttpService
      .forgotPassword(email)
      .pipe(finalize(() => this.isLoadingSubject.next(false)));
  }

  //agregue el 4 de abirl
  private setAuthFromLocalStorage(auth: any): boolean {
    if (auth && auth.access_token) {
      localStorage.setItem('token', auth.access_token);
      localStorage.setItem('user', JSON.stringify({ ...auth.user, token: auth.access_token })); // Incluir token en user
      return true;
    }
    return false;
  }  

  / private methods
  private setAuthFromLocalStorage(auth: any): boolean {
    // store auth access_token/refreshToken/epiresIn in local storage to keep user logged in between page refreshes
    if (auth && auth.access_token) {
      localStorage.setItem('token', auth.access_token);
      localStorage.setItem('user', JSON.stringify(auth.user));
      return true;
    }
    return false;
  }*
  // Verificar si el usuario tiene un rol específico
  hasRole(role: number | string): boolean {
    const user = this.currentUserValue;
    if (!user) {
      return false;
    }
    if (typeof role === 'number') {
      return user.roles.includes(role);
    }
    return user.roleName === role;
  }

  // Verificar si el usuario tiene un permiso específico
  hasPermission(permission: string): boolean {
    const user = this.currentUserValue;
    if (!user) {
      return false;
    }
    return user.permissions.includes(permission);
  }
  //hasta aqui agregue lo de hasRole y has permisision no viene ogirnal.

  private getAuthFromLocalStorage(): AuthModel | undefined {
    try {
      const lsValue = localStorage.getItem('user');
      if (!lsValue) {
        return undefined;
      }
      this.token = localStorage.getItem('token');
      this.user = JSON.parse(lsValue)
      const authData = this.user;
      return authData;
    } catch (error) {
      console.error(error);
      return undefined;
    }
  }

  ngOnDestroy() {
    this.unsubscribe.forEach((sb) => sb.unsubscribe());
  }
}*/
