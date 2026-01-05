import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, finalize, catchError } from 'rxjs';
import { AuthService } from 'src/app/modules/auth';
import { URL_SERVICIOS } from 'src/app/config/config';

@Injectable({
  providedIn: 'root'
})
export class AreaService {
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

  registerArea(data:any) {
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/areas";
    return this.http.post(URL, data, {headers:headers}).pipe(
        
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  listAreas(page:number = 1, search:string = ''){
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' :'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/areas?page="+page+"&search="+search;
    return this.http.get(URL, {headers:headers}).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  } 
  updateArea(ID_AREA: string, data:any) {
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/areas/"+ID_AREA;
    return this.http.put(URL, data, {headers:headers}).pipe(
      
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  deleteArea(ID_AREA:string){
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/areas/"+ID_AREA;
    return this.http.delete(URL, {headers:headers}).pipe(
      catchError((error) => {
        console.error('Error al crear el área:', error);
        throw error;
    }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }
  //agregar la api para buscar los municipios.
  
  getMunicipios() {
    this.isLoadingSubject.next(true); // Indica que la carga ha comenzado
    let headers = new HttpHeaders({'Authorization' : 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS + "/areas/municipios";
    return this.http.get(URL, { headers: headers }).pipe(
      catchError((error) => {
        console.error('Error al crear el área:', error);
        throw error;
    }),
        finalize(() => this.isLoadingSubject.next(false)) // Indica que la carga ha terminado
    );
  }
  
}
