import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { SubareaService } from '../service/subarea.service';

@Component({
  selector: 'app-edit-subarea',
  templateUrl: './edit-subarea.component.html',
  styleUrls: ['./edit-subarea.component.scss']
})
export class EditSubareaComponent {

@Output() SubareaE:EventEmitter<any> = new EventEmitter  
@Input () areasnom: any = [];
@Input () SUBAREA_SELECTED: any = []; 
// se envian del padre 
    name: string ='';
    isLoading$: any;
    //address: string = '';
    localidad:string = ''; //renderizar la vista cuando haya algo que mostrar
    municipios: string[] = []; // Aquí guardaremos la lista de municipios
    selectedMunicipio: string = "";
    selectedArea: string = "";
    created_at: string = "";
    area_id:string = "";
    //isVisible: boolean;

    


  // esta variable se enviara al backend
    //isLoading$ = new BehaviorSubject<boolean>(false);
  
    constructor (
      public modal: NgbActiveModal,
      public subareaService: SubareaService,
      public toast: ToastrService,
    ){
      

    }

    ngOnInit(): void{
      this.getMunicipios();
      this.name = this.SUBAREA_SELECTED.name;
      this.localidad= this.SUBAREA_SELECTED.localidad;
      this.area_id= this.SUBAREA_SELECTED.area_id;
      this.selectedArea= this.SUBAREA_SELECTED.selectedArea;
      //this.municipioss= this.SUBAREA_SELECTED.municipio;
      this.selectedMunicipio = this.SUBAREA_SELECTED.municipio;
      //this.selectedMunicipio= this.SUBAREA_SELECTED.selectedMunicipio;
      //this.isVisible =true;
      //llamar al constructor
    }

    getMunicipios(): void {
      this.subareaService.getMunicipios().subscribe(
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
        this.toast.error ("Validacion", "El nombre de la Subarea es requerido");
        return false;
      }
      
      if (!this.localidad){
        this.toast.error ("Validacion", "La Localidad es requerida");
        return false;
      }

      if (!this.selectedMunicipio){
        this.toast.error ("Validacion", "El municipio es requerido");
        return false;
      }

      let data = { 
        name : this.name,
        //address: this.address,
        localidad: this.localidad,
        municipio: this.selectedMunicipio,
        created_at: this.created_at,
        area_id: Number(this.area_id),
        
      }

     
      this.subareaService.updateSubarea(this.SUBAREA_SELECTED.id, data).subscribe((resp:any) => {  //devolucion del backend 2 parametros el id del que queremos editar y la data
      
        console.log(resp);
        if (resp.message == 403){
          this.toast.error("validacion", resp.message_text);
        }else{
          this.toast.success("Exito", "La Subarea se edito correctamente");
          this.SubareaE.emit(resp.subarea);
          this.modal.close();
        }
      })
    }
}
