import { Component, EventEmitter, Output } from '@angular/core';
import { UnitsService } from '../service/units.service';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-create-units',
  templateUrl: './create-units.component.html',
  styleUrls: ['./create-units.component.scss']
})
export class CreateUnitsComponent {
  @Output()  UnitC:EventEmitter<any> = new EventEmitter  
  
    name: string ='';
    isLoading: any;
    description: string = '';
    state: number;
    
    created_at: string = "";

  
    constructor (
      public modal: NgbActiveModal,
      public unitService: UnitsService,
      public toast: ToastrService,
    ){
      

    }

    ngOnInit(): void{
      
      //llamar al constructor
    }

    store(){
      if (!this.name){
        this.toast.error ("Validacion", "El nombre de la Unidad requerido");
        return false;
      }
      
      if (!this.description){
        this.toast.error ("Validacion", "La Descripción es requerida");
        return false;
      }


      let data = { 
        name : this.name,
        description: this.description,
        created_at: this.created_at,
        
      }

      //this.isLoading$.next(true);
      this.unitService.registerUnit(data).subscribe((resp:any) => {  //devolucion del backend
      //this.isLoading$.next(false);
        console.log(resp);
        if (resp.message == 403){
          this.toast.error("validacion", resp.message_text);
        }else{
          this.toast.success("Exito", "La Unidad se registro correctamente");
          this.UnitC.emit(resp.unit);
          this.modal.close();
        }
      })
    }
}
