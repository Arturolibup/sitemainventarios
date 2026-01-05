import { Component, EventEmitter, Output } from '@angular/core';
import { ProvidersService } from '../service/providers.service';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-create-providers',
  templateUrl: './create-providers.component.html',
  styleUrls: ['./create-providers.component.scss']
})
export class CreateProvidersComponent {

@Output()  providerC:EventEmitter<any> = new EventEmitter  
  
  isLoading: any;
  full_name: string ='';
  rfc:string="";
  email:string="";
  phone:string="";

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
    //llamar al constructor
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

      formData.append("provider_imagen",this.IMAGEN_PROVEEDOR);


    this.providerService.registerProvider(formData).subscribe((resp:any) => {  //devolucion del backend
      console.log(resp);
      if (resp.message == 403){
        this.toast.error("validación", resp.message_text);
      }else{
        this.toast.success("Exito", "El Proveedor se ha Creado correctamente");
        this.providerC.emit(resp.provider);
        this.modal.close();
      }
    })
  }
}
