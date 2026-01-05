import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, map, finalize } from 'rxjs/operators';
import { AuthService } from '../../auth';
import { URL_SERVICIOS } from 'src/app/config/config';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class OpserviceService {
  isLoading$: Observable<boolean>;
  isLoadingSubject: BehaviorSubject<boolean>;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router
  ) {
    this.isLoadingSubject = new BehaviorSubject<boolean>(false);
    this.isLoading$ = this.isLoadingSubject.asObservable();
  }

  /**
   * Obtiene los datos del usuario por ID.
   * @param userId ID del usuario.
   * @returns Observable con los datos del usuario.
   */
  getUserById(userId: number): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/users/${userId}`;
    return this.http.get(URL, { headers }).pipe(
      map((response: any) => {
        console.log('Respuesta de /api/users/' + userId + ':', response);
        return response.data || response;
      }),
      catchError(this.handleError('Error al obtener datos del usuario')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Obtiene la lista de proveedores con paginación y búsqueda.
   * @param page Página actual.
   * @param perPage Elementos por página.
   * @param query Término de búsqueda.
   * @returns Observable con la lista de proveedores.
   */
  getProviders(page: number = 1, perPage: number = 10, query: string = ''): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());
    if (query) {
      params = params.set('query', query);
    }
    const URL = `${URL_SERVICIOS}/providers`;
    return this.http.get(URL, { headers, params }).pipe(
      map((response: any) => ({
        providers: response.data || response.providers || [],
        meta: response.meta || {}
      })),
      catchError(this.handleError('Error al obtener proveedores')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Busca proveedores por término.
   * @param query Término de búsqueda.
   * @param page Página actual.
   * @param perPage Elementos por página.
   * @returns Observable con los resultados de búsqueda.
   */
  searchProviders(query: string, page: number = 1, perPage: number = 10): Observable<any> {
    return this.getProviders(page, perPage, query);
  }

  /**
   * Obtiene la lista de áreas.
   * @returns Observable con la lista de áreas.
   */
  getAreas(): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/areas`;
    return this.http.get(URL, { headers }).pipe(
      map((response: any) => ({
        areas: response.data || response.areas || []
      })),
      catchError(this.handleError('Error al obtener áreas')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Obtiene la lista de subáreas con filtros opcionales.
   * @param areaId ID del área (opcional).
   * @param page Página actual.
   * @param perPage Elementos por página.
   * @param query Término de búsqueda.
   * @returns Observable con la lista de subáreas.
   */
  getSubareas(areaId?: number, page: number = 1, perPage: number = 10, query: string = ''): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());
    if (areaId) {
      params = params.set('area_id', areaId.toString());
    }
    if (query) {
      params = params.set('query', query);
    }
    const URL = `${URL_SERVICIOS}/subareas`;
    return this.http.get(URL, { headers, params }).pipe(
      map((response: any) => ({
        subareas: response.data || response.subareas || [],
        meta: response.meta || {}
      })),
      catchError(this.handleError('Error al obtener subáreas')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Busca subáreas por término.
   * @param query Término de búsqueda.
   * @param page Página actual.
   * @param perPage Elementos por página.
   * @returns Observable con los resultados de búsqueda.
   */
  searchSubareas(query: string, page: number = 1, perPage: number = 10): Observable<any> {
    return this.getSubareas(undefined, page, perPage, query);
  }

  /**
   * Obtiene la lista de unidades.
   * @returns Observable con la lista de unidades.
   */
  getUnits(): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/units`;
    return this.http.get(URL, { headers }).pipe(
      map((response: any) => ({
        units: response.data || response.units || []
      })),
      catchError(this.handleError('Error al obtener unidades')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Obtiene la lista de productos con paginación y búsqueda.
   * @param page Página actual.
   * @param perPage Elementos por página.
   * @param query Término de búsqueda.
   * @returns Observable con la lista de productos.
   */
  getProducts(page: number = 1, perPage: number = 10, query: string = ''): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());
    if (query) {
      params = params.set('query', query);
    }
    const URL = `${URL_SERVICIOS}/products`;
    return this.http.get(URL, { headers, params }).pipe(
      map((response: any) => ({
        products: response.data || response.products || [],
        meta: response.meta || {}
      })),
      catchError(this.handleError('Error al obtener productos')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Busca productos por término.
   * @param query Término de búsqueda.
   * @param page Página actual.
   * @param perPage Elementos por página.
   * @returns Observable con los resultados de búsqueda.
   */
  searchProducts(query: string, page: number = 1, perPage: number = 10): Observable<any> {
    return this.getProducts(page, perPage, query);
  }

  /**
   * Obtiene la lista de marcas.
   * @returns Observable con la lista de marcas.
   */
  getMarcas(): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/marcas`;
    return this.http.get(URL, { headers }).pipe(
      map((response: any) => ({
        marcas: response.data || response.marcas || []
      })),
      catchError(this.handleError('Error al obtener marcas')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Obtiene la lista de tipos por marca.
   * @param marcaId ID de la marca.
   * @returns Observable con la lista de tipos.
   */
  getTipos(marcaId: number): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    let params = new HttpParams().set('marca_id', marcaId.toString());
    const URL = `${URL_SERVICIOS}/tipos`;
    return this.http.get(URL, { headers, params }).pipe(
      map((response: any) => ({
        tipos: response.data || response.tipos || []
      })),
      catchError(this.handleError('Error al obtener tipos')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Obtiene la lista de categorías de productos.
   * @returns Observable con la lista de categorías.
   */
  getProductCategories(): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/product_categories`;
    return this.http.get(URL, { headers }).pipe(
      map((response: any) => ({
        categories: response.data || response.categories || []
      })),
      catchError(this.handleError('Error al cargar categorías de productos')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Crea un nuevo producto.
   * @param productData Datos del producto.
   * @returns Observable con la respuesta de creación.
   */
  createProduct(productData: any): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/products`;
    return this.http.post(URL, productData, { headers }).pipe(
      map((response: any) => ({
        product: response.data || response
      })),
      catchError(this.handleError('Error al crear producto')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Verifica si un producto existe por SKU.
   * @param sku SKU del producto.
   * @returns Observable con la respuesta de verificación.
   */
  checkProductExists(sku: string): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/products/check-exists?sku=${encodeURIComponent(sku)}`;
    return this.http.get(URL, { headers }).pipe(
      map((response: any) => ({
        exists: response.exists || false,
        product: response.data || response.product || null
      })),
      catchError(this.handleError('Error al verificar existencia del producto')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Obtiene la lista de vehículos con paginación y búsqueda.
   * @param page Página actual.
   * @param perPage Elementos por página.
   * @param search Término de búsqueda.
   * @returns Observable con la lista de vehículos.
   */
  getVehiculos(search: string = '', page: number = 1, perPage: number = 10, ): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());
    if (search) {
      params = params.set('search', search);
    }
    const URL = `${URL_SERVICIOS}/opvehiculos`;
    return this.http.get(URL, { headers, params }).pipe(
      map((response: any) => ({
        vehiculos: response.data || response.vehiculos || [],
        meta: response.meta || {}
      })),
      catchError(this.handleError('Error al obtener vehículos')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Busca vehículos por término.
   * @param search Término de búsqueda.
   * @param page Página actual.
   * @param perPage Elementos por página.
   * @returns Observable con los resultados de búsqueda.
   */
  searchVehiculos(search: string, page: number = 1, perPage: number = 10): Observable<any> {
    return this.getVehiculos(search, page, perPage, );
  }

  

  /**
   * Crea una nueva suficiencia presupuestal (modo create_sf).
   * @param data Datos de la suficiencia.
   * @returns Observable con la respuesta de creación.
   */
  createSuficiencia(data: any): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/orders/create_sf`;
    return this.http.post(URL, data, { headers }).pipe(
      map((response: any) => ({
        order: response.data || response,
        message: response.message || 'Suficiencia presupuestal creada exitosamente'
      })),
      catchError(this.handleError('Error al crear suficiencia presupuestal')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Envía una orden a Área 2 para revisión de suficiencia.
   * @param orderId ID de la orden.
   * @param data Datos con foliosf.
   * @returns Observable con la respuesta.
   */
  sendToArea2(orderId: number, data: { foliosf: string }): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/orders/${orderId}/send-to-area2`;
    return this.http.post(URL, data, { headers }).pipe(
      map((response: any) => ({
        order: response.data || response,
        message: response.message || 'Orden enviada a Área 2 exitosamente'
      })),
      catchError(this.handleError('Error al enviar la orden a Área 2')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Valida una suficiencia presupuestal en Área 2 (modo validate_sf).
   * @param orderId ID de la orden.
   * @param data Datos de validación (financiamiento y productos).
   * @returns Observable con la respuesta.
   */
  validateSuficiencia(orderId: number, data: any): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/orders/${orderId}/validate-sf`;
    return this.http.post(URL, data, { headers }).pipe(
      map((response: any) => ({
        order: response.data || response,
        message: response.message || 'Suficiencia validada exitosamente',
        pdf_path: response.pdf_path || null
      })),
      catchError(this.handleError('Error al validar suficiencia')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // Nuevo método para verificar unicidad
  checkUnique(field: string, value: string): Observable<boolean> {
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/orders/check-unique`;
    return this.http.post(URL, { field, value }, { headers }).pipe(
      map((response: any) => response.isUnique),
      catchError(this.handleError('Error al verificar unicidad')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

 getOrderById(id: number): Observable<any> {
  this.isLoadingSubject.next(true);
  const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
  const URL = `${URL_SERVICIOS}/orders/${id}`;

  return this.http.get(URL, { headers }).pipe(
    map((response: any) => {
      // Normalizamos por si el backend responde como {data}, {order} o plano
      return response?.data || response?.order || response || null;
    }),
    catchError(this.handleError('Error al obtener la orden por ID')),
    finalize(() => this.isLoadingSubject.next(false))
  );
}

  getOrders(page: number = 1, perPage: number = 10, query: string = '', status: string = '', sort: string = 'created_at', direction: string = 'desc'): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString())
      .set('sort', sort)
      .set('direction', direction);
    if (query) {
      params = params.set('query', query);
    }
    if (status) {
      params = params.set('status', status);
    }
    const URL = `${URL_SERVICIOS}/orders`;
    
    return this.http.get(URL, { headers, params }).pipe(
      map((response: any) => {
        
        let data = [];
        let meta = { total: 0, per_page: perPage, current_page: page };
        
        if (response && typeof response === 'object') {
          if (Array.isArray(response)) {
            // La API devuelve un array directamente
            data = response;
            meta.total = response.length;
          } else if (response.data !== undefined) {
            // Estructura { data: [], meta: {} }
            data = response.data || [];
            meta = { ...meta, ...(response.meta || {}) };
          } else if (response.orders !== undefined) {
            // Estructura { orders: [], total: X }
            data = response.orders || [];
            meta.total = response.total || 0;
          } else{
            data = [response];
            meta.total= 1;
          }
        }
        
        return { data, meta };
      }),
      catchError(this.handleError('Error al obtener los datos')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Crea una nueva orden de pedido.
   * @param data Datos de la orden.
   * @returns Observable con la respuesta de creación.
   */
  createOrder(data: any): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/orders`;
    return this.http.post(URL, data, { headers }).pipe(
      map((response: any) => ({
        order: response.data || response,
        message: response.message || 'Orden creada exitosamente'
      })),
      catchError(this.handleError('Error al crear orden de pedido')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Actualiza una orden de pedido.
   * @param orderId ID de la orden.
   * @param data Datos de la orden.
   * @returns Observable con la respuesta de actualización.
   */
  update(orderId: number, data: any): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/orders/${orderId}`;
    return this.http.put(URL, data, { headers }).pipe(
      map((response: any) => ({
        order: response.data || response,
        message: response.message || 'Actualizada exitosamente',
        pdf_path: response.pdf_path || null
      })),
      catchError(this.handleError('Error al actualizar la orden')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Recibe productos de una orden.
   * @param orderId ID de la orden.
   * @param data Datos de los productos recibidos.
   * @returns Observable con la respuesta.
   */
  receiveProducts(orderId: number, data: any): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/orders/${orderId}/receive`;
    return this.http.put(URL, data, { headers }).pipe(
      map((response: any) => ({
        order: response.data || response,
        message: response.message || 'Productos recibidos exitosamente'
      })),
      catchError(this.handleError('Error al recibir productos')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

   /**
   * Asigna partidas a una orden.
   * @param orderId ID de la orden.
   * @param data Datos de las partidas.
   * @returns Observable con la respuesta.
   
  assignPartidas(orderId: number, data: any): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/orders/${orderId}/assign-partidas`;
    return this.http.post(URL, data, { headers }).pipe(
      map((response: any) => ({
        order: response.data || response,
        message: response.message || 'Partidas asignadas exitosamente'
      })),
      catchError(this.handleError('Error al asignar partidas')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }*/
  /**
   * Valida una orden en Área 2.
   * @param orderId ID de la orden.
   * @param data Datos de validación.
   * @returns Observable con la respuesta.
   */
  validateArea2(orderId: number, data: any): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/orders/${orderId}/validate-area2`;
    return this.http.post(URL, data, { headers }).pipe(
      map((response: any) => ({
        order: response.data || response,
        message: response.message || 'Suficiencia validada en Contabilidad exitosamente'
      })),
      catchError(this.handleError('Error al validar en Contabilidad')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Valida una orden en Área 1.
   * @param orderId ID de la orden.
   * @param data Datos de validación.
   * @returns Observable con la respuesta.
   */
  validateOrder(orderId: number, data: any): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/orders/${orderId}/validate`;
    return this.http.post(URL, data, { headers }).pipe(
      map((response: any) => ({
        order: response.data || response,
        message: response.message || 'Orden validada exitosamente',
        pdf_path: response.pdf_path || null
      })),
      catchError(this.handleError('Error al validar la orden')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

 

  /**
   * Obtiene la lista de facturas asociadas a una orden.
   * @param orderRequestId ID de la orden.
   * @returns Observable con la lista de facturas.
   */
  getInvoices(orderRequestId: number): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/invoices?order_request_id=${orderRequestId}`;
    return this.http.get(URL, { headers }).pipe(
      map((response: any) => ({
        invoices: response.data || response.invoices || [],
        meta: response.meta || {}
      })),
      catchError(this.handleError('Error al obtener facturas')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Crea una nueva factura.
   * @param formData Datos de la factura (FormData para archivos).
   * @returns Observable con la respuesta de creación.
   */
  createInvoice(formData: FormData): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/invoices`;
    return this.http.post(URL, formData, { headers }).pipe(
      map((response: any) => ({
        invoice: response.data || response,
        message: response.message || 'Factura creada exitosamente'
      })),
      catchError(this.handleError('Error al crear factura')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Elimina una factura.
   * @param id ID de la factura.
   * @returns Observable con la respuesta de eliminación.
   */
  deleteInvoice(id: number): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/invoices/${id}`;
    return this.http.delete(URL, { headers }).pipe(
      map((response: any) => ({
        message: response.message || 'Factura eliminada exitosamente'
      })),
      catchError(this.handleError('Error al eliminar factura')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Genera y guarda el PDF de una orden.
   * @param orderId ID de la orden.
   * @returns Observable con la respuesta.
   */
  saveOrderPdf(orderId: number): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/orders/${orderId}/save-pdf`;
    return this.http.post(URL, {}, { headers }).pipe(
      map((response: any) => ({
        pdf_path: response.pdf_path || null,
        message: response.message || 'PDF de orden generado exitosamente'
      })),
      catchError(this.handleError('Error al guardar el PDF de la orden')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Genera y guarda el PDF de una suficiencia presupuestal.
   * @param orderId ID de la orden.
   * @returns Observable con la respuesta.
   */
  saveSuficienciaPdf(orderId: number): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/orders/${orderId}/save-suficiencia-pdf`;
    return this.http.post(URL, {}, { headers }).pipe(
      map((response: any) => ({
        suficiencia_pdf_path: response.suficiencia_pdf_path || null,
        message: response.message || 'PDF de suficiencia generado exitosamente'
      })),
      catchError(this.handleError('Error al guardar el PDF de suficiencia')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Descarga el PDF de una orden o suficiencia.
   * @param orderId ID de la orden.
   * @returns Observable con el archivo Blob.
   */
  getOrderPdf(orderId: number): Observable<Blob> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/orders/${orderId}/pdf`;
    return this.http.get(URL, { headers, responseType: 'blob' }).pipe(
      map((response: Blob) => response),
      catchError(this.handleError('Error al obtener el PDF')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  /**
   * Envía el PDF de una orden o suficiencia al proveedor.
   * @param orderId ID de la orden.
   * @returns Observable con la respuesta.
   */
  sendOrderPdf(orderId: number): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/orders/${orderId}/send-pdf`;
    return this.http.post(URL, {}, { headers }).pipe(
      map((response: any) => ({
        message: response.message || 'PDF enviado exitosamente'
      })),
      catchError(this.handleError('Error al enviar el PDF')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  

    /**
   * Crea una notificación en el backend.
   * @param data Datos de la notificación (user_id, order_request_id, message).
   * @returns Observable con la respuesta.
   */
  createNotification(data: { user_id: number, order_request_id: number, message: string }): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/notifications`;
    return this.http.post(URL, data, { headers }).pipe(
      map((response: any) => ({
        notification: response.data || response,
        message: response.message || 'Notificación creada exitosamente'
      })),
      catchError(this.handleError('Error al crear notificación')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // Obtener notificaciones
  getNotifications(orderId: number | null): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/notifications?order_request_id=${orderId}`;
    return this.http.get(URL, { headers }).pipe(
      map((response: any) => ({
        notifications: response.data || response,
        message: response.message || 'Notificaciones cargadas'
      })),
      catchError(this.handleError('Error al cargar notificaciones')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  // Cerrar notificación
  dismissNotification(notificationId: number): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/notifications/${notificationId}/dismiss`;
    return this.http.put(URL, {}, { headers }).pipe(
      map((response: any) => ({
        notification: response.data || response,
        message: response.message || 'Notificación cerrada'
      })),
      catchError(this.handleError('Error al cerrar notificación')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

 
  // Método para marcar una notificación como leída
  markNotificationAsRead(notificationId: number): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/notifications/${notificationId}/read`;
    return this.http.patch(URL, {is_read: true}, { headers }).pipe(
      map((response: any) => ({
        message: response.message || 'Notificación cerrada exitosamente'
      })),
      catchError(this.handleError('Error al cerrar notificación')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  //servicios para fotos y documentos pdf

  appendInvoicePhotos(id: number, formData: FormData) {
  this.isLoadingSubject.next(true);
  const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
  const URL = `${URL_SERVICIOS}/invoices/${id}/photos`;
  return this.http.post(URL, formData, { headers }).pipe(
    map((res: any) => res.invoice || res.data || res),
    catchError(this.handleError('Error al agregar fotos')),
    finalize(() => this.isLoadingSubject.next(false))
  );
  }

  deleteInvoicePhoto(id: number, photoUrl: string) {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({
      'Authorization': 'Bearer ' + this.authService.token,
      'Content-Type': 'application/json'
    });
    const URL = `${URL_SERVICIOS}/invoices/${id}/photos`;
    return this.http.request('DELETE', URL, { headers, body: { path: photoUrl } }).pipe(
      map((res: any) => res.invoice || res.data || res),
      catchError(this.handleError('Error al eliminar foto')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  deleteInvoiceFile(id: number) {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/invoices/${id}/file`;
    return this.http.delete(URL, { headers }).pipe(
      map((res: any) => res.invoice || res.data || res),
      catchError(this.handleError('Error al eliminar documento')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  replaceInvoiceFile(id: number, formData: FormData) {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/invoices/${id}/replace-file`;
    return this.http.post(URL, formData, { headers }).pipe(
      map((res: any) => res.invoice || res.data || res),
      catchError(this.handleError('Error al reemplazar documento')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }


  /**
 * Elimina una orden o suficiencia presupuestal.
 * @param id ID de la orden o suficiencia.
 * @returns Observable con la respuesta de eliminación.
 */
deleteOrder(id: number): Observable<any> {
  this.isLoadingSubject.next(true);
  const headers = new HttpHeaders({
    'Authorization': 'Bearer ' + this.authService.token
  });
  const URL = `${URL_SERVICIOS}/orders/${id}`;

  return this.http.delete(URL, { headers }).pipe(
    map((response: any) => ({
      message: response.message || 'Orden eliminada exitosamente.'
    })),
    catchError(this.handleError('Error al eliminar la orden')),
    finalize(() => this.isLoadingSubject.next(false))
  );
}

private fieldLabels: { [key: string]: string } = {
  requester_area_id: 'Área solicitante',
  requester_subarea_id: 'Subárea solicitante',
  provider_id: 'Proveedor',
  foliosf: 'Folio de suficiencia',
  oficio: 'Número de oficio',
  delivery_place: 'Lugar de entrega',
  products: 'Productos',
  'products.*.quantity': 'Cantidad del producto',
  'products.*.unit_price': 'Precio unitario',
  date:  'fecha inicial',
  date_limited:  'fecha limite',
  format_type: 'tipo',
  process:  'proceso',
  cilindros: 'cilindro',
  grupo:  'grupo',
  subgrupo: 'subgrupo',
  no_beneficiarios: 'beneficiarios',
  oficio_origen:  'oficio origen',
  subsidio_estatal: 'subsidio estatal',
  ingresos_propios: 'ingresos propios',
  federal:  'federal',
  mixto: 'mixto',
  ur: 'ur', 
  order_number: 'numero de orden de pedido',
  'products.*.progresivo': 'numero progresivo',
  'products.*.ur_progressive': 'ur progresivo',
  'products.*.unit_id':  'unidad',
  'products.*.description':  'description',
  'products.*.bran': 'marca',
  'products.*.grupo': 'grupo', 
  'products.*.partida':  'partida',
  'products.*.received_quantity':  'cantidad recibida'

  // 👉 agrega aquí todos los campos que quieras traducir
};

/**
 * ✅ Crea un nuevo producto de forma rápida (flujo de Suficiencia Presupuestal).
 * Este endpoint no requiere campos automotrices ni relaciones avanzadas.
 * Se utiliza únicamente en el modal rápido de Área 1.
 * @param productData Datos mínimos del producto.
 * @returns Observable con la respuesta de creación rápida.
 */
createQuickProduct(productData: any): Observable<any> {
  this.isLoadingSubject.next(true);

  const headers = new HttpHeaders({
    'Authorization': 'Bearer ' + this.authService.token,
    'Content-Type': 'application/json'
  });

  const URL = `${URL_SERVICIOS}/products/quick`;

  return this.http.post(URL, productData, { headers }).pipe(
    map((response: any) => ({
      product: response.data || response.product || response,
      message: response.message || 'Producto creado rápidamente'
    })),
    catchError(this.handleError('Error al crear producto rápido')),
    finalize(() => this.isLoadingSubject.next(false))
  );
}

/** Lista órdenes con filtros pensados para Área 3 (status_in, q, etc.) */
/*
listOrders(params: {
  page?: number;
  per_page?: number;
  status_in?: string[];
  q?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
}) {
  this.isLoadingSubject.next(true);

  const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });

  let httpParams = new HttpParams()
    .set('page', String(params.page ?? 1))
    .set('per_page', String(params.per_page ?? 10));

  if (params.q) httpParams = httpParams.set('q', params.q);
  if (params.sort) httpParams = httpParams.set('sort', params.sort);
  if (params.direction) httpParams = httpParams.set('direction', params.direction);

  // Enviar múltiples estados como status_in[]
  if (params.status_in && params.status_in.length) {
    params.status_in.forEach(s => {
      httpParams = httpParams.append('status_in[]', s);
    });
  }

  const URL = `${URL_SERVICIOS}/orders`;

  return this.http.get(URL, { headers, params: httpParams }).pipe(
    
    map((res: any) => {
      const data = res?.data ?? res?.orders ?? [];
      const total = Number(res?.total ?? res?.meta?.total ?? data.length ?? 0);
      const meta = res?.meta ?? {
        total,
        per_page: params.per_page ?? 10,
        current_page: params.page ?? 1
      };
      return { data, total, meta };
    }),
    catchError(this.handleError('Error al listar órdenes para almacén')),
    finalize(() => this.isLoadingSubject.next(false))
  );
}
*/
listOrders(params: {
  page?: number;
  per_page?: number;
  status_in?: string[];
  q?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
}) {
  this.isLoadingSubject.next(true);

  const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });

  let httpParams = new HttpParams()
    .set('page', String(params.page ?? 1))
    .set('per_page', String(params.per_page ?? 10));

  if (params.q) httpParams = httpParams.set('query', params.q);
  if (params.sort) httpParams = httpParams.set('sort', params.sort);
  if (params.direction) httpParams = httpParams.set('direction', params.direction);

  /** ⚠️ Cambio importante:
   *  Tu backend NO soporta status_in[], así que enviamos uno por uno
   */

  if (params.status_in && params.status_in.length === 1) {
    httpParams = httpParams.set('status', params.status_in[0]);
  } else if (params.status_in && params.status_in.length > 1) {
    // enviamos una cadena "pending_warehouse,partially_received"
    httpParams = httpParams.set('status', params.status_in.join(','));
  }

  const URL = `${URL_SERVICIOS}/orders`;

  return this.http.get(URL, { headers, params: httpParams }).pipe(
    map((res: any) => {
      const data = res?.data ?? res?.orders ?? [];
      const total = Number(res?.total ?? res?.meta?.total ?? data.length ?? 0);

      return { data, total };
    }),
    catchError(err => {
      console.error('❌ ERROR REAL:', err);
      return of({ data: [], total: 0 });
    }),
    finalize(() => this.isLoadingSubject.next(false))
  );
}


/**
   * Maneja errores de las peticiones HTTP.
   * @param message Mensaje base de error.
   * @returns Función que transforma el error en un Observable.
   */
  
  private handleError(message: string) {
    return (error: HttpErrorResponse): Observable<never> => {
      let errorMessage = message;

      if (error.error && error.error.message) {
        errorMessage = error.error.message;
      } else if (error.status === 401) {
        errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
      } else if (error.status === 422 && error.error.errors) {
        errorMessage = Object.values(error.error.errors).flat().join(', ');
      } else if (error.status === 422 && error.error.errors) {
          const translatedErrors = Object.entries(error.error.errors).map(([field, messages]) => {
          const label = this.fieldLabels[field] || field; // Busca traducción o usa el original
          return `${label}: ${(messages as string[]).join(', ')}`;
        });
        errorMessage = translatedErrors.join('\n');
      } else if (error.status >= 500) {
        errorMessage = `${message}: Error interno del servidor`;
      } else {
        errorMessage = `${message}: ${error.message}`;
      }
      
            if (error.status === 401) {
        errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
        this.authService.logout();
        Swal.fire('Sesión Expirada', errorMessage, 'warning').then(() => {
          this.router.navigate(['/login']);
        });
      }
      console.error('⚠️ Error detectado:', errorMessage, error);

      // 🚨 Manejo de redirección automática
      if (error.error && error.error.redirect) {
        // Si el backend lo pide explícitamente
        this.router.navigate(['/ordenpedido/oplist']);
      } else if (error.status >= 500) {
        // Si es un error 500, también redirigimos por seguridad
        this.router.navigate(['/ordenpedido/oplist']);
      }

      return throwError(() => new Error(errorMessage));
    };
  }
}