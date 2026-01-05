import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, TimeoutError, of } from 'rxjs';
import { catchError, map, finalize, timeout, tap } from 'rxjs/operators';
import { AuthService } from 'src/app/modules/auth';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { URL_SERVICIOS } from 'src/app/config/config';

export interface Subarea {
  id: number;
  name: string;
  area: { id: number; name: string };
}

export interface Product {
  product_id: number;
  title: string;
  sku: string;
  stock: number;
  stock_global: number;
  invoice_number?: string;
  entry_id?: number;
  unit: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiService {
  private baseUrl = `${URL_SERVICIOS}`;
  isLoading$: Observable<boolean>;
  private isLoadingSubject: BehaviorSubject<boolean>;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router
  ) {
    this.isLoadingSubject = new BehaviorSubject<boolean>(false);
    this.isLoading$ = this.isLoadingSubject.asObservable();
    
  }
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({ 'Authorization': `Bearer ${this.authService.token}` });
  }

  
 
/** 📘 Analiza una requisición por su ID y obtiene recomendaciones IA */
analyzeRequisition(reqId: number): Observable<any> {
  this.isLoadingSubject.next(true);
  const headers = this.createHeaders();
  const URL = `${this.baseUrl}/ai/requisitions/${reqId}/analyze`;

  return this.http.post(URL, {}, { headers }).pipe(
    map((res: any) => res || res.data),
    catchError(this.handleError(`Error al analizar requisición #${reqId}`)),
    finalize(() => this.isLoadingSubject.next(false))
  );
}

  

  /** 🧾 Crea los headers con token del usuario */
  private createHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': 'Bearer ' + this.authService.token,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    });
  }

  /** 🔥 Análisis global IA — versión optimizada */
getGlobalAnalysis(filters: any = {}): Observable<any> {
  this.isLoadingSubject.next(true);

  const clean: any = {};

  // 🔹 Normalización absoluta
  const mapping: any = {
    categoria_id: 'category_id',
    fecha_inicio: 'start_date', // si en algún momento lo agregas
  };

  Object.entries(filters || {}).forEach(([key, val]: any) => {
    if (val === null || val === '' || val === 'all' || val === undefined) return;

    // convertir campos equivalentes
    const mappedKey = mapping[key] ?? key;

    clean[mappedKey] = val;
  });

  // 🔹 Año por defecto si no viene
  if (!clean.year) {
    clean.year = new Date().getFullYear();
  }

  const url = `${this.baseUrl}/ai/analysis/global`;

  return this.http.post(url, clean, { headers: this.getHeaders() }).pipe(
    tap(() => console.log('📡 Enviando filtros IA LIMPIOS:', clean)),
    map(res => res),
    catchError(this.handleError('Error al obtener análisis global')),
    finalize(() => this.isLoadingSubject.next(false))
  );
}


/* 1. Análisis global (POST con filtros) 
  getGlobalAnalysis(filters: any = {}): Observable<any> {
    this.isLoadingSubject.next(true);
    const url = `${this.baseUrl}/ai/analysis/global`;
    return this.http.post(url, filters, { headers: this.getHeaders() }).pipe(
      map(res => res),
      catchError(this.handleError('Error al obtener análisis global')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  */

  /** 3. Reporte por área */
  getAreaReport(areaId: number): Observable<any> {
    this.isLoadingSubject.next(true);
    const url = `${this.baseUrl}/ai/reports/areas/${areaId}`;
    return this.http.get(url, { headers: this.getHeaders() }).pipe(
      map(res => res),
      catchError(this.handleError(`Error al cargar área ${areaId}`)),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  chat(question: string, filters?: any): Observable<any> {
  console.log('📡 [AI SERVICE] Enviando a backend:', { question, filters });
  this.isLoadingSubject.next(true);
  const url = `${this.baseUrl}/ai/chat`;
  const payload = { question, filters };

  return this.http.post(url, payload, { headers: this.getHeaders() }).pipe(
    //timeout(15000),
    tap(res => console.log('📥 [AI SERVICE] Respuesta cruda:', res)),
    map(res => res),
    catchError(err => {
      console.error('🚨 [AI SERVICE] Error HTTP:', err);
      return throwError(() => err);
    }),
    finalize(() => {
      console.log('🔚 [AI SERVICE] Finalizado');
      this.isLoadingSubject.next(false);
    })
  );
}
  
  /** 5. Insights específicos */
  getInsights(filters: any = {}): Observable<any> {
    this.isLoadingSubject.next(true);
    const url = `${this.baseUrl}/ai/analysis/insights`;
    return this.http.post(url, filters, { headers: this.getHeaders() }).pipe(
      map(res => res),
      catchError(this.handleError('Error al obtener insights')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

/** 🔍 Último reporte global IA (con filtros por área, subárea, categoría, producto, fechas) */
getLatestReport(filters: any = {}): Observable<any> {
  this.isLoadingSubject.next(true);

  // 🔹 Limpieza: eliminamos campos vacíos o "all"
  const cleanFilters = Object.fromEntries(
    Object.entries(filters).filter(([_, v]) => v && v !== 'all')
  );

  const url = `${this.baseUrl}/ai/reports/latest`;

  return this.http.post(url, cleanFilters, { headers: this.getHeaders() }).pipe(
    timeout(30000),
    map((res: any) => {
      if (!res || res.success === false) {
        throw new Error(res?.message || 'IA no disponible');
      }
      return res;
    }),
    catchError((error: any) => {
      let message = 'Error desconocido al conectar con IA.';
      if (error instanceof TimeoutError) {
        message = 'Tiempo agotado: la IA no respondió.';
      } else if (error.status === 0) {
        message = 'No se pudo contactar al servidor.';
      } else if (error.error?.message) {
        message = error.error.message;
      } else if (error.message) {
        message = error.message;
      }

      Swal.fire({
        icon: 'error',
        title: 'IA No Disponible',
        text: message,
        confirmButtonText: 'Entendido'
      });

      return of({ success: false, data: {} });
    }),
    finalize(() => this.isLoadingSubject.next(false))
  );
}

  getAreas(): Observable<any[]> {
    this.isLoadingSubject.next(true);
    const url = `${this.baseUrl}/areas`;
    return this.http.get<any[]>(url, { headers: this.getHeaders() })
      .pipe(finalize(() => this.isLoadingSubject.next(false)));
  }

  getSubareasByArea(areaId: number): Observable<any> {
  this.isLoadingSubject.next(true);
  const url = `${this.baseUrl}/subareas/area/${areaId}`;
  return this.http.get(url, { headers: this.getHeaders() }).pipe(
    map((res: any) => res.subareas || []),
    catchError(() => of([])),
    finalize(() => this.isLoadingSubject.next(false))
  );
}



getCategorias(): Observable<any[]> {
    const url = `${this.baseUrl}/product_categories`;
    return this.http.get<any[]>(url, { headers: this.getHeaders() })
      .pipe(
        map((res: any) => res || []),
        catchError(() => of([])),
        finalize(() => this.isLoadingSubject.next(false))
      );
  }

 

searchSubareas(query: string): Observable<{ subareas: Subarea[] }> {
    const url = `${this.baseUrl}/subareas/search?search=${encodeURIComponent(query)}`;
    return this.http.get<{ subareas: Subarea[] }>(url, { headers: this.getHeaders() })
      .pipe(
        catchError(() => of({ subareas: [] })),
        finalize(() => this.isLoadingSubject.next(false))
      );
  }

  searchProducts(query: string = ''): Observable<{ products: Product[] }> {
    const url = `${this.baseUrl}/products/search?query=${encodeURIComponent(query)}`;
    return this.http.get<{ products: Product[] }>(url, { headers: this.getHeaders() })
      .pipe(
        catchError(() => of({ products: [] })),
        finalize(() => this.isLoadingSubject.next(false))
      );
  }

  searchCategories(query: string): Observable<any[]> {
    const url = `${this.baseUrl}/product_categories/search?query=${encodeURIComponent(query)}`;
    return this.http.get<any[]>(url, { headers: this.getHeaders() })
      .pipe(
        catchError(() => of([])),
        finalize(() => this.isLoadingSubject.next(false))
      );
  }

  searchPartidas(term: string): Observable<any> {
  if (!term || term.trim().length < 2) {
    return of([]);
  }
  // ESTA ES LA RUTA QUE SÍ VA A FUNCIONAR EN TU PROYECTO
  return this.http.get<any>(`${this.baseUrl}/partidas/existentes?q=${term}`);
}

  

  getPriorityProducts(filters: any): Observable<any> {
    const url = `${this.baseUrl}/ai/priority-products`;
    const params = new HttpParams({ fromObject: { ...filters, year: new Date().getFullYear() } });

    return this.http.get<any>(url, { headers: this.getHeaders(), params }).pipe(
      map(res => res.data || []),
      catchError(() => of([]))
    );
  }


  exportProductPdf(payload: any) 
  {
    return this.http.post(`${this.baseUrl}/reports/pdf`, payload, {
      responseType: 'blob' // Importante para descargar PDF
    });
  }



  analyzeProduct(product: any, series: number[]) {
  return this.http.post(`${this.baseUrl}/ai/analysis/product`, { product, series });
}


//PARA DASHBOAR EN VES DE AREA PESTAÑA 4 

// AGREGAR ESTE MÉTODO AL SERVICIO EXISTENTE
getAreaComparisonDashboard(filters: any): Observable<any> {
  const params = this.cleanFilters(filters);
  return this.http.get(`${this.baseUrl}/ai-area-reports-dashboard`, { params });
}

private cleanFilters(filters: any): any {
  const clean: any = {};
  Object.keys(filters).forEach(key => {
    if (filters[key] && filters[key] !== 'all' && filters[key] !== '') {
      clean[key] = filters[key];
    }
  });
  return clean;
}


// ========================================
//  🔧 Helper genérico para armar HttpParams (VERSION REPARADA)
// ========================================
private buildVehicleDashboardParams(filters: any = {}, extra: any = {}): HttpParams {
  let params = new HttpParams();

  const merged = { ...(filters || {}), ...(extra || {}) };

  Object.keys(merged).forEach((key) => {
    let val = merged[key];

    // ⚠️ NORMALIZACIÓN ABSOLUTA
    if (val === undefined || val === null) return;
    if (val === '' || val === ' ' || val === 'undefined' || val === 'null') return;

    // Si es objeto Tagify con {value:'...'}
    if (typeof val === 'object' && val?.value) {
      val = val.value;
    }

    params = params.set(key, String(val));
  });

  return params;
}


// ======================================================
//  📂 FILTROS TAGIFY — OK
// ======================================================
getVehicleDashboardFilters(): Observable<{
  areas: any[];
  subareas: any[];
  products: any[];
  providers: any[];
  vehicles: any[];
  partidas: string[];
  marcas_refaccion: string[];
  marcas_vehiculo: string[];
  tipos_vehiculo: string[];
  grupos: string[];
  subgrupos: string[];
  oficios: string[];
  modelos: string[];
  cilindros: string[];
  colores: string[];
  estados: string[];
}> {
  const url = `${this.baseUrl}/reports/vehicle-dashboard/filters`;

  return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
    map((res) => ({
      areas: res.areas ?? [],
      subareas: res.subareas ?? [],
      products: res.products ?? res.productos ?? [],
      providers: res.providers ?? res.proveedores ?? [],
      vehicles: res.vehicles ?? [],

      partidas: res.partidas ?? [],
      marcas_refaccion: res.marcas_refaccion ?? [],
      marcas_vehiculo: res.marcas_vehiculo ?? [],
      tipos_vehiculo: res.tipos_vehiculo ?? [],
      grupos: res.grupos ?? [],
      subgrupos: res.subgrupos ?? [],
      oficios: res.oficios ?? [],
      modelos: res.modelos ?? [],
      cilindros: res.cilindros ?? [],
      colores: res.colores ?? [],
      estados: res.estados ?? [],
    })),
    catchError(this.handleError('Error al obtener catálogos del dashboard de vehículos'))
  );
}


// ======================================================
//  📊 SUMMARY – KPIs + CHARTS
// ======================================================
getVehicleDashboardSummary(filters: any = {}): Observable<any> {
  this.isLoadingSubject.next(true);

  const url = `${this.baseUrl}/reports/vehicle-dashboard/summary`;
  const params = this.buildVehicleDashboardParams(filters);

  return this.http.get<any>(url, { headers: this.getHeaders(), params }).pipe(
    map((res) => res), // <-- DEJA EL JSON TAL CUAL SIN MODIFICAR
    catchError(this.handleError('Error al obtener dashboard de vehículos')),
    finalize(() => this.isLoadingSubject.next(false))
  );
}


// ======================================================
//  📋 TABLES
// ======================================================
getVehicleDashboardTables(filters: any = {}): Observable<any> {
  this.isLoadingSubject.next(true);

  const url = `${this.baseUrl}/reports/vehicle-dashboard/tables`;
  const params = this.buildVehicleDashboardParams(filters);

  return this.http.get<any>(url, { headers: this.getHeaders(), params }).pipe(
    map((res) => res),
    catchError(this.handleError('Error al obtener tablas del dashboard de vehículos')),
    finalize(() => this.isLoadingSubject.next(false))
  );
}


// ======================================================
//  📑 DETAIL
// ======================================================
getVehicleDashboardDetail(page = 1, perPage = 20, filters: any = {}): Observable<any> {
  this.isLoadingSubject.next(true);

  const url = `${this.baseUrl}/reports/vehicle-dashboard/detail`;
  const params = this.buildVehicleDashboardParams(filters, { page, per_page: perPage });

  return this.http.get<any>(url, { headers: this.getHeaders(), params }).pipe(
    map((res) => res),
    catchError(this.handleError('Error al obtener detalle del dashboard')),
    finalize(() => this.isLoadingSubject.next(false))
  );
}


// ======================================================
//  🤖 INSIGHTS IA
// ======================================================
getVehicleDashboardInsights(filters: any = {}): Observable<any> {
  this.isLoadingSubject.next(true);

  const url = `${this.baseUrl}/reports/vehicle-dashboard/aiinsights`;

  return this.http.post<any>(url, filters, { headers: this.getHeaders() }).pipe(
    map((res) => {
      if (typeof res === 'string') return res;
      if (typeof res?.analysis === 'string') return res.analysis;
      return JSON.stringify(res, null, 2); // fallback si OpenAI devuelve JSON
    }),
    catchError(this.handleError('Error al obtener insights IA del dashboard de vehículos')),
    finalize(() => this.isLoadingSubject.next(false))
  );
}


// ======================================================
//  🧾 PDF
// ======================================================
exportVehicleDashboardPdf(filters: any = {}): Observable<Blob> {
  this.isLoadingSubject.next(true);

  const url = `${this.baseUrl}/reports/vehicle-dashboard/export-pdf`;
  const params = this.buildVehicleDashboardParams(filters);

  return this.http.get(url, {
    headers: this.getHeaders(),
    params,
    responseType: 'blob',
  }).pipe(
    finalize(() => this.isLoadingSubject.next(false))
  );
}











  /** ⚠️ Manejo uniforme de errores con SweetAlert */
  private handleError(customMessage: string) {
    return (error: HttpErrorResponse) => {
      console.error('Error en AiService:', error);

      const message =
        error.error?.message ||
        error.message ||
        'Error de conexión con el servidor de IA.';

      Swal.fire({
        icon: 'error',
        title: 'Error IA',
        text: `${customMessage}: ${message}`,
        confirmButtonText: 'Entendido',
      });

      // Redirección si el token expira
      if (error.status === 401) {
        this.authService.logout();
        this.router.navigate(['/auth/login']);
      }

      return throwError(() => message);
    };
  }
  
}

/*
searchPartida(query: string): Observable<any[]> 
  {
    const url = `${this.baseUrl}/partidas/search?query=${encodeURIComponent(query)}`;
    return this.http.get<any>(url, { headers: this.getHeaders() }).pipe(
      map((res: any) => {
        if (Array.isArray(res)) {
          return res;
        } else if (res && Array.isArray(res.partidas)) {
          return res.partidas;
        } else {
          return [];
        }
      }),
      catchError(() => of([])),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }
    */

  
  /** 🔍 Último reporte global IA (con filtros por área, subárea, categoría, producto, fechas) 
  getLatestReport(filters: any = {}): Observable<any> {
    this.isLoadingSubject.next(true);

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== '' && value !== 'all' && value !== undefined) {
        // 🧩 corrección: el backend espera "category_id", no "categoria_id"
        const realKey = key === 'categoria_id' ? 'category_id' : key;
        params.append(realKey, value as any);
      }
    });

    const url = `${this.baseUrl}/ai/reports/latest?${params.toString()}`;
    return this.http.get(url, { headers: this.getHeaders() }).pipe(
      timeout(30000),
      map((res: any) => {
        if (!res || res.success === false) {
          throw new Error(res?.message || 'IA no disponible');
        }
        return res;
      }),
      catchError((error: any) => {
        let message = 'Error desconocido al conectar con IA.';
        if (error instanceof TimeoutError) {
          message = 'Tiempo agotado: la IA no respondió.';
        } else if (error.status === 0) {
          message = 'No se pudo contactar al servidor.';
        } else if (error.error?.message) {
          message = error.error.message;
        } else if (error.message) {
          message = error.message;
        }

        Swal.fire({
          icon: 'error',
          title: 'IA No Disponible',
          text: message,
          confirmButtonText: 'Entendido'
        });

        return of({ success: false, data: {} });
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

*/
  
