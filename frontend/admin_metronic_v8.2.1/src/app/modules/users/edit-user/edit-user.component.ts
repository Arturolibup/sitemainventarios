import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { UsersService } from '../service/users.service';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';

@Component({
  selector: 'app-edit-user',
  templateUrl: './edit-user.component.html',
  styleUrls: ['./edit-user.component.scss']
})
export class EditUserComponent {


  @Output()  UserE:EventEmitter<any> = new EventEmitter  // nos permite enviar una data desde un componente hijo al padre, create roles es hijo, list.roles padre
  @Input() roles: any = []; // create roles es hijo, list roles es padre. donde inicializa createRolesComponent
  @Input() USER_SELECTED: any;
  @Input() area: any = []; // create roles es hijo, list roles es padre. donde inicializa createRolesComponent
  @Input() subarea: any = []; // create roles es hijo, list roles es padre. donde inicializa createRolesComponent

    isLoading: any;
    name: string ='';
    surname:string="";
    email : string= "";
    phone : string= "";
    address: string = "";
    gender: string = "";
    n_document: string = "";
    role_id : string = "";
    type_document: string ="";
    sucursal_id: string = "";
    password: string ="";
    password_repeat: string="";
    avatarPreview: string = "";
    
    file_name: any;
    imagen_previzualiza: any;

     // NUEVO: Para búsqueda de subáreas
         subarea_search: string = ''; // Input de búsqueda
         subarea_results: any[] = []; // Resultados de búsqueda
         area_name: string = ''; // Para mostrar área autollenada
         area_id: string = '';
         subarea_id: string = '';
     
         private searchSubject = new Subject<string>(); // Para debounce
  
      // esta variable se enviara al backend
    
  
    constructor (
      public modal: NgbActiveModal,
      public usersService: UsersService,
      public toast: ToastrService,
    ){
      
  
    }
  
    ngOnInit(): void{
      this.name =this.USER_SELECTED.name,
      this.surname =this.USER_SELECTED.surname,
      this.email =this.USER_SELECTED.email,
      this.phone =this.USER_SELECTED.phone,
      this.address =this.USER_SELECTED.address,
      this.gender =this.USER_SELECTED.gender,
      this.n_document =this.USER_SELECTED.n_document,
      this.role_id =this.USER_SELECTED.role_id,
      this.type_document =this.USER_SELECTED.type_document,
      this.sucursal_id =this.USER_SELECTED.sucursal_id,
      this.imagen_previzualiza =this.USER_SELECTED.avatar
      
      // 🔹 Inicializar área y subárea
      this.area_id = this.USER_SELECTED.area_id;
      this.subarea_id = this.USER_SELECTED.subarea_id;
      this.area_name = this.USER_SELECTED?.area?.name || '';
      this.subarea_search = this.USER_SELECTED?.subarea?.name || '';
      // Debounce para búsqueda eficiente (espera 200ms)
      this.searchSubject.pipe(
        debounceTime(200),
        distinctUntilChanged()
      ).subscribe(searchTerm => {
        if (searchTerm.length >= 1) {
          this.searchSubareas(searchTerm);
        } else {
          this.subarea_results = [];
        }
      });
      console.log("AREA ID:", this.area_id);
      console.log("SUBAREA ID:", this.subarea_id);
      console.log("SUCURSAL ID:", this.USER_SELECTED.sucursal_id);
      console.log("AREA:", this.USER_SELECTED.area.name);
      console.log("SUBAREA :", this.USER_SELECTED.subarea.name);
    }
  
    // BÚSQUEDA DE SUBÁREAS
  onSearchSubarea(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchSubject.next(input.value);
  }

  searchSubareas(search: string) {
    this.usersService.searchSubareas(search).subscribe((resp: any) => {
      this.subarea_results = resp.subareas || [];
    });
  }

  // SELECCIONAR SUBÁREA Y AUTOLLENAR ÁREA
  selectSubarea(subarea: any) {
    this.subarea_id = subarea.id;
    this.area_id = subarea.area_id;
    this.area_name = subarea.area ? subarea.area.name : '';
    this.subarea_search = subarea.name; // Muestra el nombre seleccionado en el input
    this.subarea_results = []; // Cierra el dropdown
  }
  
    
    processFile($event:any){
      if ($event.target.files[0].type.indexOf("image") < 0){
        this.toast.warning("WARN", "EL ARCHIVO NO ES UNA IMAGEN");
        return;
      }
      this.file_name = $event.target.files[0];
      let reader =new FileReader();
      reader.readAsDataURL(this.file_name);
      reader.onloadend = () => this.imagen_previzualiza = reader.result;
      
    }
  
    store(){
      if (!this.name){
        this.toast.error ("Validar", "El nombre es requerido");
        return false;
      }
      if (!this.phone){
        this.toast.error ("Validar", "El celular es requerido");
        return false;
      }
      if (!this.gender){
        this.toast.error ("Validar", "El genero es requerido");
        return false;
      }
      if (!this.address){
        this.toast.error ("Validar", "la direccion es requerida");
        return false;
      }
      if (!this.n_document){
        this.toast.error ("Validar", "El numero de empleado es requerido");
        return false;
      }
      if (!this.surname){
        this.toast.error ("Validar", "El nombre es requerido");
        return false;
      }
      
      if (this.password && this.password !=this.password_repeat ){
        this.toast.error ("Validar", "Las contraseñas no son iguales");
        return false;
      }


      
      let formData = new FormData();
      formData.append("name",this.name);
      formData.append("surname",this.surname);
      formData.append("email",this.email);
      formData.append("phone",this.phone);
      formData.append("role_id",this.role_id);
      formData.append("gender",this.gender);
      formData.append("type_document",this.type_document);
      formData.append("n_document",this.n_document);
      formData.append("address",this.address);
      formData.append("sucursal_id",this.sucursal_id);
      if (this.area_id) formData.append('area_id', this.area_id);
      if (this.subarea_id) formData.append('subarea_id', this.subarea_id);

      if(this.password){
        formData.append("password",this.password);
      
      }
      if(this.file_name){
        
        formData.append("imagen", this.file_name);
      
      }
      
      //formData.append("avatarPreview",this.avatarPreview);
      

      this.usersService.updateUser(this.USER_SELECTED.id, formData).subscribe((resp:any) => {  //devolucion del backend
        console.log(resp);
        if (resp.message == 403){
          this.toast.error("Validar", resp.message_text);
        }else{
          this.toast.success("Exito", "El usuario se ha editado correctamente");
          this.UserE.emit(resp.user);
          this.modal.close();
        }
      })
    }
}
