import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, finalize, catchError, throwError, tap, map, distinctUntilChanged, debounceTime } from 'rxjs';
import { URL_SERVICIOS } from 'src/app/config/config';
import { AuthService } from 'src/app/modules/auth';
import { Marca, Subarea, Tipo, Vehicle } from 'src/app/models/interfaces';


@Injectable({
  providedIn: 'root'
})
export class CarsService {
    
  private isLoadingSubject = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoadingSubject.asObservable().pipe(
    distinctUntilChanged(),
    debounceTime(50)
  );

  constructor(
    private http: HttpClient,
    public authService: AuthService
  ) {
    
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({ 'Authorization': 'Bearer ' + this.authService.token });
  }

  private handleError(message: string) {
    return (error: HttpErrorResponse): Observable<never> => {
      let errorMessage = message;
      if (error.error instanceof ErrorEvent) {
        errorMessage = `Error del cliente: ${error.error.message}`;
      } else if (error.status === 422 && error.error.errors) {
        errorMessage = Object.values(error.error.errors).flat().join('\n');
      } else if (error.error.message) {
        errorMessage = error.error.message;
      }
      console.error(`${message}:`, error);
      return throwError(() => new Error(errorMessage));
    };
  }

  private unwrap<T>(res: any): T {
    return res?.data ?? res;
  }

  getSubareas(): Observable<{ subareas: Subarea[] }> {
    this.isLoadingSubject.next(true);
    const URL = `${URL_SERVICIOS}/cars/search-subareas?query=`;
    return this.http.get<{ subareas: Subarea[] }>(URL, { headers: this.getHeaders() }).pipe(
      map((resp: any) => this.unwrap<{ subareas: Subarea[] }>(resp)),
      tap(resp => console.log('Subáreas cargadas:', resp.subareas)),
      catchError(this.handleError('Error al cargar subáreas')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  getMarcas(): Observable<{ marcas: Marca[] }> {
    this.isLoadingSubject.next(true);
    const URL = `${URL_SERVICIOS}/cars/search-marcas?query=`;
    return this.http.get<{ marcas: Marca[] }>(URL, { headers: this.getHeaders() }).pipe(
      map((resp: any) => this.unwrap<{ marcas: Marca[] }>(resp)),
      tap(resp => console.log('Marcas cargadas:', resp.marcas)),
      catchError(this.handleError('Error al cargar marcas')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  
  createMarca(data: { nombre: string }): Observable<{ marca: Marca }> {
    this.isLoadingSubject.next(true);
    const URL = `${URL_SERVICIOS}/cars/marcas`;
    return this.http.post<{ marca: Marca }>(URL, data, { headers: this.getHeaders() }).pipe(
      map((resp: any) => this.unwrap<{ marca: Marca }>(resp)),
      tap(resp => console.log('Marca creada:', resp)),
      catchError(this.handleError('Error al crear marca')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }
  
  createTipo(data: { nombre: string, marca_id: number }): Observable<{ tipo: Tipo }> {
    this.isLoadingSubject.next(true);
    const URL = `${URL_SERVICIOS}/cars/tipos`;
    return this.http.post <{tipo: Tipo}>(URL, data, { headers: this.getHeaders() }).pipe(
      map((resp: any) => this.unwrap<{ tipo: Tipo }>(resp)),
      tap(resp => console.log('Tipo creado:', resp)),
      catchError(this.handleError('Error al crear tipo')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }
  
  getTiposByMarca(marcaId: number): Observable<{ tipos: Tipo[] }> {
    this.isLoadingSubject.next(true);
    const URL = `${URL_SERVICIOS}/cars/search-tipos?query=&marca_id=${marcaId}`;
    return this.http.get<{ tipos: Tipo[] }>(URL, { headers: this.getHeaders() }).pipe(
      map((resp: any) => this.unwrap<{ tipos: Tipo[] }>(resp)),
      tap(resp => console.log('Tipos cargados para marca:', marcaId, resp.tipos)),
      catchError(this.handleError('Error al cargar tipos')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  validateUniqueness(field: string, value: string, id?: number): Observable<{ exists: boolean }> {
    this.isLoadingSubject.next(true);
    let URL = `${URL_SERVICIOS}/cars/validate?field=${encodeURIComponent(field)}&value=${encodeURIComponent(value.toUpperCase())}`;
    if (id) URL += `&id=${id}`;
    return this.http.get<{ exists: boolean }>(URL, { headers: this.getHeaders() }).pipe(
      map((resp: any) => this.unwrap<{ exists: boolean }>(resp)),
      tap(resp => console.log('Validación de unicidad:', field, resp)),
      catchError(this.handleError('Error al validar unicidad')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  registerVehicle(data: FormData): Observable<{ vehicle: Vehicle; message?: string }> {
    this.isLoadingSubject.next(true);
    const URL = `${URL_SERVICIOS}/cars`;
    return this.http.post<{ vehicle: Vehicle; message?: string }>(URL, data, { headers: this.getHeaders() }).pipe(
      map((resp: any) => this.unwrap<{ vehicle: Vehicle; message?: string }>(resp)),
      tap(resp => console.log('Vehículo registrado:', resp)),
      catchError(this.handleError('Error al registrar vehículo')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  
  listVehicles(page: number = 1, search: string = '', perPage: number = 25): Observable<{
    vehicles: Vehicle[];
    total: number;
    meta: any;
  }> {
  this.isLoadingSubject.next(true);
  const URL = `${URL_SERVICIOS}/cars?page=${page}&search=${encodeURIComponent(search)}&per_page=${perPage}`;
  return this.http.get<{
    vehicles: Vehicle[];
    total: number;
    meta: any;
  }>(URL, { headers: this.getHeaders() }).pipe(
    map((resp: any) => {
      const unwrapped = this.unwrap<any>(resp);
      const meta = unwrapped?.meta ?? resp?.meta;
      const vehicles = unwrapped?.data ?? unwrapped?.vehicles ?? (Array.isArray(unwrapped) ? unwrapped : resp?.data);
      const total = meta?.total ?? unwrapped?.total ?? resp?.meta?.total;
      return {
        vehicles,
        total,
        meta
      };
    }),
    tap(resp => console.log('Lista de vehículos:', resp)),
    catchError(this.handleError('Error al listar vehículos')),
    finalize(() => this.isLoadingSubject.next(false))
  );
}

  

  getVehicle(id: number): Observable<{ vehicle: Vehicle }> {
    this.isLoadingSubject.next(true);
    const URL = `${URL_SERVICIOS}/cars/${id}`;
    return this.http.get<{ vehicle: Vehicle }>(URL, { headers: this.getHeaders() }).pipe(
      map((resp: any) => this.unwrap<{ vehicle: Vehicle }>(resp)),
      tap(resp => console.log('Vehículo obtenido:', id, resp)),
      catchError(this.handleError('Error al obtener vehículo')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  updateVehicle(id: number, data: FormData): Observable<{ vehicle: Vehicle; message?: string }> {
    this.isLoadingSubject.next(true);
    const URL = `${URL_SERVICIOS}/cars/${id}`;
    return this.http.post<{ vehicle: Vehicle; message?: string }>(URL, data, { headers: this.getHeaders() }).pipe(
      map((resp: any) => this.unwrap<{ vehicle: Vehicle; message?: string }>(resp)),
      tap(resp => console.log('Vehículo actualizado:', id, resp)),
      catchError(this.handleError('Error al actualizar vehículo')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  searchSubareas(query: string): Observable<Subarea[]> {
    this.isLoadingSubject.next(true);
    const URL = `${URL_SERVICIOS}/cars/search-subareas?query=${encodeURIComponent(query)}`;
    return this.http.get<{ subareas: Subarea[] }>(URL, { headers: this.getHeaders() }).pipe(
      map((resp: any) => this.unwrap<{ subareas: Subarea[] }>(resp).subareas),
      tap(subareas => console.log('Subáreas buscadas:', query, subareas)),
      catchError(this.handleError('Error al buscar subáreas')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  searchMarcas(query: string): Observable<Marca[]> {
    this.isLoadingSubject.next(true);
    const URL = `${URL_SERVICIOS}/cars/search-marcas?query=${encodeURIComponent(query)}`;
    return this.http.get<{ marcas: Marca[] }>(URL, { headers: this.getHeaders() }).pipe(
      map((resp: any) => this.unwrap<{ marcas: Marca[] }>(resp).marcas),
      tap(marcas => console.log('Marcas buscadas:', query, marcas)),
      catchError(this.handleError('Error al buscar marcas')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  searchTipos(query: string, marca_id?: number): Observable<Tipo[]> {
    this.isLoadingSubject.next(true);
    let URL = `${URL_SERVICIOS}/cars/search-tipos?query=${encodeURIComponent(query)}`;
    if (marca_id) URL += `&marca_id=${marca_id}`;
    return this.http.get<{ tipos: Tipo[] }>(URL, { headers: this.getHeaders() }).pipe(
      map((resp: any) => this.unwrap<{ tipos: Tipo[] }>(resp).tipos),
      tap(tipos => console.log('Tipos buscados:', query, tipos)),
      catchError(this.handleError('Error al buscar tipos')),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  deleteVehicle(id: number): Observable<{ message: string }> {
  this.isLoadingSubject.next(true);
  const URL = `${URL_SERVICIOS}/cars/${id}`;
  return this.http.delete<{ message: string }>(URL, { headers: this.getHeaders() }).pipe(
    map((resp: any) => this.unwrap<{ message: string }>(resp)),
    tap(resp => console.log('Vehículo eliminado:', id, resp)),
    catchError(this.handleError('Error al eliminar vehículo')),
    finalize(() => this.isLoadingSubject.next(false))
  );
}
}
