import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { UnitsService } from '../service/units.service';

@Component({
  selector: 'app-edit-units',
  templateUrl: './edit-units.component.html',
  styleUrls: ['./edit-units.component.scss']
})
export class EditUnitsComponent {
@Output()  UnitE:EventEmitter<any> = new EventEmitter  
@Input () UNIT_FULL:any; //enviamos la unidad a editar
  
    name: string ='';
    isLoading: any;
    description: string = '';
    state: number = 1;
    
    created_at: string = "";

  
    constructor (
      public modal: NgbActiveModal,
      public unitService: UnitsService,
      public toast: ToastrService,
    ){
      

    }

    ngOnInit(): void{
      this.name= this.UNIT_FULL.name,
      this.description=this.UNIT_FULL.description,
      
      this.state=this.UNIT_FULL.state
    }

    store(){
      if (!this.name){
        this.toast.error ("Validación", "El nombre de la Unidad requerido");
        return false;
      }
      
      if (!this.description){
        this.toast.error ("Validación", "La Descripción es requerida");
        return false;
      }


      let data = { 
        name : this.name,
        description: this.description,
        created_at: this.created_at,
        state: this.state
        
      }

      //this.isLoading$.next(true);
    
    this.unitService.updateUnit(this.UNIT_FULL.id, data).subscribe((resp:any) => {  //devolucion del backend
      //this.isLoading$.next(false);
        console.log(resp);
        if (resp.message == 403){
          this.toast.error("validación", resp.message_text);
        }else{
          this.toast.success("Exito", "La Unidad se Edito correctamente");
          this.UnitE.emit(resp.unit);
          this.modal.close();
        }
      })
    }
}
