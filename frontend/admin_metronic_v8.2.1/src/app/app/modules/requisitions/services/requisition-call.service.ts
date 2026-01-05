import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, finalize, map } from 'rxjs/operators';
import { URL_SERVICIOS } from 'src/app/config/config';
import Swal from 'sweetalert2';
import { AuthService } from 'src/app/modules/auth/services/auth.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class RequisitionCallService {
  private baseUrl = `${URL_SERVICIOS}/requisition-calls`;
  isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();

  constructor(private http: HttpClient, private authService: AuthService, private router: Router) {}

  private get headers() {
    return new HttpHeaders({ Authorization: `Bearer ${this.authService.token}` });
  }

/** 🔹 Crear convocatoria para requisition-call-create tambien la puede utilizar
 * la de requisition-call-list
 */
  create(data: any): Observable<any> {
    this.isLoadingSubject.next(true);
    return this.http.post(this.baseUrl, data, { headers: this.headers }).pipe(
      map((res: any) => ({
        call: res.data || res,
        message: res.message || 'Convocatoria creada exitosamente'
      })),
      catchError(this.handleError('Error al crear convocatoria')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /** 🔹 Obtener convocatoria por ID  requisition-call-create*/
  getById(id: number): Observable<any> {
    this.isLoadingSubject.next(true);
    const URL = `${this.baseUrl}/${id}`;
    return this.http.get(URL, { headers: this.headers }).pipe(
      map((res: any) => res.data || res),
      catchError(this.handleError('Error al obtener convocatoria')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /** 🔹 Actualizar convocatoria requisition-call-create tambien la puede utilizar
   * la de requisition-call-list
  */
  update(id: number, data: any): Observable<any> {
    this.isLoadingSubject.next(true);
    const URL = `${this.baseUrl}/${id}`;
    return this.http.put(URL, data, { headers: this.headers }).pipe(
      map((res: any) => ({
        call: res.data || res,
        message: res.message || 'Convocatoria actualizada correctamente'
      })),
      catchError(this.handleError('Error al actualizar convocatoria')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /** 🔹 Sincronizar productos requisition-call-create*/
  syncProducts(id: number, payload: any): Observable<any> {
    this.isLoadingSubject.next(true);
    const URL = `${this.baseUrl}/${id}/sync-products`;
    return this.http.post(URL, payload, { headers: this.headers }).pipe(
      map((res: any) => ({
        message: res.message || 'Productos sincronizados correctamente'
      })),
      catchError(this.handleError('Error al sincronizar productos')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }


  /** 🔹 Listar convocatorias requisition-call-list */
  getAll(params: any = {}): Observable<any> {
    this.isLoadingSubject.next(true);
    return this.http.get(this.baseUrl, { headers: this.headers, params }).pipe(
      map((res: any) => res.data || res.calls || []),
      catchError(this.handleError('Error al obtener convocatorias')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  

  /** 🔹 Buscar convocatoria activa */
  getActive(params: { year?: number; month?: number } = {}): Observable<any | null> {
    this.isLoadingSubject.next(true);
    const httpParams = new HttpParams({
      fromObject: {
        ...(params.year ? { year: String(params.year) } : {}),
        ...(params.month ? { month: String(params.month) } : {})
      }
    });
    const URL = `${this.baseUrl}/active`;

    return this.http.get(URL, { headers: this.headers, params: httpParams }).pipe(
      map((res: any) => res.data || res || null),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 404) {
          Swal.fire('Atención', 'No hay convocatoria activa en este momento.', 'info');
          return of(null);
        }
        Swal.fire('Error', 'Error al obtener convocatoria activa.', 'error');
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /** 🔍 Buscar productos (idéntico a ProductExit) requisition-call-create */
  searchProducts(query: string): Observable<{ products: any[] }> {
    if (!query || query.trim().length < 1) return of({ products: [] });

    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ Authorization: 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/product-exits/search-products?query=${encodeURIComponent(query)}`;

    console.log('🟢 Buscando productos desde RequisitionCallService:', query);

    return this.http.get(URL, { headers }).pipe(
      map((response: any) => {
        const products = response.products || [];
        const validProducts = products.filter((product: any) => {
          const isValid =
            product.product_id &&
            product.stock > 0 &&
            product.unit &&
            product.title;
          if (!isValid) console.warn('⛔ Producto descartado:', product);
          return isValid;
        });

        console.log('📦 Productos válidos recibidos:', validProducts);
        return { products: validProducts };
      }),
      catchError((error) => {
        console.error('❌ Error en búsqueda de productos:', error);
        Swal.fire('Error', 'No se pudo buscar productos.', 'error');
        return of({ products: [] });
      }),
      finalize(() => {
        this.isLoadingSubject.next(false);
        console.log('🔚 Búsqueda finalizada.');
      })
    );
  }

  /** 🔹 Eliminar convocatoria */
  delete(id: number): Observable<any> {
    this.isLoadingSubject.next(true);
    const URL = `${this.baseUrl}/${id}`;
    return this.http.delete(URL, { headers: this.headers }).pipe(
      map((res: any) => ({
        success: res.success,
        message: res.message || 'Convocatoria eliminada correctamente'
      })),
      catchError(this.handleError('Error al eliminar convocatoria')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /** 🧰 Handler genérico para errores */
  private handleError(message: string) {
    return (error: HttpErrorResponse): Observable<never> => {
      let errorMessage = message;

      if (error.error?.message) errorMessage = error.error.message;
      else if (error.status === 401)
        errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
      else if (error.status === 422 && error.error.errors)
        errorMessage = Object.values(error.error.errors).flat().join(', ');
      else if (error.status >= 500)
        errorMessage = `${message}: Error interno del servidor`;

      Swal.fire('Error', errorMessage, 'error');
      return throwError(() => new Error(errorMessage));
    };
  }
}
