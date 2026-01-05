import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject } from 'rxjs';
import { AreaService } from '../service/area.service';

@Component({
  selector: 'app-edit-area',
  templateUrl: './edit-area.component.html',
  styleUrls: ['./edit-area.component.scss']
})
export class EditAreaComponent {

  @Output()  AreaE:EventEmitter<any> = new EventEmitter  
  @Input () AREA_SELECTED: any;
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
  ){
    

  }

  ngOnInit(): void{
    this.getMunicipios();
    //llamar al constructor
    this.name = this.AREA_SELECTED.name;
    this.address = this.AREA_SELECTED.address;
    this.selectedMunicipio = this.AREA_SELECTED.municipio;

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
      //(error) => console.error('Error al obtener municipios', error)
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
    this.areaService.updateArea(this.AREA_SELECTED.id,data).subscribe((resp:any) => {  //devolucion del backend
    //this.isLoading$.next(false);
      console.log(resp);
      if (resp.message == 403){
        this.toast.error("validacion", resp.message_text);
      }else{
        this.toast.success("Exito", "El Area se edito correctamente");
        this.AreaE.emit(resp.area);
        this.modal.close();
      }
    })
  }


}
