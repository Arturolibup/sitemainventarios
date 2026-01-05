import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { UnitsService } from '../service/units.service';

@Component({
  selector: 'app-delete-transforms-units',
  templateUrl: './delete-transforms-units.component.html',
  styleUrls: ['./delete-transforms-units.component.scss']
})
export class DeleteTransformsUnitsComponent {
@Output()  UnitransfD: EventEmitter<any> = new EventEmitter  
@Input() TRANSFORM_SELECTED: any; //recibe valor del componente padre/

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
  }

  delete(){
    
    this.unitService.deleteUnitTransform(this.TRANSFORM_SELECTED.id).subscribe((resp:any) => {  //devolucion del backend
      console.log(resp);
      if (resp.message == 403){
        this.toast.error("validación", resp.message_text);
      }else{
        this.toast.success("Exito", "La Unidad transformada se ha elimininado correctamente");
        this.UnitransfD.emit(resp.message);
        this.modal.close();
      }
    })
  }
}
