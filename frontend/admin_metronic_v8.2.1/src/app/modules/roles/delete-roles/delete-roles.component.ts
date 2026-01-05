import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { SIDEBAR } from 'src/app/config/config';
import { RolesService } from '../services/roles.service';

@Component({
  selector: 'app-delete-roles',
  templateUrl: './delete-roles.component.html',
  styleUrls: ['./delete-roles.component.scss']
})
export class DeleteRolesComponent {

@Output() RoleD:EventEmitter<any> = new EventEmitter  // nos permite enviar una data desde un hijo al padre, create roles es hijo, list.roles padre
@Input() ROLE_SELECTED:any; //recibe valor del componente padre/

  name: string ='';
  isLoading: any; //renderizar la vista cuando haya algo que mostrar

  SIDEBAR: any= SIDEBAR;
  permisions:any = []; // esta variable se enviara al backend
  

  constructor (
    public modal: NgbActiveModal,
    public rolesService: RolesService,
    public toast: ToastrService,
  ){
    

  }

  ngOnInit(): void{ 
  }

  delete(){
    
    this.rolesService.deleteRole(this.ROLE_SELECTED.id).subscribe((resp:any) => {  //devolucion del backend
      console.log(resp);
      if (resp.message == 403){
        this.toast.error("validacion", resp.message_text);
      }else{
        this.toast.success("Exito", "El rol se elimino correctamente");
        this.RoleD.emit(resp.role);
        this.modal.close();
      }
    })
  }


}
