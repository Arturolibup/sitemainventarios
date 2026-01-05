import { Component, EventEmitter, Input, Output } from '@angular/core';
import { UnitsService } from '../service/units.service';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-delete-units',
  templateUrl: './delete-units.component.html',
  styleUrls: ['./delete-units.component.scss']
})
export class DeleteUnitsComponent {
@Output()  UnitD: EventEmitter<any> = new EventEmitter  
@Input() UNIT_FULL: any; //recibe valor del componente padre/

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
    
    this.unitService.deleteUnit(this.UNIT_FULL.id).subscribe((resp:any) => {  //devolucion del backend
      console.log(resp);
      if (resp.message == 403){
        this.toast.error("validación", resp.message_text);
      }else{
        this.toast.success("Exito", "La Unidad se ha elimininado correctamente");
        this.UnitD.emit(resp.message);
        this.modal.close();
      }
    })
  }
}
