import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, finalize, catchError, throwError, tap, map } from 'rxjs';
import { AuthService } from '../../auth';
import { URL_SERVICIOS } from 'src/app/config/config';

 export interface SearchProduct {
    product_id: number;
    title: string;
    sku: string;
    stock: number;
    stock_global: number;
    invoice_number: string;
    entry_id: number;
    unit:string;
    }

    export interface InvoiceSearchResponse {
        invoices: string[];
    }

    export interface ProductByInvoiceResponse {
        products: SearchProduct[];
    }

    interface Area {
        id: number;
        name: string;
    }

    interface Subarea {
        id: number;
        name: string;
        area: Area;
    }

    interface SubareaResponse {
        subareas: Subarea[];
    }

@Injectable({
    providedIn: 'root'
})
export class ProductsService {
    isLoading$: Observable<boolean>;
    isLoadingSubject: BehaviorSubject<boolean>;

    constructor(
        private http: HttpClient,
        public authService: AuthService
    ) {
        this.isLoadingSubject = new BehaviorSubject<boolean>(false);
        this.isLoading$ = this.isLoadingSubject.asObservable();
    }

    /**
     * Obtiene el usuario autenticado actual para auditoría.
     * Propósito: Permite registrar quién realiza acciones (e.g., crear una entrada) en el sistema,
     * almacenando el ID del usuario en campos como `created_by`. Esto es esencial para rastrear
     * cambios y cumplir con requisitos de auditoría.
     * @returns Observable con los datos del usuario (e.g., id, nombre).
     */
    getUser(): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/auth/me`;
        return this.http.post(URL, {}, { headers }).pipe(
            catchError(this.handleError('Error al obtener usuario')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Obtiene datos iniciales para crear una entrada de producto (proveedores y productos disponibles).
     * Propósito: Proporciona la lista inicial de proveedores y productos que el usuario puede seleccionar
     * al crear una entrada, asegurando que el formulario esté poblado con opciones válidas desde el inicio.
     * @returns Observable con { providers, products }.
     */
    getInitialData(): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/create`;
        return this.http.get(URL, { headers }).pipe(
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Busca proveedores basados en una consulta de texto.
     * Propósito: Permite al usuario filtrar proveedores en tiempo real mientras escribe en el campo de búsqueda,
     * facilitando la selección de un proveedor para la entrada.
     * @param query Término de búsqueda ingresado por el usuario.
     * @returns Observable con la lista de proveedores filtrados.
     */
    searchProviders(query: string): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/search-providers?query=${encodeURIComponent(query)}`;
        return this.http.get(URL, { headers }).pipe(
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Busca productos basados en una consulta de texto para entradas.
     * Propósito: Permite al usuario buscar productos disponibles para agregar a una entrada,
     * mostrando opciones con stock actualizado para evitar selecciones inválidas.
     * @param query Término de búsqueda ingresado por el usuario.
     * @returns Observable con la lista de productos filtrados.
     */
    searchProducts(query: string): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/search-products?query=${encodeURIComponent(query)}`;
        return this.http.get(URL, { headers }).pipe(
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Guarda los datos generales de una entrada de producto.
     * Propósito: Envía la información inicial (proveedor, factura, etc.) al backend para crear una entrada,
     * devolviendo un `entry_id` que se usa en pasos posteriores (productos, evidencias).
     * @param data Objeto con datos generales (e.g., provider_id, invoice_number).
     * @returns Observable con la respuesta del servidor (incluye entry_id).
     */
    saveGeneral(data: any): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/general`;
        return this.http.post(URL, data, { headers }).pipe(
            catchError(this.handleError('Error al guardar datos generales')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Guarda los productos asociados a una entrada específica.
     * Propósito: Registra los productos seleccionados en la entrada (con cantidad, precio, etc.),
     * actualizando el stock y vinculándolos a la entrada para rastreo futuro en salidas.
     * @param entryId ID de la entrada creada.
     * @param data Objeto con la lista de productos.
     * @returns Observable con la respuesta del servidor.
     */
    saveProducts(entryId: number, data: any): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/${entryId}/products`;
        return this.http.post(URL, data, { headers }).pipe(
            catchError(this.handleError('Error al guardar productos')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Guarda las evidencias (archivos) de una entrada específica.
     * Propósito: Permite subir archivos (PDFs, imágenes) como prueba de la entrada, almacenándolos
     * en el backend y asociándolos al `entryId` para auditoría y documentación.
     * @param entryId ID de la entrada.
     * @param formData Datos del formulario con archivos.
     * @returns Observable con la respuesta del servidor.
     */
    saveEvidences(entryId: number, formData: FormData): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/${entryId}/evidences`;
        return this.http.post(URL, formData, { headers }).pipe(
            catchError(this.handleError('Error al guardar evidencias')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Obtiene los detalles de una entrada específica por su ID.
     * Propósito: Recupera toda la información de una entrada (datos generales, productos, evidencias)
     * para edición o visualización, útil para auditorías y estadísticas.
     * @param entryId ID de la entrada.
     * @returns Observable con los detalles de la entrada.
     */
    getEntryById(entryId: number): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/${entryId}`;
        return this.http.get(URL, { headers }).pipe(
            catchError(this.handleError('Error al obtener la entrada')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Actualiza los productos de una entrada existente.
     * Propósito: Permite modificar la lista de productos de una entrada ya creada, ajustando el stock
     * y manteniendo el historial para auditoría.
     * @param entryId ID de la entrada.
     * @param data Objeto con la nueva lista de productos.
     * @returns Observable con la respuesta del servidor.
     */
    updateProducts(entryId: number, data: any): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/${entryId}/products`;
        return this.http.put(URL, data, { headers }).pipe(
            catchError(this.handleError('Error al actualizar productos')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Actualiza las evidencias de una entrada existente.
     * Propósito: Permite reemplazar o añadir evidencias a una entrada, útil para corregir o completar
     * documentación asociada.
     * @param entryId ID de la entrada.
     * @param formData Datos del formulario con nuevos archivos.
     * @returns Observable con la respuesta del servidor.
     */
    updateEvidences(entryId: number, formData: FormData): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/${entryId}/evidences`;
        return this.http.post(URL, formData, { headers }).pipe(
            catchError(this.handleError('Error al actualizar evidencias')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Elimina una evidencia específica de una entrada.
     * Propósito: Permite borrar un archivo de evidencia individual, manteniendo un historial limpio
     * y actualizado para auditoría.
     * @param evidenceId ID de la evidencia a eliminar.
     * @returns Observable con la respuesta del servidor.
     */
    deleteEvidence(evidenceId: number): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/evidence/${evidenceId}`;
        return this.http.delete(URL, { headers }).pipe(
            catchError(this.handleError('Error al eliminar evidencia')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Lista todas las entradas con filtros opcionales.
     * Propósito: Recupera una lista paginada de entradas, con filtros como fechas o estado, útil para
     * estadísticas y reportes avanzados (e.g., rotación, bajo stock).
     * @param filters Objeto con filtros (e.g., invoice_number, process, date_from).
     * @returns Observable con la lista de entradas y metadatos (total, página).
     */
    getEntries(filters: any = {}): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries`;
        return this.http.get(URL, { headers, params: filters }).pipe(
            catchError(this.handleError('Error al obtener entradas')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Elimina una entrada específica por su ID.
     * Propósito: Borra una entrada y sus datos asociados (productos, evidencias) del sistema,
     * usado al cancelar una operación incompleta o corregir errores.
     * @param entryId ID de la entrada a eliminar.
     * @returns Observable con la respuesta del servidor.
     */
    deleteEntry(entryId: number): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/${entryId}`;
        return this.http.delete(URL, { headers }).pipe(
            catchError(this.handleError('Error al eliminar entrada')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Actualiza los datos generales de una entrada existente.
     * Propósito: Permite modificar información básica de una entrada (e.g., factura, proveedor),
     * manteniendo un historial para auditoría.
     * @param entryId ID de la entrada.
     * @param data Objeto con los datos actualizados.
     * @returns Observable con la respuesta del servidor.
     */
    updateEntry(entryId: number, data: any): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/${entryId}`;
        console.log('Enviando solicitud updateEntry:', { entryId, data });
        return this.http.put(URL, data, { headers }).pipe(
            tap (response=> console.log ('updateEntry response: ', response)),
            catchError(this.handleError('Error al actualizar entrada')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Obtiene el archivo de una evidencia específica por su ID.
     * Propósito: Descarga un archivo de evidencia (PDF o imagen) para visualización,
     * útil para verificar documentación en auditorías.
     * @param evidenceId ID de la evidencia.
     * @returns Observable con el archivo como Blob.
     */
    getEvidenceFile(evidenceId: number): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/evidence/${evidenceId}`;
        return this.http.get(URL, { headers, responseType: 'blob' }).pipe(
            catchError(this.handleError('Error al obtener archivo de evidencia')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Busca facturas por número para verificar duplicados o listar.
     * Propósito: Permite comprobar si una factura ya existe antes de guardar una entrada,
     * y sirve para estadísticas relacionadas con facturas.
     * @param query Número de factura a buscar.
     * @returns Observable con la lista de facturas coincidentes.
     */
    searchInvoice(query: string): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/search-invoices?query=${encodeURIComponent(query)}`;
        return this.http.get(URL, { headers }).pipe(
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    searchInvoices(query: string): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/product-exits/search-invoices?query=${encodeURIComponent(query)}`;
    console.log('Enviando solicitud a:', URL);
    return this.http.get(URL, { headers }).pipe(
        tap(response => console.log('Respuesta de searchInvoices:', response)),
        finalize(() => this.isLoadingSubject.next(false))
    );
}

    /**
     * Busca órdenes de pedido por número para verificar duplicados.
     * Propósito: Similar a `searchInvoices`, asegura que no se dupliquen órdenes de pedido,
     * apoyando la integridad de datos en el sistema.
     * @param query Número de orden a buscar.
     * @returns Observable con la lista de órdenes coincidentes.
     */
    searchOrders(query: string): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/search-orders?query=${encodeURIComponent(query)}`;
        return this.http.get(URL, { headers }).pipe(
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Guarda documentos oficiales asociados a una entrada.
     * Propósito: Permite subir documentos (e.g., facturas escaneadas) como parte de la entrada,
     * integrándolos para auditoría y referencia en salidas.
     * @param entryId ID de la entrada.
     * @param formData Datos del formulario con archivos.
     * @returns Observable con la respuesta del servidor.
     */
    savePurchaseDocuments(entryId: number, formData: FormData): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/${entryId}/purchase-documents`;
        return this.http.post(URL, formData, { headers }).pipe(
            catchError(this.handleError('Error al guardar documentos oficiales')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Lista los documentos oficiales de una entrada.
     * Propósito: Recupera la lista de documentos asociados a una entrada para visualización o edición,
     * útil para verificar documentación en auditorías.
     * @param entryId ID de la entrada.
     * @returns Observable con la lista de documentos.
     */
    listPurchaseDocuments(entryId: number): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/${entryId}/purchase-documents`;
        return this.http.get(URL, { headers }).pipe(
            map((response: any) => response.data || []),
            catchError(this.handleError('Error al listar documentos oficiales')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Obtiene los detalles de un documento oficial por su ID.
     * Propósito: Recupera metadatos de un documento (e.g., nombre, tipo) para edición o visualización,
     * apoyando la gestión de documentación.
     * @param documentId ID del documento.
     * @returns Observable con los detalles del documento.
     */
    getPurchaseDocument(documentId: number): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/purchase-document-details/${documentId}`;
        return this.http.get(URL, { headers }).pipe(
            catchError(this.handleError('Error al obtener documento oficial')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    getPurchaseDocuments(entryId: number): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/product_entries/${entryId}/purchase-documents`;
    return this.http.get(URL, { headers }).pipe(
        catchError(this.handleError('Error al obtener documentos')),
        finalize(() => this.isLoadingSubject.next(false))
    );
}

    /**
     * Actualiza un documento oficial existente.
     * Propósito: Permite reemplazar un documento oficial (e.g., corregir un archivo subido),
     * manteniendo un historial actualizado.
     * @param documentId ID del documento.
     * @param formData Datos del formulario con el nuevo archivo.
     * @returns Observable con la respuesta del servidor.
     */
    updatePurchaseDocument(documentId: number, formData: FormData): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/purchase-document/${documentId}`;
        return this.http.post(URL, formData, { headers }).pipe(
            catchError(this.handleError('Error al actualizar documento oficial')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Elimina un documento oficial por su ID.
     * Propósito: Borra un documento específico de una entrada, útil para corregir subidas erróneas
     * o mantener la documentación actualizada.
     * @param documentId ID del documento.
     * @returns Observable con la respuesta del servidor.
     */
    deletePurchaseDocument(documentId: number): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/purchase-document/${documentId}`;
        return this.http.delete(URL, { headers }).pipe(
            catchError(this.handleError('Error al eliminar documento oficial')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Obtiene el archivo de un documento oficial por su ID.
     * Propósito: Descarga el archivo (PDF o imagen) de un documento oficial para visualización,
     * apoyando la verificación de documentación.
     * @param documentId ID del documento.
     * @returns Observable con el archivo como Blob.
     */
    getPurchaseDocumentFile(documentId: number): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/purchase-document/${documentId}`;
        return this.http.get(URL, { headers, responseType: 'blob' }).pipe(
            catchError(this.handleError('Error al obtener archivo de documento oficial')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }


    /**
     * Genera y obtiene el PDF de una entrada específica.
     * Propósito: Crea un documento PDF con los detalles de la entrada (factura, productos, etc.)
     * y lo devuelve para descarga o almacenamiento automático, esencial para documentación oficial
     * y auditorías.
     * @param entryId ID de la entrada.
     * @returns Observable con el PDF como Blob.
     */
    generateEntryPdf(entryId: number): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product_entries/${entryId}/pdf`;
        return this.http.get(URL, { headers, responseType: 'blob' }).pipe(
            catchError(this.handleError('Error al generar PDF de entrada')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Lista todas las salidas con filtros opcionales.
     * Propósito: Recupera una lista de salidas (vales) para seguimiento y estadísticas,
     * como demanda por área/subárea o productos más usados.
     * @param filters Objeto con filtros (e.g., area_id, date).
     * @returns Observable con la lista de salidas.
     */
    getExits(filters: any = {}): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product-exits`;
        return this.http.get(URL, { headers, params: filters }).pipe(
            catchError(this.handleError('Error al obtener las salidas')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Obtiene datos iniciales para crear una salida.
     * Propósito: Proporciona áreas, subáreas y productos disponibles para crear un vale de salida,
     * asegurando opciones válidas desde el inicio.
     * @returns Observable con datos iniciales para salidas.
     */
    getExitCreateData(): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product-exits/create`;
        return this.http.get(URL, { headers }).pipe(
            catchError(this.handleError('Error al obtener datos para crear salida')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Crea los datos generales de una salida (primera parte).
     * Propósito: Registra información básica de la salida (área, subárea, referencia) en un flujo
     * de dos partes, devolviendo un ID para asociar productos después.
     * @param data Objeto con datos generales de la salida.
     * @returns Observable con la respuesta del servidor (incluye exit_id).
     */
    createExitGeneral(data: any): Observable<any> {
        this.validateExitData(data);
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product-exits/store-general`;
        return this.http.post(URL, data, { headers }).pipe(
            catchError(this.handleError('Error al crear datos generales de salida')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Crea los productos de una salida (segunda parte).
     * Propósito: Asocia productos a una salida creada con `createExitGeneral`, actualizando el stock
     * y vinculándolos para rastreo granular.
     * @param data Objeto con la lista de productos y exit_id.
     * @returns Observable con la respuesta del servidor.
     */
    createExitProducts(data: any): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product-exits/store-products`;
        return this.http.post(URL, data, { headers }).pipe(
            catchError(this.handleError('Error al crear productos de salida')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Crea una salida completa en un solo paso.
     * Propósito: Alternativa a `createExitGeneral` y `createExitProducts`, permite registrar una salida
     * (datos generales y productos) en una sola petición para flujos más simples.
     * @param data Objeto con datos completos de la salida.
     * @returns Observable con la respuesta del servidor.
     */
    createExit(data: any): Observable<any> {
        this.validateExitData(data);
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product-exits`;
        return this.http.post(URL, {
            ...data,
            exit_status: data.exit_status || 'completed',
            pending_expires_at: data.exit_status === 'pending' ? data.pending_expires_at : null
        }, { headers }).pipe(
            catchError(error => {
                console.error('Error al crear salida:', error);
                const errorMessage = error.status === 422 && error.error.errors
                    ? error.error.errors.join(' ')
                    : 'Ocurrió un error inesperado al crear la salida';
                return throwError(() => new Error(errorMessage));
            }),
        
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    // recupera multiples facturas para crear las salidas de un solo producto
    getProductEntries(productId: number): Observable<{ entries: { entry_id: number; invoice_number: string; available: number; created_at: string }[] }> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
    const URL = `${URL_SERVICIOS}/product-exits/product-entries/${productId}`;
    return this.http.get<{ entries: { entry_id: number; invoice_number: string; available: number; created_at: string }[] }>(URL, { headers }).pipe(
        catchError(this.handleError('Error al obtener entradas de producto')),
        finalize(() => this.isLoadingSubject.next(false))
    );
}

    /**
     * Obtiene los detalles de una salida específica por su ID.
     * Propósito: Recupera información de una salida (área, productos, etc.) para edición o visualización,
     * útil para auditorías y estadísticas. ['/product-entries/edit', entry.id]"
     * @param exitId ID de la salida.
     * @returns Observable con los detalles de la salida.
     */
    getExitById(exitId: number): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product-exits/${exitId}`;
        return this.http.get(URL, { headers }).pipe(
            catchError(this.handleError('Error al obtener salida')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Actualiza una salida existente.
     * Propósito: Permite modificar datos de una salida (e.g., área, productos), ajustando el stock
     * y manteniendo un historial para auditoría.
     * @param exitId ID de la salida.
     * @param data Objeto con los datos actualizados.
     * @returns Observable con la respuesta del servidor.
     */
    updateExit(exitId: number, data: any): Observable<any> {
        this.validateExitData(data);
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product-exits/${exitId}`;
        console.log('updateExit: Enviando solicitud PUT:', JSON.stringify(data, null, 2));
        return this.http.put(URL, data, { headers }).pipe(
            catchError(this.handleError('Error al actualizar salida')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Elimina una salida por su ID.
     * Propósito: Borra una salida y revierte los cambios en el stock, útil para corregir errores
     * o cancelar operaciones.
     * @param exitId ID de la salida.
     * @returns Observable con la respuesta del servidor.
     */
    deleteExit(exitId: number): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product-exits/${exitId}`;
        return this.http.delete(URL, { headers }).pipe(
            catchError(this.handleError('Error al eliminar salida')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Descarga el PDF de una salida específica.
     * Propósito: Genera y devuelve un PDF con los detalles de la salida (vale), que se almacena
     * automáticamente como documento oficial en la factura asociada para auditoría.
     * @param exitId ID de la salida.
     * @returns Observable con el PDF como Blob.
     */
    downloadExitPdf(exitId: number): Observable<Blob> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product-exits/${exitId}/pdf`;
        return this.http.get(URL, { headers, responseType: 'blob' }).pipe(
            catchError(this.handleError('Error al descargar PDF de salida', true)),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Busca productos disponibles para salidas.
     * Propósito: Filtra productos con stock disponible para crear vales de salida,
     * asegurando que solo se seleccionen productos existentes.
     * @param query Término de búsqueda ingresado por el usuario.
     * @returns Observable con la lista de productos filtrados.
     
    searchExitProduct(query: string): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product-exits/search-products?query=${encodeURIComponent(query)}`;
        return this.http.get(URL, { headers }).pipe(
            catchError(this.handleError('Error al buscar productos para salida')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }*/

    searchExitProducts(query: string): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product-exits/search-products?query=${encodeURIComponent(query)}`;
        return this.http.get(URL, { headers }).pipe(
            map((response: any) => {
                const products = response.products || [];
                const validProducts = products.filter((product: any) => {
                    const isValid = product.entry_id && Number.isInteger(product.entry_id) && product.product_id && product.stock > 0;
                    if (!isValid) {
                        console.warn('Producto inválido descartado:', product);
                    }
                    return isValid;
                });
                console.log('Productos recibidos de searchExitProducts:', validProducts);
                return { products: validProducts };
            }),
            catchError(this.handleError('Error al buscar productos para salida')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }
    /**
     * Busca áreas para asignar en salidas.
     * Propósito: Proporciona una lista de áreas disponibles para asignar productos en vales de salida,
     * apoyando el seguimiento granular por área.
     * @param query Término de búsqueda ingresado por el usuario.
     * @returns Observable con la lista de áreas filtradas.
     */
    searchAreas(query: string): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product-exits/search-areas?query=${encodeURIComponent(query)}`;
        return this.http.get(URL, { headers }).pipe(
            catchError(this.handleError('Error al buscar áreas')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Busca subáreas con su área relacionada para salidas.
     * Propósito: Filtra subáreas disponibles con su área padre, permitiendo una asignación precisa
     * en vales de salida y estadísticas de demanda por subárea.
     * @param query Término de búsqueda ingresado por el usuario.
     * @returns Observable con la lista de subáreas transformada.
     */
    searchSubareas(query: string): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product-exits/search-subareas?query=${encodeURIComponent(query)}`;
        return this.http.get<SubareaResponse>(URL, { headers }).pipe(
            map((response: SubareaResponse) => {
                return response.subareas.map(subarea => ({
                    id: subarea.id,
                    name: subarea.name,
                    area: {
                        id: subarea.area.id,
                        name: subarea.area.name
                    }
                }));
            }),
            catchError(this.handleError('Error al buscar subáreas')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    /**
     * Valida los datos de una salida antes de enviarla al servidor.
     * Propósito: Asegura que los datos de una salida cumplan con los requisitos mínimos (área, subárea,
     * productos válidos), evitando errores en el backend y mejorando la UX.
     * @param data Objeto con los datos de la salida.
     * @throws Error si los datos son inválidos.
     */
    private validateExitData(data: any): void {
        if (!data || typeof data !== 'object') throw new Error('Datos de salida inválidos');
        if (!data.area_id || !data.subarea_id || !data.reference || !data.exit_date) {
            throw new Error('Faltan campos obligatorios: área, subárea, referencia o fecha de salida');
        }
        if (!Array.isArray(data.products) || data.products.length === 0) {
            throw new Error('Debe incluir al menos un producto');
        }
        data.products.forEach((product: any, index: number) => {
            if (!product.product_id || !product.quantity || !product.warehouse) {
                throw new Error(`Producto ${index + 1}: faltan campos obligatorios (ID, cantidad o almacén)`);
            }
            if (product.quantity < 1) {
                throw new Error(`Producto ${index + 1}: la cantidad debe ser mayor a 0`);
            }
            if (data.invoice_mode === 'multiple_invoices' && (!product.usedEntries || !Array.isArray(product.usedEntries))) {
                throw new Error(`Producto ${index + 1}: faltan entradas utilizadas en modo multiple_invoices`);
            }
        });
    }

    /**
     * Maneja errores de las peticiones HTTP de manera centralizada.
     * Propósito: Proporciona mensajes de error personalizados según el tipo de respuesta (JSON, Blob),
     * facilitando la depuración y la presentación de errores al usuario (e.g., con SweetAlert2).
     * @param message Mensaje base del error.
     * @param isBlob Indica si la respuesta es un Blob (e.g., PDFs).
     * @returns Función que transforma el error en un Observable throwable.
     */
    private handleError(message: string, isBlob: boolean = false) {
        return (error: HttpErrorResponse): Observable<never> => {
            let errorMessage = message;
            if (error.error instanceof Blob && isBlob) {
                const reader = new FileReader();
                reader.onload = () => {
                    const text = reader.result as string;
                    try {
                        const jsonError = JSON.parse(text);
                        errorMessage = jsonError.message || message;
                    } catch {
                        errorMessage = message;
                    }
                };
                reader.readAsText(error.error);
            } else if (error.error && error.error.message) {
                errorMessage = error.error.message;
            } else if (error.status === 422 && error.error.errors) {
                errorMessage = error.error.errors[0];
            }
            console.error(`${message}:`, error);
            return throwError(() => new Error(errorMessage));
        };
    }

    completeExit(id: number): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product-exits/${id}/complete`;
        return this.http.post(URL, {}, { headers }).pipe(
            map((response: any) => response),
            catchError((error) => {
                console.error('Error al completar salida:', error);
                throw error;
            }),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    searchProductsByInvoice(invoiceNumber: string): Observable<ProductByInvoiceResponse> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product-exits/search-products-by-invoice?invoice_number=${encodeURIComponent(invoiceNumber)}`;
        console.log('Enviando solicitud a:', URL);
        return this.http.get<ProductByInvoiceResponse>(URL, { headers }).pipe(
            tap(response => console.log('Respuesta de searchProductsByInvoice:', response)),
            catchError(error => {
                console.error('Error en searchProductsByInvoice:', error);
                return this.handleError('Error al buscar productos por factura')(error);
            }),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }

    checkLowStock(productIds: number[]): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product-exits/check-low-stock`;
        return this.http.post(URL, { product_ids: productIds }, { headers }).pipe(
            catchError(this.handleError('Error al verificar stock bajo')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }
    checkLowStockalto(productIds: number[]): Observable<any> {
        this.isLoadingSubject.next(true);
        const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
        const URL = `${URL_SERVICIOS}/product-exits/check-low-stockalto`;
        return this.http.post(URL, { product_ids: productIds }, { headers }).pipe(
            catchError(this.handleError('Error al verificar stock bajo')),
            finalize(() => this.isLoadingSubject.next(false))
        );
    }
}

