import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ProvidersService } from '../service/providers.service';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-delete-providers',
  templateUrl: './delete-providers.component.html',
  styleUrls: ['./delete-providers.component.scss']
})
export class DeleteProvidersComponent {
@Output()  providerD: EventEmitter<any> = new EventEmitter  
@Input() PROVIDER_FULLNAME: any; //recibe valor del componente padre/

  name: string ='';
  isLoading: any; //renderizar la vista cuando haya algo que mostrar

  
  
  
  constructor (
    public modal: NgbActiveModal,
    public providerService: ProvidersService,
    public toast: ToastrService,
  ){
    

  }

  ngOnInit(): void{ 
  }

  delete(){
    
    this.providerService.deleteProvider(this.PROVIDER_FULLNAME.id).subscribe((resp:any) => {  //devolucion del backend
      console.log(resp);
      if (resp.message == 403){
        this.toast.error("validación", resp.message_text);
      }else{
        this.toast.success("Exito", "El Proveedor se ha elimininado correctamente");
        this.providerD.emit(resp.message);
        this.modal.close();
      }
    })
  }
}
