import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, finalize, throwError } from 'rxjs';
import { URL_SERVICIOS } from 'src/app/config/config';
import { AuthService } from '../../auth';
import { tap, catchError} from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ProductsService {
  isLoading$: Observable<boolean>;
  isLoadingSubject: BehaviorSubject<boolean>;
    
    constructor(
      private http: HttpClient, //hacer las peticiones http a nuestra api
      public authservice: AuthService, // lo trabajamos para autitenticacion, para las peticiones a realizar
    ) {
      this.isLoadingSubject = new BehaviorSubject<boolean>(false);
      this.isLoading$ = this.isLoadingSubject.asObservable();
    }

    registerproduct(FormData:any): Observable<any> {
      this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
      let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
      let URL = URL_SERVICIOS + "/products";
      return this.http.post(URL, FormData, {headers:headers}).pipe(
       tap(response => console.log ('Producto registrado:', response)),
       catchError((error)=>{
        console.error('Error al registrar el producto:', error);
        return throwError(() => new Error(error.error.message_text || 'Error al registrar el producto'));
       }),
        finalize(() => this.isLoadingSubject.next(false))
      );
    }
  
    checkProductExists(sku: string, title: string, productId?: string): Observable<any> {
    this.isLoadingSubject.next(true);
    let headers = new HttpHeaders({'Authorization': 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS + `/products/check?sku=${encodeURIComponent(sku)}`;
    if (productId) {
      URL += `&product_id=${productId}`;
    }
    return this.http.get(URL, {headers: headers}).pipe(
      tap(response => console.log('Respuesta de verificación de producto:', response)),
      catchError((error) => {
        console.error('Error al verificar el producto:', error);
        return throwError(() => new Error(error.message || 'Error al verificar el producto'));
      }),
      finalize(() => this.isLoadingSubject.next(false))
    );
  }

    // MODIFIED: Fixed URL interpolation and added error handling
  listproducts(page: number = 1, data: any = null): Observable<any> {
    this.isLoadingSubject.next(true);
    let headers = new HttpHeaders({'Authorization': 'Bearer ' + this.authservice.token});
    let URL = URL_SERVICIOS + `/products?page=${page}`;
    return this.http.get(URL, {headers: headers, params: data}).pipe(
        tap(response => console.log('Productos listados:', response)),
        catchError((error) => {
            console.error('Error al listar productos:', error);
            return throwError(() => new Error(error.error.message_text || 'Error al listar productos'));
        }),
        finalize(() => this.isLoadingSubject.next(false))
    );
}

    configAll(){
      this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
      let headers = new HttpHeaders ({'Authorization':'Bearer ' + this.authservice.token});
      let URL = URL_SERVICIOS+"/products/config";
      return this.http.get(URL, {headers: headers}).pipe(
        finalize(() => this.isLoadingSubject.next(false))
      );
    } 

    getProductOptions(): Observable<any> {
      this.isLoadingSubject.next(true);
      let headers = new HttpHeaders({ 'Authorization': 'Bearer ' + this.authservice.token });
      let URL = URL_SERVICIOS + "/products-options"; // Ajusta la ruta según tu controlador
      return this.http.get(URL, { headers: headers }).pipe(
        finalize(() => this.isLoadingSubject.next(false))
      );
    }

    updateproduct(PRODUCT_ID: string, formData:any): Observable<any> {
      this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
      let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
      let URL = URL_SERVICIOS+"/products/"+PRODUCT_ID;
      return this.http.post(URL, formData, {headers: headers}).pipe(
        finalize(() => this.isLoadingSubject.next(false))
      );
    }

    showProduct(PRODUCT_ID:string): Observable<any> {
      this.isLoadingSubject.next(true); // Mostrar los productos por ID por medio de show en productcontroller
      let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
      let URL = URL_SERVICIOS+"/products/"+PRODUCT_ID;
      return this.http.get(URL,{headers: headers}).pipe(
        finalize(() => this.isLoadingSubject.next(false))
      );
    }
  
    deleteproduct(PRODUCT_ID:string): Observable<any>{
      this.isLoadingSubject.next(true); // transporta informacion a diferentes componentes de la app
      let headers = new HttpHeaders ({'Authorization' : 'Bearer ' + this.authservice.token});
      let URL = URL_SERVICIOS+"/products/"+PRODUCT_ID;
      return this.http.delete(URL, {headers: headers}).pipe(
        finalize(() => this.isLoadingSubject.next(false))
      );
    }
}
