import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AreaService } from '../service/area.service';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-delete-area',
  templateUrl: './delete-area.component.html',
  styleUrls: ['./delete-area.component.scss']
})
export class DeleteAreaComponent {
@Output() AreaD:EventEmitter<any> = new EventEmitter  // nos permite enviar una data desde un hijo al padre, create roles es hijo, list.roles padre
@Input() AREA_SELECTED:any; //recibe valor del componente padre/

  name: string ='';
  isLoading: any; //renderizar la vista cuando haya algo que mostrar


  constructor (
    public modal: NgbActiveModal,
    public areaService: AreaService,
    public toast: ToastrService,
  ){
    

  }

  ngOnInit(): void{ 
  }

  delete(){
    
    this.areaService.deleteArea(this.AREA_SELECTED.id).subscribe((resp:any) => {  //devolucion del backend
      console.log(resp);
      if (resp.message == 403){
        this.toast.error("validacion", resp.message_text);
      }else{
        this.toast.success("Exito", "El Area se elimino correctamente");
        this.AreaD.emit(resp.message);
        this.modal.close();
      }
    })
  }
}
