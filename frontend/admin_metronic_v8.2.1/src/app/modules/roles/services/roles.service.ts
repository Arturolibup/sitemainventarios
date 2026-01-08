import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, finalize, map } from 'rxjs';
import { AuthService } from '../../auth';
import { URL_SERVICIOS } from 'src/app/config/config';

@Injectable({
  providedIn: 'root'
})
export class RolesService {
  isLoading$: Observable<boolean>;
  isLoadingSubject: BehaviorSubject<boolean>;
  
  constructor(
    private http: HttpClient, //hacer las peticiones http a nuestra api
    public authservice: AuthService, // lo trabajamos para autitenticacion, para las peticiones a realizar
  ) {
    this.isLoadingSubject = new BehaviorSubject<boolean>(false);
    this.isLoading$ = this.isLoadingSubject.asObservable();
  }
    //http://127.0.0.1:8000/api    solo considera esta api por lo que necesito concatener 
    //registerRole(data: any): Observable<any>

  registerRol(data:any) {
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/roles";
    return this.http.post(URL, data, {headers:headers}).pipe(
      map((res: any) => res?.data ?? res),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  listRole(page:number = 1, search:string = ''){
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization':'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/roles?page="+page+"&search="+search;
    return this.http.get(URL, {headers:headers}).pipe(
      map((res: any) => res?.data ?? res),
      finalize(() => this.isLoadingSubject.next(false))
    );
  } 
  updateRol(ID_ROLE: string, data:any) {
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/roles/"+ID_ROLE;
    return this.http.put(URL, data, {headers:headers}).pipe(
      map((res: any) => res?.data ?? res),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  deleteRol(ID_ROLE:string){
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/roles/"+ID_ROLE;
    return this.http.delete(URL, {headers:headers}).pipe(
      map((res: any) => res?.data ?? res),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

registerRole(data: any) {
  this.isLoadingSubject.next(true);
  const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authservice.token });
  const URL = `${URL_SERVICIOS}/roles`;
  return this.http.post(URL, data, { headers }).pipe(
    map((res: any) => res?.data ?? res),
    finalize(() => this.isLoadingSubject.next(false))
  );
}

listRoles(page: number = 1, search: string = '') {
  this.isLoadingSubject.next(true);
  const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authservice.token });
  const URL = `${URL_SERVICIOS}/roles?page=${page}&search=${encodeURIComponent(search)}`;
  return this.http.get(URL, { headers }).pipe(
    map((res: any) => res?.data ?? res),
    finalize(() => this.isLoadingSubject.next(false))
  );
}

updateRole(ID_ROLE: string, data: any) {
  this.isLoadingSubject.next(true);
  const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authservice.token });
  const URL = `${URL_SERVICIOS}/roles/${ID_ROLE}`;
  return this.http.put(URL, data, { headers }).pipe(
    map((res: any) => res?.data ?? res),
    finalize(() => this.isLoadingSubject.next(false))
  );
}

deleteRole(ID_ROLE: string) {
  this.isLoadingSubject.next(true);
  const headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authservice.token });
  const URL = `${URL_SERVICIOS}/roles/${ID_ROLE}`;
  return this.http.delete(URL, { headers }).pipe(
    map((res: any) => res?.data ?? res),
    finalize(() => this.isLoadingSubject.next(false))
  );
}

}

