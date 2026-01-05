import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { SubareaService } from '../service/subarea.service';

@Component({
  selector: 'app-delete-subarea',
  templateUrl: './delete-subarea.component.html',
  styleUrls: ['./delete-subarea.component.scss']
})
export class DeleteSubareaComponent {
@Output() SubareaD:EventEmitter<any> = new EventEmitter  // nos permite enviar una data desde un hijo al padre, create roles es hijo, list.roles padre
@Input() SUBAREA_SELECTED:any =[];
 //recibe valor del componente padre/
 @Input () AREASNOM: any = [];
 
 // se envian del padre 
     name: string ='';
     isLoading$: any;
     //address: string = '';
     localidad:string = ''; //renderizar la vista cuando haya algo que mostrar
     municipioss: string[] = []; // Aquí guardaremos la lista de municipios
     selectedMunicipio: string = "";
     selectedArea: string = "";
     created_at: string = "";
     area_id:string = "";

  constructor (
    public modal: NgbActiveModal,
    public subareaService: SubareaService,
    public toast: ToastrService,
  ){
    

  }

  ngOnInit(): void{ 
  }

  delete(){
    
    this.subareaService.deleteSubarea(this.SUBAREA_SELECTED.id).subscribe((resp:any) => {  //devolucion del backend
      console.log(resp);
      if (resp.message == 403){
        this.toast.error("validacion", resp.message_text);
      }else{
        this.toast.success("Exito", "La Subarea se elimino correctamente");
        this.SubareaD.emit(resp.message);
        this.modal.close();
      }
    })
  }
}
