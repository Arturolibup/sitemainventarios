import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, finalize, map } from 'rxjs';
import { AuthService } from '../../auth';
import { URL_SERVICIOS } from 'src/app/config/config';

@Injectable({
  providedIn: 'root'
})
export class  UsersService {

  isLoading$: Observable<boolean>;
  isLoadingSubject: BehaviorSubject<boolean>;
    
    constructor(
      private http: HttpClient, //hacer las peticiones http a nuestra api
      public authservice: AuthService, // lo trabajamos para autitenticacion, para las peticiones a realizar
    ) {
      this.isLoadingSubject = new BehaviorSubject<boolean>(false);
      this.isLoading$ = this.isLoadingSubject.asObservable();
    }

    registerUser(data:any) {
      this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
      let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
      let URL = URL_SERVICIOS+"/users";
      return this.http.post(URL, data, {headers:headers}).pipe(
        map((res: any) => res?.data ?? res),
        finalize(() => this.isLoadingSubject.next(false))
      );
    }
  
    listUsers(page:number = 1, search:string = ''){
      this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
      let headers = new HttpHeaders ({'Authorization':'Bearer ' + this.authservice.token});
      let URL = URL_SERVICIOS+"/users?page="+page+"&search="+search;
      return this.http.get(URL, {headers:headers}).pipe(
        map((res: any) => res?.data ?? res),
        finalize(() => this.isLoadingSubject.next(false))
      );
    } 

    configAll(){
      this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
      let headers = new HttpHeaders ({'Authorization':'Bearer ' + this.authservice.token});
      let URL = URL_SERVICIOS+"/users/config";
      return this.http.get(URL, {headers:headers}).pipe(
        map((res: any) => res?.data ?? res),
        finalize(() => this.isLoadingSubject.next(false))
      );
    } 

    updateUser(ID_USER: string, data:any) {
      this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
      let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
      let URL = URL_SERVICIOS+"/users/"+ID_USER;
      return this.http.post(URL, data, {headers:headers}).pipe(
        map((res: any) => res?.data ?? res),
        finalize(() => this.isLoadingSubject.next(false))
      );
    }
  
    deleteUser(ID_USER:string){
      this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
      let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
      let URL = URL_SERVICIOS+"/users/"+ID_USER;
      return this.http.delete(URL, {headers:headers}).pipe(
        map((res: any) => res?.data ?? res),
        finalize(() => this.isLoadingSubject.next(false))
      );
    }

    searchSubareas(search: string = '') {
  this.isLoadingSubject.next(true);
  let headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authservice.token });
  let URL = URL_SERVICIOS + "/subareas/search?search=" + encodeURIComponent(search);
  return this.http.get(URL, { headers: headers }).pipe(
    map((res: any) => res?.data ?? res),
    finalize(() => this.isLoadingSubject.next(false))
  );
}



 }
