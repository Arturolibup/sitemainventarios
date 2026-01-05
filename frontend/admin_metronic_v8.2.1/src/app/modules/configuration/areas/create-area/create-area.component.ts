import { Component, EventEmitter, Output } from '@angular/core';
import { AreaService } from '../service/area.service';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from 'src/app/modules/auth';

@Component({
  selector: 'app-create-area',
  templateUrl: './create-area.component.html',
  styleUrls: ['./create-area.component.scss']
})
export class CreateAreaComponent {
  @Output()  AreaC:EventEmitter<any> = new EventEmitter 
  
  canCreate: boolean = false; //para el html sin el no puede crear
  canEdit: boolean = false;
  canDelete: boolean = false;

  
    name: string ='';
    isLoading: any;
    address: string = '';
    //municipio:string = ''; //renderizar la vista cuando haya algo que mostrar
    municipios: string[] = []; // Aquí guardaremos la lista de municipios
    selectedMunicipio: string = "";
    created_at: string = "";

  // esta variable se enviara al backend
    //isLoading$ = new BehaviorSubject<boolean>(false);
  
    constructor (
      public modal: NgbActiveModal,
      public areaService: AreaService,
      public toast: ToastrService,
      private auth:AuthService  //invocamos el servicio de permisos
    ){
      

    }

    ngOnInit(): void{
      this.checkPermissions(); //agrefamos el permiso
      this.getMunicipios();
      //llamar al constructor
    }

    private checkPermissions() { //funcion con los permisos
    this.canCreate = this.auth.hasPermission('areas.create');
    this.canEdit = this.auth.hasPermission('areas.update');
    this.canDelete = this.auth.hasPermission('areas.delete');
    }

    getMunicipios(): void {
      this.areaService.getMunicipios().subscribe(
        (data: any) => {
          if (Array.isArray(data)) {
            this.municipios = data as string[]; // Casting explícito
          } else {
            console.error('Error: los datos no son un array de municipios', data);
          }
        },
        
      );
    }

    store(){
      if (!this.name){
        this.toast.error ("Validacion", "El nombre del Area es requerido");
        return false;
      }
      
      if (!this.address){
        this.toast.error ("Validacion", "La Dirección es requerida");
        return false;
      }

      if (!this.selectedMunicipio){
        this.toast.error ("Validacion", "El municipio es requerido");
        return false;
      }

      let data = { 
        name : this.name,
        address: this.address,
        municipio: this.selectedMunicipio,
        created_at: this.created_at,
        
      }

      //this.isLoading$.next(true);
      this.areaService.registerArea(data).subscribe((resp:any) => {  //devolucion del backend
      //this.isLoading$.next(false);
        console.log(resp);
        if (resp.message == 403){
          this.toast.error("validacion", resp.message_text);
        }else{
          this.toast.success("Exito", "El Area se registro correctamente");
          this.AreaC.emit(resp.area);
          this.modal.close();
        }
      })
    }
}
