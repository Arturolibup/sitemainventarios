import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { ProductCategoriesService } from '../service/product-categories.service';

@Component({
  selector: 'app-delete-product-categorie',
  templateUrl: './delete-product-categorie.component.html',
  styleUrls: ['./delete-product-categorie.component.scss']
})
export class DeleteProductCategorieComponent {

@Output()  productCategorieD: EventEmitter<any> = new EventEmitter  
@Input() CATEGORIE_SELECTED: any; //recibe valor del componente padre/

  name: string ='';
  isLoading: any; //renderizar la vista cuando haya algo que mostrar

  
  permisions:any = []; // esta variable se enviara al backend
  
  constructor (
    public modal: NgbActiveModal,
          public productCategorieService: ProductCategoriesService,
          public toast: ToastrService,
  ){
    

  }

  ngOnInit(): void{ 
  }

  delete(){
    
    this.productCategorieService.deleteProductCategorie(this.CATEGORIE_SELECTED.id).subscribe((resp:any) => {  //devolucion del backend
      console.log(resp);
      if (resp.message == 403){
        this.toast.error("validacion", resp.message_text);
      }else{
        this.toast.success("Exito", "La categoría se elimino correctamente");
        this.productCategorieD.emit(resp.message);
        this.modal.close();
      }
    })
  }
}
