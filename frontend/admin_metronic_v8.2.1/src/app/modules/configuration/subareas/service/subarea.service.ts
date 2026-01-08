import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, finalize, map } from 'rxjs';
import { URL_SERVICIOS } from 'src/app/config/config';
import { AuthService } from 'src/app/modules/auth';

@Injectable({
  providedIn: 'root'
})
export class SubareaService {
  isLoading$: Observable<boolean>;
  isLoadingSubject: BehaviorSubject<boolean>;
  
  constructor(
    private http: HttpClient,
    public authservice: AuthService,
  ) {
    this.isLoadingSubject = new BehaviorSubject<boolean>(false);
    this.isLoading$ = this.isLoadingSubject.asObservable();
  }
    //http://127.0.0.1:8000/api    solo considera esta api por lo que necesito concatener 
    //registerRole(data: any): Observable<any>

  registerSubarea(data:any): Observable<any>{
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/subareas";
    return this.http.post(URL, data, {headers:headers}).pipe(
      map((res: any) => res?.data ?? res),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  listSubareas(page:number = 1, search:string = ''): Observable <any>{
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' :'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/subareas?page="+page+"&search="+search;
    return this.http.get(URL, {headers:headers}).pipe(
      map((res: any) => res?.data ?? res),
      finalize(() => this.isLoadingSubject.next(false))
    );
  } 
  updateSubarea(ID_SUBAREA: string, data:any): Observable<any> {
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/subareas/"+ID_SUBAREA;
    return this.http.put(URL, data, {headers:headers}).pipe(
      map((res: any) => res?.data ?? res),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  deleteSubarea(ID_SUBAREA:string): Observable<any>{
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/subareas/"+ID_SUBAREA;
    return this.http.delete(URL, {headers:headers}).pipe(
      map((res: any) => res?.data ?? res),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }
  //agregar la api para buscar los municipios.
  
  getMunicipios(): Observable<any> {
    this.isLoadingSubject.next(true); // Indica que la carga ha comenzado
    let headers = new HttpHeaders({'Authorization' : 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS + "/subareas/municipios";
    return this.http.get(URL, { headers: headers }).pipe(
      map((res: any) => res?.data ?? res),
        finalize(() => this.isLoadingSubject.next(false)) // Indica que la carga ha terminado
    );
  }

  /**
   * Validar la unicidad de un campo (por ejemplo, name)
   * @param field Campo a validar (por ejemplo, 'name')
   * @param value Valor a verificar
   * @returns Observable con la respuesta del servidor ({ exists: boolean })
   */
  validateUniqueness(field: string, value: string): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authservice.token });
    const URL = `${URL_SERVICIOS}/subareas/validate-unique?field=${field}&value=${encodeURIComponent(value)}`;
    return this.http.get(URL, { headers }).pipe(
      map((res: any) => res?.data ?? res),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  //eliminar busqueda de subarea
  searchSubar(search: string): Observable<any> {
    this.isLoadingSubject.next(true);
    const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authservice.token });
    const URL = `${URL_SERVICIOS}/subareas/search?term=${encodeURIComponent(search)}`;
    return this.http.get(URL, { headers }).pipe(
      map((res: any) => res?.data ?? res),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

}
