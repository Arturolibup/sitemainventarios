import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { ProvidersService } from '../service/providers.service';

@Component({
  selector: 'app-edit-providers',
  templateUrl: './edit-providers.component.html',
  styleUrls: ['./edit-providers.component.scss']
})
export class EditProvidersComponent {
@Output()  providerE:EventEmitter<any> = new EventEmitter  
@Input () PROVIDER_FULLNAME: any;

  isLoading: any;
  full_name: string ='';
  rfc:string="";
  email:string="";
  phone:string="";
  state: number = 1;
  address: string = '';
  created_at: string = "";
  
  IMAGEN_PROVEEDOR: any; 
  IMAGEN_PREVISUALIZA: any;

  constructor (
    public modal: NgbActiveModal,
    public providerService: ProvidersService,
    public toast: ToastrService,
  ){
    

  }

  ngOnInit(): void{
    this.full_name=this.PROVIDER_FULLNAME.full_name
    this.rfc=this.PROVIDER_FULLNAME.rfc
    this.email=this.PROVIDER_FULLNAME.email
    this.phone=this.PROVIDER_FULLNAME.phone
    this.address=this.PROVIDER_FULLNAME.address
  }

  processFile($event:any){
    if ($event.target.files[0].type.indexOf("image") < 0){
      this.toast.warning("WARN", "EL ARCHIVO NO ES UNA IMAGEN");
      return;
    }
    this.IMAGEN_PROVEEDOR = $event.target.files[0];
    let reader = new FileReader();
    reader.readAsDataURL(this.IMAGEN_PROVEEDOR);
    reader.onloadend = () => this.IMAGEN_PREVISUALIZA = reader.result;
  }


  store(){
    if (!this.full_name){
      this.toast.error ("Validación", "El nombre del Proveedor es requerido");
      return false;
    }
    if (!this.rfc){
      this.toast.error ("Validación", "El RFC del Proveedor es requerido");
      return false;
    }
    
    
    let formData = new FormData();
      formData.append("full_name", this.full_name);
      if(this.email){
        formData.append("email", this.email);
      }else{
        formData.append("email","");
      }
      formData.append("rfc", this.rfc);
      formData.append("address", this.address);
      if(this.phone){
        formData.append("phone", this.phone);
      }else{
        formData.append("phone","");
      }

      if (this.IMAGEN_PROVEEDOR){  //CONDICION SI CAMBIA IMAGEN. SI NO. QUEDA IGUAL
      formData.append("provider_imagen",this.IMAGEN_PROVEEDOR);
      }
      formData.append("state", this.state+"");

    this.providerService.updateProvider(this.PROVIDER_FULLNAME.id,formData).subscribe((resp:any) => {  //devolucion del backend
      console.log(resp);
      if (resp.message == 403){
        this.toast.error("validación", resp.message_text);
      }else{
        this.toast.success("Exito", "El Proveedor se ha Editado correctamente");
        this.providerE.emit(resp.provider);
        this.modal.close();
      }
    })
  }
}
