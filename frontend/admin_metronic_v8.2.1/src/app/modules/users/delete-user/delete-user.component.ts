import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';

import { UsersService } from '../service/users.service';

@Component({
  selector: 'app-delete-user',
  templateUrl: './delete-user.component.html',
  styleUrls: ['./delete-user.component.scss']
})
export class DeleteUserComponent {
@Output() UserD:EventEmitter<any> = new EventEmitter  // nos permite enviar una data desde un hijo al padre, create roles es hijo, list.roles padre
@Input() USER_SELECTED:any; //recibe valor del componente padre/

  name: string ='';
  isLoading: any; //renderizar la vista cuando haya algo que mostrar

  
  permisions:any = []; // esta variable se enviara al backend
  
  constructor (
    public modal: NgbActiveModal,
    public usersService: UsersService,
    public toast: ToastrService,
  ){
    

  }

  ngOnInit(): void{ 
  }

  delete(){
    
    this.usersService.deleteUser(this.USER_SELECTED.id).subscribe((resp:any) => {  //devolucion del backend
      console.log(resp);
      if (resp.message == 403){
        this.toast.error("validacion", resp.message_text);
      }else{
        this.toast.success("Exito", "El Usuario se elimino correctamente");
        this.UserD.emit(resp.role);
        this.modal.close();
      }
    })
  }
}
