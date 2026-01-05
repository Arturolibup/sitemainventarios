import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, finalize } from 'rxjs';
import { URL_SERVICIOS } from 'src/app/config/config';
import { AuthService } from 'src/app/modules/auth';

@Injectable({
  providedIn: 'root'
})
export class ProvidersService {

  isLoading$: Observable<boolean>;
  isLoadingSubject: BehaviorSubject<boolean>;
  
  constructor(
    private http: HttpClient, //hacer las peticiones http a nuestra api
    public authservice: AuthService, // lo trabajamos para autitenticacion, para las peticiones a realizar
  ) {
    this.isLoadingSubject = new BehaviorSubject<boolean>(false);
    this.isLoading$ = this.isLoadingSubject.asObservable();
  }

  registerProvider(data:any) {
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/providers";
    return this.http.post(URL, data, {headers:headers}).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  listProviders(page:number = 1, search:string = ''){
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' :'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/providers?page="+page+"&search="+search;
    return this.http.get(URL, {headers:headers}).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  } 


  updateProvider(ID_USER: string, data:any) {
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/providers/"+ID_USER;
    return this.http.post(URL, data, {headers:headers}).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  deleteProvider(ID_USER:string){
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/providers/"+ID_USER;
    return this.http.delete(URL, {headers:headers}).pipe(
      finalize(() => this.isLoadingSubject.next(false))
    );
  }
}
