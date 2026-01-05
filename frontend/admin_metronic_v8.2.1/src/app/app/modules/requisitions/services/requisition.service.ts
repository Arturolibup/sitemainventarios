import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, finalize, map, tap } from 'rxjs/operators';
import { AuthService } from 'src/app/modules/auth/services/auth.service';
import { URL_SERVICIOS } from 'src/app/config/config';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';

interface GenerateCallPayload {
  requisition_call_id: number;
  area_id?: number;
  subarea_id?: number;
}


@Injectable({
  providedIn: 'root'
})
export class RequisitionService {
  private baseUrl = `${URL_SERVICIOS}/requisitions`;
  private callUrl = `${URL_SERVICIOS}/requisition-calls`; // 
  isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable();

  constructor(private http: HttpClient, private authService: AuthService, private router: Router) {}

  private get headers() {
    //return new HttpHeaders({ Authorization: `Bearer ${this.authService.token}` });
    const headers = new HttpHeaders({ Authorization: 'Bearer ' + this.authService.token });
    return headers; 
  }

 
private loading(state: boolean): void {
  this.isLoadingSubject.next(state);
}

  /** 🔹 Listado general (todas las requisiciones, con filtros opcionales) */
  getAll(params: any = {}): Observable<any> {
  this.isLoadingSubject.next(true);
  const headers = new HttpHeaders({ Authorization: `Bearer ${this.authService.token}` });
  const URL = `${URL_SERVICIOS}/requisitions`;

  return this.http.get(URL, { headers, params }).pipe(
    map((res: any) => {
      console.log('RESPUESTA CRUDA API:', res); // ← DEBUG

      // CASO 1: Laravel paginador directo { data: [...], total, ... }
      if (res?.data && Array.isArray(res.data)) {
        return {
          data: res.data,
          total: res.total,
          current_page: res.current_page
        };
      }

      // CASO 2: Laravel paginador anidado { data: { data: [...], total } }
      if (res?.data?.data && Array.isArray(res.data.data)) {
        return res.data;
      }

      // CASO 3: Array plano
      if (Array.isArray(res)) {
        return { data: res, total: res.length, current_page: 1 };
      }

      return { data: [], total: 0, current_page: 1 };
    }),
    catchError(this.handleError('Error al obtener requisiciones')),
    finalize(() => this.isLoadingSubject.next(false))
  );
}


 /** 🔹 Obtener requisiciones del usuario actual para my-requisitions-list*/
getMine(params: any = {}): Observable<any> {
  this.isLoadingSubject.next(true);
  const URL = `${this.baseUrl}/my`;
  return this.http.get(URL, { headers: this.headers, params }).pipe(
    map((res: any) => res.data || res.requisitions || []),
    catchError(this.handleError('Error al obtener tus requisiciones')),
    finalize(() => this.isLoadingSubject.next(false))
  );
}

// Crear o actualizar borrador de requisición de las areas requisition-create y 
// funciona como requisition-edit 
/*
  createDraft(payload: any): Observable<any> {
    console.log('🧩 Enviando a createDraft, payload:', payload);
    const { id, requisition_call_id, area_id, subarea_id, items } = payload;
    // **NUEVA** → type='normal' para usuarios
    const fullPayload = { ...payload, type: 'normal' };

    if (id) {
      console.log('🧩 Actualizando requisición existente:', id);
      const URL = `${this.baseUrl}/${id}/save-draft`;
      return this.http.put(URL, fullPayload, { headers: this.headers }); // Corregido
    } else {
      console.log('🧩 Creando nueva requisición');
      const URL = `${this.baseUrl}/generate-from-call`;
      return this.http.post(URL, fullPayload, { headers: this.headers }); // Corregido
    }
  }
*/

  createDraft(payload: any): Observable<any> {
  console.log('Enviando a createDraft, payload:', payload);
  const { id, items } = payload;

  // Normalizar ítems: usar item_id si existe
  const normalizedItems = items.map((item: any) => ({
    item_id: item.item_id || null,
    requested_qty: item.requested_qty,
    unit_id: item.unit_id || null,
    notes: item.notes || ''
  }));

  const fullPayload = { ...payload, items: normalizedItems };

  if (id) {
    console.log('Actualizando borrador existente:', id);
    const URL = `${this.baseUrl}/${id}/save-draft`;
    return this.http.put(URL, fullPayload, { headers: this.headers });
  } else {
    console.log('Creando nueva requisición');
    const URL = `${this.baseUrl}/generate-from-call`;
    return this.http.post(URL, fullPayload, { headers: this.headers });
  }
}


  submitRequisition(payload: any): Observable<any> {
    console.log('🧩 Enviando a submitRequisition, payload:', payload);
    const URL = `${this.baseUrl}/${payload.id}/send`;
    return this.http.post(URL, payload, { headers: this.headers }); // Corregido
  }


  /** 🔹 Detalle de requisición */
  getById(id: number): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ Authorization: 'Bearer ' + this.authService.token });
    const URL = `${this.baseUrl}/${id}`;
    console.log('🧩 Solicitando requisición con URL:', URL); // Log de la URL
    return this.http.get(URL, { headers }).pipe(
      tap((res: any) => console.log('🧩 Respuesta cruda del backend:', res)), // Log de la respuesta completa
      map((res: any) => {
        if (res.success === false) {
          throw new Error(res.message || 'Error desconocido en la respuesta');
        }
        return res; // Devolvemos la respuesta completa { success, data }
      }),
      catchError((err) => {
        console.error('🧩 Error en getById:', err);
        return this.handleError('Error al obtener detalle de requisición')(err);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }


  /** 🔹 Aprobar requisición (Área 3) */
  approve(id: number, data: any): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ Authorization: 'Bearer ' + this.authService.token });
    const URL = `${this.baseUrl}/${id}/approve`;
    return this.http.post(URL, data, { headers }).pipe(
      map((res: any) => ({
        requisition: res.data || res,
        message: res.message || 'Requisición aprobada exitosamente',
        draft_url: res.draft_url,
        exit_folio: res.exit_folio
      })),
      catchError(this.handleError('Error al aprobar requisición')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }


 

    getStockByProducts(productIds: number[]): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product-exits/check-low-stockalto`;
        return this.http.post(URL, { product_ids: productIds }, { headers }).pipe(
            catchError(this.handleError('Error al verificar stock bajo')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

  // GENERAR SALIDA DESDE REQUISICIÓN
  // ========================================
  generateExitFromRequisition(requisitionId: number): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ Authorization: 'Bearer ' + this.authService.token });
    const URL = `/api/product-exits/from-requisition/${requisitionId}`;
    console.log('Generando salida desde requisición ID:', requisitionId);

    return this.http.post(URL, {}, { headers }).pipe(
      tap((res: any) => console.log('Salida generada:', res)),
      map((res: any) => res),
      catchError(this.handleError('Error al generar salida')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }


  //borrrar requisicion en my-requisitions-list
  delete(requisitionId: number): Observable<any> {
  this.isLoadingSubject.next(true);
  const headers = new HttpHeaders({ Authorization: 'Bearer ' + this.authService.token });
  const URL = `${this.baseUrl}/${requisitionId}`;
  
  return this.http.delete(URL, { headers }).pipe(
    tap(() => console.log('Requisición eliminada')),
    catchError(this.handleError('Error al eliminar requisición')),
    finalize(() => this.isLoadingSubject.next(false))
  );
}

 /** 🔹 Generar requisición base desde convocatoria lo usa requisition-call-list y tambien 
  * cuando se crea desde my-requisitions-list para cada Area/Subarea del usuario
 */
/** Generar requisición base desde convocatoria */
generateFromCall(data: GenerateCallPayload): Observable<any> {
  this.isLoadingSubject.next(true);
  const url = `${this.baseUrl}/generate-from-call`;

  return this.http.post(url, data, { headers: this.headers }).pipe(
    map((res: any) => {
      // Si el backend devuelve { success: true, data: {...} }
      if (res?.success && res?.data) {
        return {
          data: res.data,
          message: res.message || 'Requisición creada correctamente'
        };
      }

      // Si solo devuelve el objeto (legacy)
      return {
        data: res,
        message: 'Operación completada'
      };
    }),
    catchError(err => {
      console.error('Error en generateFromCall:', err);
      return throwError(() => err);
    }),
    finalize(() => this.isLoadingSubject.next(false))
  );
}


generateFromBase(data: GenerateCallPayload): Observable<any> {
  this.isLoadingSubject.next(true);
  const url = `${this.baseUrl}/generate-from-base`;

  return this.http.post(url, data, { headers: this.headers }).pipe(
    map((res: any) => {
      // Si el backend devuelve { success: true, data: {...} }
      if (res?.success && res?.data) {
        return {
          data: res.data,
          message: res.message || 'Requisición creada correctamente'
        };
      }

      // Si solo devuelve el objeto (legacy)
      return {
        data: res,
        message: 'Operación completada'
      };
    }),
    catchError(err => {
      console.error('Error en generateFromCall:', err);
      return throwError(() => err);
    }),
    finalize(() => this.isLoadingSubject.next(false))
  );
}


uploadExitPdf(id: number, form: FormData): Observable<any> {
    this.isLoadingSubject.next(true);
    const url = `${this.baseUrl}/${id}/exit-pdf`;
    return this.http.post(url, form, { headers: this.headers }).pipe(
      map((res: any) => res),
      catchError(this.handleError('Error al subir vale firmado')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

/** 🔹 Obtener todas las convocatorias */
  getAllCalls(): Observable<any[]> {
    const URL = `${this.callUrl}`;
    return this.http.get(URL, { headers: this.headers }).pipe(
      map((res: any) => res.data || res || []),
      catchError(this.handleError('Error al obtener convocatorias'))
    );
  }

  /** 🔹 Obtener convocatorias activas para my-requisitions-list*/
  getActive(): Observable<any[]> {
    this.isLoadingSubject.next(true);
    const URL = `${this.callUrl}/active`;
    return this.http.get(URL, { headers: this.headers }).pipe(
      map((res: any) => res.data || res || []),
      catchError(this.handleError('Error al obtener convocatorias activas')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /** Alias opcional (por compatibilidad con componentes que usan getActiveCalls) */
  getActiveCalls(): Observable<any[]> {
    return this.getActive();
  }
  
  // requisition.service.ts
getPrintDraftPdf(id: number): Observable<any> {
  const url = `${URL_SERVICIOS}/requisitions/${id}/print-draft-pdf`;
  return this.http.get(url, { headers: this.headers });
}
  /** 🔹 Manejo de errores */
  private handleError(message: string) {
    return (error: HttpErrorResponse): Observable<never> => {
      let errorMessage = message;

      if (error.error && error.error.message) {
        errorMessage = error.error.message;
      } else if (error.status === 401) {
        errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
        this.authService.logout();
        Swal.fire('Sesión Expirada', errorMessage, 'warning').then(() => {
          this.router.navigate(['/login']);
        });
      } else if (error.status >= 500) {
        errorMessage = `${message}: Error interno del servidor`;
      }

      console.error('⚠️ Error detectado:', errorMessage, error);
      return throwError(() => new Error(errorMessage));
    };
  }


// ==================================================================
// MÉTODOS USADOS POR MyRequisitionsList + RequisitionCreate
// ==================================================================

/** Participar en convocatoria (Área) */
participateInCall(callId: number): Observable<any> {
  this.loading(true);
  return this.http.post(`${this.baseUrl}/generate-from-base`, 
    { requisition_call_id: callId }, 
    { headers: this.headers }
  ).pipe(
    map((res: any) => ({ data: res.data, message: res.message })),
    catchError(this.handleError('Error al participar')),
    finalize(() => this.loading(false))
  );
}
  

/** Cargar requisición para edición */
getRequisitionForEdit(id: number): Observable<any> {
  this.loading(true);
  return this.http.get(`${this.baseUrl}/${id}`, { headers: this.headers }).pipe(
    map((res: any) => {
  const requisition = res.data || res;
  return {
    success: true,
    data: requisition,
    items: requisition.items || []
  };
}),
    catchError(this.handleError('Error al cargar requisición')),
    finalize(() => this.loading(false))
  );
}

/** Guardar borrador (nuevo desde convocatoria) */
saveDraftFromCall(payload: any): Observable<any> {
  this.loading(true);
  return this.http.post(`${this.baseUrl}/generate-from-call`, payload, { headers: this.headers }).pipe(
    map((res: any) => ({ data: res.data, message: res.message })),
    catchError(this.handleError('Error al guardar borrador')),
    finalize(() => this.loading(false))
  );
}

/** Actualizar borrador existente */
updateRequisitionDraft(id: number, items: any[]): Observable<any> {
  this.loading(true);
  const payload = { items: items.map(i => ({
    item_id: i.item_id,
    requested_qty: i.requested_qty,
    unit_id: i.unit_id,
    notes: i.notes
  }))};

  return this.http.put(`${this.baseUrl}/${id}/save-draft`, payload, { headers: this.headers }).pipe(
    map((res: any) => ({ message: res.message || 'Error al actualizar' })),
    catchError(this.handleError('Error al actualizar')),
    finalize(() => this.loading(false))
  );
}

/** Enviar requisición */
sendRequisition(id: number): Observable<any> {
  this.loading(true);
  return this.http.post(`${this.baseUrl}/${id}/send`, {}, { headers: this.headers }).pipe(
    map((res: any) => ({ message: res.message || 'Enviada' })),
    catchError(this.handleError('Error al enviar')),
    finalize(() => this.loading(false))
  );
}

}








/** Mis requisiciones (para botón "Ya participaste") 
getMyRequisitions(): Observable<any[]> {
  this.loading(true);
  return this.http.get(`${this.baseUrl}/my`, { headers: this.headers }).pipe(
    map((res: any) => {
      // CASO 1: { data: [...] }
      if (res?.data && Array.isArray(res.data)) {
        return res.data;
      }
      // CASO 2: { requisitions: [...] }
      if (res?.requisitions && Array.isArray(res.requisitions)) {
        return res.requisitions;
      }
      // CASO 3: Array plano
      if (Array.isArray(res)) {
        return res;
      }
      // CASO 4: Nada
      return [];
    }),
    catchError(this.handleError('Error al cargar tus requisiciones')),
    finalize(() => this.loading(false))
  );
}
*/
/** 🔹 Enviar requisición 
  sendRequisition(id: number): Observable<any> {
    this.isLoadingSubject.next(true);
    const URL = `${this.baseUrl}/${id}/send`;
    return this.http.post(URL, {}, { headers: this.headers }).pipe(
      map((res: any) => ({
        requisition: res.data || res,
        message: res.message || 'Requisición enviada correctamente'
      })),
      catchError(this.handleError('Error al enviar requisición')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }
*/


/** 🔹 Crear borrador de las areas cuando modifiquen algo*/ 

/*
  createDraft(data: any): Observable<any> {
    this.isLoadingSubject.next(true);
    return this.http.post(this.baseUrl, data, { headers: this.headers }).pipe(
      map((res: any) => ({
        requisition: res.data || res,
        message: res.message || 'Borrador creado correctamente'
      })),
      catchError(this.handleError('Error al crear borrador')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }
*/

  /** CREAR REQUISICIÓN DESDE BASE GENERAL (ÁREAS) 
generateFromBase(payload: any): Observable<any> {
  const URL = `${URL_SERVICIOS}/requisitions/generate-from-base`;
  return this.http.post(URL, payload, { headers: this.headers }).pipe(
    map((res: any) => res),
    catchError(this.handleError('Error al generar requisición desde base'))
  );
}
*/
/** 🔹 Detalle de requisición 
  getById(id: number): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ Authorization: 'Bearer ' + this.authService.token });
    const URL = `${this.baseUrl}/${id}`;
    return this.http.get(URL, { headers }).pipe(
      map((res: any) => res.data || res || {}),
      catchError(this.handleError('Error al obtener detalle de requisición')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }
*/