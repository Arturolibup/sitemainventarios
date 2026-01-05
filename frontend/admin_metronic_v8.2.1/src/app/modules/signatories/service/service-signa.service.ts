import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, finalize, catchError, throwError } from 'rxjs';
import { URL_SERVICIOS } from 'src/app/config/config';
import { AuthService } from '../../auth';

@Injectable({
  providedIn: 'root'
})
export class ServiceSignaService {

  

isLoading$: Observable<boolean>;
  isLoadingSubject: BehaviorSubject<boolean>;
    
    constructor(
      private http: HttpClient, //hacer las peticiones http a nuestra api
      public authservice: AuthService, // lo trabajamos para autitenticacion, para las peticiones a realizar
    ) {
      this.isLoadingSubject = new BehaviorSubject<boolean>(false);
      this.isLoading$ = this.isLoadingSubject.asObservable();
    }

    createSignatory(data:any) {
      this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
      let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
      let URL = URL_SERVICIOS+"/signa";
      return this.http.post(URL, data, {headers:headers}).pipe(
        finalize(() => this.isLoadingSubject.next(false))
      );
    }
  
    listSigna(page:number = 1, search:string = ''){
      this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
      let headers = new HttpHeaders ({'Authorization':'Bearer ' + this.authservice.token});
      let URL = URL_SERVICIOS+"/signa?page="+page+"&search="+search;
      return this.http.get(URL, {headers:headers}).pipe(
        finalize(() => this.isLoadingSubject.next(false))
      );
    } 

    configAll(){
      this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
      let headers = new HttpHeaders ({'Authorization':'Bearer ' + this.authservice.token});
      let URL = URL_SERVICIOS+"/signa/config";
      return this.http.get(URL, {headers:headers}).pipe(
        finalize(() => this.isLoadingSubject.next(false))
      );
    } 

    editSignatory(id_signa: string, data:any) {
      this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
      let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
      let URL = URL_SERVICIOS+"/signa/"+id_signa;
      return this.http.post(URL, data, {headers:headers}).pipe(
        finalize(() => this.isLoadingSubject.next(false))
      );
    }
  /*
    deleteSignatory(id_signa:string){
      this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
      let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
      let URL = URL_SERVICIOS+"/signa/"+id_signa;
      return this.http.delete(URL, {headers:headers}).pipe(
        finalize(() => this.isLoadingSubject.next(false))
      );
    }
*/
    deleteSignatory(id_signa: string) {
    this.isLoadingSubject.next(true);
    let headers = new HttpHeaders({
      'Authorization': 'Bearer ' + this.authservice.token,
      'Content-Type': 'application/json'
    });
    
    let URL = URL_SERVICIOS + "/signa/" + id_signa;
    
    return this.http.delete(URL, { headers: headers }).pipe(
      catchError(error => {
        // Manejo específico del error 422 (firmante en uso)
        if (error.status === 422) {
          // Transformar el error para manejo especial en el componente
          return throwError(() => ({
            ...error,
            isUsageError: true,
            suggestion: error.error?.suggestion,
            usageDetails: error.error?.usage_details
          }));
        }
        return throwError(() => error);
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }
  
  // NUEVO MÉTODO: Desactivar firmante
  deactivateSignatory(id_signa: string) {
    this.isLoadingSubject.next(true);
    let headers = new HttpHeaders({
      'Authorization': 'Bearer ' + this.authservice.token,
      'Content-Type': 'application/json'
    });
    
    let URL = URL_SERVICIOS + "/signa/" + id_signa + "/deactivate";
    
    return this.http.post(URL, {}, { headers: headers }).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }
}

