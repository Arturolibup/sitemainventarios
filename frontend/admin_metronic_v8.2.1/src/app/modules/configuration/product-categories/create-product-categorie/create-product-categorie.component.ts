import { Component, EventEmitter, Output } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { ProductCategoriesService } from '../service/product-categories.service';

@Component({
  selector: 'app-create-product-categorie',
  templateUrl: './create-product-categorie.component.html',
  styleUrls: ['./create-product-categorie.component.scss']
})
export class CreateProductCategorieComponent {
@Output()  productCategorieC:EventEmitter<any> = new EventEmitter  
  
    isLoading: any;
    name: string ='';
    address: string = '';
    created_at: string = "";
    
    IMAGEN_CATEGORIE: any; 
    IMAGEN_PREVISUALIZA: any;
  
    constructor (
      public modal: NgbActiveModal,
      public productCategorieService: ProductCategoriesService,
      public toast: ToastrService,
    ){
      

    }

    ngOnInit(): void{
      //llamar al constructor
    }

    processFile($event:any){
      if ($event.target.files[0].type.indexOf("image") < 0){
        this.toast.warning("WARN", "EL ARCHIVO NO ES UNA IMAGEN");
        return;
      }
      this.IMAGEN_CATEGORIE = $event.target.files[0];
      let reader = new FileReader();
      reader.readAsDataURL(this.IMAGEN_CATEGORIE);
      reader.onloadend = () => this.IMAGEN_PREVISUALIZA = reader.result;
    }


    store(){
      if (!this.name){
        this.toast.error ("Validacion", "El nombre de la categoría es requerido");
        return false;
      }
      
     
      let formData = new FormData();
        formData.append("name", this.name);
        formData.append("categorie_imagen",this.IMAGEN_CATEGORIE);


      this.productCategorieService.registerProductCategorie(formData).subscribe((resp:any) => {  //devolucion del backend
        console.log(resp);
        if (resp.message == 403){
          this.toast.error("validacion", resp.message_text);
        }else{
          this.toast.success("Exito", "La categoria se registro correctamente");
          this.productCategorieC.emit(resp.categorie);
          this.modal.close();
        }
      })
    }


}
