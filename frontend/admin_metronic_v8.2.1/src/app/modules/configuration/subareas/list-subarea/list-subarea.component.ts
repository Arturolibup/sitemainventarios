import { ChangeDetectorRef, Component } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SubareaService } from '../service/subarea.service';
import { CreateSubareaComponent } from '../create-subarea/create-subarea.component';
import { EditSubareaComponent } from '../edit-subarea/edit-subarea.component';
import { DeleteSubareaComponent } from '../delete-subarea/delete-subarea.component';
import Swal from 'sweetalert2';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-list-subarea',
  templateUrl: './list-subarea.component.html',
  styleUrls: ['./list-subarea.component.scss']
})
export class ListSubareaComponent {

    search:string = '';
    subareas:any = [];
    areasnom:any = []; //aqui estan las areas iterables
    isLoading$: any;
    isLoading: boolean = false;
    
    //loading: boolean = false;
    totalPages: number = 0;
    currentPage: number = 1;
    isVisible: any;
  
  // Referencia al botón oculto en el HTML
  

    constructor(
      public modalService: NgbModal,
      public subareaService: SubareaService,
      private cdr: ChangeDetectorRef,// Inyectamos ChangeDetectorRef
      
    )
      
     {}
   
     
    ngOnInit(): void {
      this.listSubareas();
      this.subareaService.isLoading$.subscribe(isLoading => {
        this.isLoading = this.isLoading$;
        this.cdr.detectChanges();
      });
    }
  
    listSubareas(page = 1) {
      this.subareaService.listSubareas(page, this.search).subscribe((resp: any) => {
        console.log("Respuesta de la API:", resp); // Agrega este console.log para depuración
        this.subareas = resp.subareas;
        this.totalPages = resp.total;
        this.currentPage = page;
        this.areasnom = resp.areas;
        console.log ('areas  : ', this.areasnom)
        console.log ('subareas  : ', this.subareas)
        this.cdr.detectChanges();
      }, error => {
        console.error("Error en la API:", error);
        this.subareas= [];
        this.areasnom= [];
        this.totalPages = 0;
        this.cdr.detectChanges();
        Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar las subáreas. Verifica la conexión al servidor.',
        confirmButtonText: 'Aceptar',
        customClass: { confirmButton: 'btn btn-danger' }
      });
      });
    }
  
   loadPage($event:any){
      this.listSubareas($event);
   }
  
   createSubarea() {
    //this.isVisible = true;
    //this.cdr.detectChanges(); // 🔥 Fuerza la actualización
  
    const modalRef = this.modalService.open(CreateSubareaComponent, {
      centered: true,
      size: 'md',
    });
  
    modalRef.componentInstance.areasnom = this.areasnom;
  
    modalRef.componentInstance.SubareaC.subscribe((subarea: any) => {
      this.subareas.unshift(subarea);
    });
  }
  
   
   editSubarea(subarea:any){
    const modalRef = this.modalService.open(EditSubareaComponent, {centered:true,size: 'md'});
      modalRef.componentInstance.SUBAREA_SELECTED = subarea;  // se envia a edit area mediante Input
      modalRef.componentInstance.areasnom = this.areasnom;

      modalRef.componentInstance.SubareaE.subscribe((subarea:any) =>{ //este output tiene que cambiar de valor en el compodente
        let INDEX = this.subareas.findIndex((area:any)=> area.id == subarea.id); //en que posicion se encuentra el rol para editar
          if (INDEX!= -1){
            this.subareas[INDEX] = subarea;
          }
        })
   }
    
   deleteSubarea(subarea:any){
    const modalRef = this.modalService.open(DeleteSubareaComponent, {centered:true,size: 'md'});
      modalRef.componentInstance.SUBAREA_SELECTED = subarea;
       
      modalRef.componentInstance.SubareaD.subscribe((area:any) =>{
        let INDEX = this.subareas.findIndex((area:any)=> area.id == subarea.id); //encontrar la posicion del rol a elimar
          if (INDEX!= -1){
            this.subareas.splice(INDEX,1);  //eliminacion de un permiso ahora 
          }
        })
   }
  
   ngAfterViewInit(): void {
     setTimeout(() => {
       
       this.cdr.detectChanges();
     }, 100);
   }
  
  
  refreshSubareas(): void {
    this.listSubareas(); // Vuelve a cargar toda la lista de 

    console.log ("refreshSubareas(), se ejecuta")
    this.search = ''; // Limpia el campo de búsqueda
    }
}
