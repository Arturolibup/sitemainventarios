import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { UnitsService } from '../service/units.service';
import { DeleteTransformsUnitsComponent } from '../delete-transforms-units/delete-transforms-units.component';

@Component({
  selector: 'app-create-transforms-units',
  templateUrl: './create-transforms-units.component.html',
  styleUrls: ['./create-transforms-units.component.scss']
})
export class CreateTransformsUnitsComponent {
//@Output()  UnitC:EventEmitter<any> = new EventEmitter  
  @Input () UNIT_FULL: any;
  @Input () UNITS:any = []; // obtner la lista de las unidades
    
    unit_to_id: string ='';
    isLoading: any;
    
   
    constructor (
      public modal: NgbActiveModal,
      public modalService: NgbModal,
      public unitService: UnitsService,
      public toast: ToastrService,
    ){
      

    }

    ngOnInit(): void{
      
      //llamar al constructor
    }

    store(){
      if (!this.unit_to_id){
        this.toast.error ("Validación", "La Unidad es requerida");
        return false;
      }
      

      let data = { 
        unit_id : this.UNIT_FULL.id,
        unit_to_id: this.unit_to_id,
      }

      //this.isLoading$.next(true);
      this.unitService.registerUnitTransform(data).subscribe((resp:any) => {  //devolucion del backend
      //this.isLoading$.next(false);
        console.log(resp);
        if (resp.message == 403){
          this.toast.error("validacion", resp.message_text);
        }else{
          this.toast.success("Exito", "La Unidad se registro correctamente");
          //this.UnitC.emit(resp.unit);
          this.UNIT_FULL.transforms.unshift(resp.unit);
          //this.modal.close();
        }
      })
    }

    removeUnits(transform:any){
      const modalRef = this.modalService.open(DeleteTransformsUnitsComponent, {centered:true,size: 'md'});
            modalRef.componentInstance.TRANSFORM_SELECTED = transform;
             
            modalRef.componentInstance.UnitransfD.subscribe((p:any) =>{
              let INDEX = this.UNIT_FULL.transforms.findIndex((unit_var:any)=> unit_var.id == transform.id); 
                if (INDEX!= -1){
                  this.UNIT_FULL.transforms.splice(INDEX,1);  //eliminacion de un permiso
                }
              })
    }
}
