import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { data } from 'jquery';
import { ToastrService } from 'ngx-toastr';
import { UsersService } from '../service/users.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms'; //
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';


@Component({
  selector: 'app-create-user',
  templateUrl: './create-user.component.html',
  styleUrls: ['./create-user.component.scss']
  
})
export class CreateUserComponent {
  @Output()  UserC:EventEmitter<any> = new EventEmitter  // nos permite enviar una data desde un componente hijo al padre, create roles es hijo, list.roles padre
  @Input() roles: any = []; // create roles es hijo, list roles es padre. donde inicializa createRolesComponent
    
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
    //sucursal_id: = NULL;
    password: string ="";
    password_repeat: string="";
    //avatarPreview: string = "";
    
    file_name: any;
    imagen_previzualiza: any;

    // NUEVO: Para búsqueda de subáreas
    subarea_search: string = ''; // Input de búsqueda
    subarea_results: any[] = []; // Resultados de búsqueda
    area_name: string = ''; // Para mostrar área autollenada
    area_id: string = '';
    subarea_id: string = '';

    private searchSubject = new Subject<string>(); // Para debounce

     //renderizar la vista cuando haya algo que mostrar
  
  
     // esta variable se enviara al backend
    
  
    constructor (
      public modal: NgbActiveModal,
      public usersService: UsersService,
      public toast: ToastrService,
    ){
      
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
  
    }
  
    ngOnInit(): void{
      //llamar al constructor
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
      let reader = new FileReader();
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
      if (!this.password){
        this.toast.error ("Validar", "La contraseña es requerida");
        return false;
      }
      if (this.password && this.password !=this.password_repeat ){
        this.toast.error ("Validar", "Las contraseñas no son iguales");
        return false;
      }
      // transformamos los datos para enviarlos a la base de datos.
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
      if (this.area_id) formData.append('area_id', this.area_id);
      if (this.subarea_id) formData.append('subarea_id', this.subarea_id);

      formData.append("imagen",this.file_name);
      formData.append("password", this.password);
      //formData.append("avatarPreview",this.avatarPreview);
     
      this.isLoading = true;
      this.usersService.registerUser(formData).subscribe((resp:any) => {  //devolucion del backend
        console.log(resp);
        if (resp.message == 403){
          this.toast.error("Validar", resp.message_text);
        }else{
          this.toast.success("Exito", "El usuario se registro correctamente");
          this.UserC.emit(resp.user);
          this.modal.close();
        }
      });
      this.isLoading = false;
      this.toast.error("Error", "El usuario no se pudo registrar");
    }
}
