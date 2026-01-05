import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
import { AreaService } from '../service/area.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { EditAreaComponent } from '../edit-area/edit-area.component';
import { DeleteAreaComponent } from '../delete-area/delete-area.component';
import { CreateAreaComponent } from '../create-area/create-area.component';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-list-area',
  templateUrl: './list-area.component.html',
  styleUrls: ['./list-area.component.scss']
})

export class ListAreaComponent implements OnInit, AfterViewInit {

  search:string = '';
    
    AREAS:any = [];
    isLoading$: any;
    loading: boolean ;
    //loading: boolean = false;
    totalPages: number = 0;
    currentPage: number = 1;
  
  // Referencia al botón oculto en el HTML
  @ViewChild('refreshButton') refreshButton!: ElementRef<HTMLButtonElement>;

    constructor(
      public modalService: NgbModal,
      public areaService: AreaService,
      private cdr: ChangeDetectorRef,// Inyectamos ChangeDetectorRef
      private ngZone: NgZone
    ){
    
      
     }
   
     
    ngOnInit(): void {
      this.isLoading$ = this.areaService.isLoading$;
      this.listAreas();
    }
  
   listAreas(page = 1){
     this.areaService.listAreas(page,this.search).subscribe((resp:any) =>{
       console.log(resp);
       this.AREAS = resp.areas;
       this.totalPages = resp.total;
       this.currentPage = page;
       this.cdr.detectChanges();
     })
   }
  
   loadPage($event:any){
      this.listAreas($event);
   }
  
   createArea(){
     const modalRef = this.modalService.open(CreateAreaComponent, {centered:true,size: 'md'});
      modalRef.componentInstance.AreaC.subscribe((area:any) =>{
        this.AREAS.unshift(area); //unshift para que aparezca primero
        
      })
   } 
  
   
   editArea(AREA:any){
    const modalRef = this.modalService.open(EditAreaComponent, {centered:true,size: 'md'});
      modalRef.componentInstance.AREA_SELECTED = AREA;  // se envia a edit area mediante Input
       
      modalRef.componentInstance.AreaE.subscribe((area:any) =>{ //este output tiene que cambiar de valor en el compodente
        let INDEX = this.AREAS.findIndex((area:any)=> area.id == AREA.id); //en que posicion se encuentra el rol para editar
          if (INDEX!= -1){
            this.AREAS[INDEX] = area;
          }
        })
   }
    
   deleteArea(AREA:any){
    const modalRef = this.modalService.open(DeleteAreaComponent, {centered:true,size: 'md'});
      modalRef.componentInstance.AREA_SELECTED = AREA;
       
      modalRef.componentInstance.AreaD.subscribe((area:any) =>{
        let INDEX = this.AREAS.findIndex((area:any)=> area.id == AREA.id); //encontrar la posicion del rol a elimar
          if (INDEX!= -1){
            this.AREAS.splice(INDEX,1);  //eliminacion de un permiso ahora 
          }
        })
   }
  
   ngAfterViewInit(): void {
     setTimeout(() => {
       this.refreshButton.nativeElement.click();
       this.cdr.detectChanges();
     }, 100);
   }
  
  
  refreshAreas(): void {
    this.listAreas(); // Vuelve a cargar toda la lista de 

    console.log ("refreshAreas(), se ejecuta")
    this.search = ''; // Limpia el campo de búsqueda
    }



}
