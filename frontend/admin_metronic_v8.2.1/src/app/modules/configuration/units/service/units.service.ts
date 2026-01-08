import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, finalize, map } from 'rxjs';
import { URL_SERVICIOS } from 'src/app/config/config';
import { AuthService } from 'src/app/modules/auth';

@Injectable({
  providedIn: 'root'
})
export class UnitsService {
  isLoading$: Observable<boolean>;
  isLoadingSubject: BehaviorSubject<boolean>;
  
  constructor(
    private http: HttpClient, //hacer las peticiones http a nuestra api
    public authservice: AuthService, // lo trabajamos para autitenticacion, para las peticiones a realizar
  ) {
    this.isLoadingSubject = new BehaviorSubject<boolean>(false);
    this.isLoading$ = this.isLoadingSubject.asObservable();
  }

  registerUnit(data:any) {
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/units";
    return this.http.post(URL, data, {headers:headers}).pipe(
      map((res: any) => res?.data ?? res),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  listUnits(page:number = 1, search:string = ''){
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' :'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/units?page="+page+"&search="+search;
    return this.http.get(URL, {headers:headers}).pipe(
      map((res: any) => res?.data ?? res),
      finalize(() => this.isLoadingSubject.next(false))
    );
  } 


  updateUnit(ID_UNIT: string, data:any) {
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/units/"+ID_UNIT;
    return this.http.put(URL, data, {headers:headers}).pipe(
      map((res: any) => res?.data ?? res),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  deleteUnit(ID_UNIT:string){
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/units/"+ID_UNIT;
    return this.http.delete(URL, {headers:headers}).pipe(
      map((res: any) => res?.data ?? res),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

  registerUnitTransform(data:any) {
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/units/add-transform";
    return this.http.post(URL, data, {headers:headers}).pipe(
      map((res: any) => res?.data ?? res),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }
  deleteUnitTransform(ID_UNIT:string){
    this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
    let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS+"/units/delete-transform/"+ID_UNIT;
    return this.http.delete(URL, {headers:headers}).pipe(
      map((res: any) => res?.data ?? res),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }
}
