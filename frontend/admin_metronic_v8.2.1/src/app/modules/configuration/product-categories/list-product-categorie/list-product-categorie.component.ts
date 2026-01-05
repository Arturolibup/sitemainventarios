import { Component } from '@angular/core';
import { ProductCategoriesService } from '../service/product-categories.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CreateProductCategorieComponent } from '../create-product-categorie/create-product-categorie.component';
import { EditProductCategorieComponent } from '../edit-product-categorie/edit-product-categorie.component';
import { DeleteProductCategorieComponent } from '../delete-product-categorie/delete-product-categorie.component';

@Component({
  selector: 'app-list-product-categorie',
  templateUrl: './list-product-categorie.component.html',
  styleUrls: ['./list-product-categorie.component.scss']
})
export class ListProductCategorieComponent {

    search:string = '';
    PRODUCT_CATEGORIES:any = [];
    isLoading$: any;

  
    totalPages: number = 0;
    currentPage: number = 1;
  
  
    constructor(
      public modalService: NgbModal,
      public productCategorieService: ProductCategoriesService,
  
    ){}
    
    ngOnInit(): void {
  
   //DE AQUI EN ADELANTA 
      this.isLoading$ = this.productCategorieService.isLoading$;
      this.listProductCategories();
      
      }
  
   listProductCategories(page = 1){
     this.productCategorieService.listProductCategories(page,this.search).subscribe((resp:any) =>{
       console.log(resp);
       this.PRODUCT_CATEGORIES = resp.categories;
       this.totalPages = resp.total;
       this.currentPage = page;
     })
   }
  

   loadPage($event:any){
      this.listProductCategories($event);
   }
  
   createProductCategorie(){
     const modalRef = this.modalService.open(CreateProductCategorieComponent,{centered:true,size: 'md'});
     
     modalRef.componentInstance.productCategorieC.subscribe((product_categorie:any) =>{
       this.PRODUCT_CATEGORIES.unshift(product_categorie); //unshift para que aparezca primero
       
      
      })
    } 
    
    
    editProductCategorie(CATEGORIE:any){
      const modalRef = this.modalService.open(EditProductCategorieComponent,{centered:true,size: 'md'});
      modalRef.componentInstance.CATEGORIE_SELECTED = CATEGORIE;
      
       
      modalRef.componentInstance.productCategorieE.subscribe((product_categorie:any) =>{
        let INDEX = this.PRODUCT_CATEGORIES.findIndex((product_categorie:any)=> product_categorie.id == CATEGORIE.id); //this.userS.unshift(user);
          if (INDEX!= -1){
            this.PRODUCT_CATEGORIES[INDEX] = product_categorie;
          }
        })
   }
    
   deleteProductCategorie(CATEGORIE:any){
    const modalRef = this.modalService.open(DeleteProductCategorieComponent, {centered:true,size: 'md'});
      modalRef.componentInstance.CATEGORIE_SELECTED = CATEGORIE;
       
      modalRef.componentInstance.productCategorieD.subscribe((product_categorie:any) =>{
        let INDEX = this.PRODUCT_CATEGORIES.findIndex((product_categorie:any)=> product_categorie.id == CATEGORIE.id); 
          if (INDEX!= -1){
            this.PRODUCT_CATEGORIES.splice(INDEX,1);  //eliminacion de un permiso
          }
        })
   }
  
  
  
  refreshProductCategorie(): void {
    this.search = ''; // Limpia el campo de búsqueda
    this.listProductCategories(); // Vuelve a cargar toda la lista de users
    }
}
