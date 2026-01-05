import { Component } from '@angular/core';
import { UnitsService } from '../service/units.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CreateUnitsComponent } from '../create-units/create-units.component';
import { EditUnitsComponent } from '../edit-units/edit-units.component';
import { DeleteUnitsComponent } from '../delete-units/delete-units.component';
import { CreateTransformsUnitsComponent } from '../create-transforms-units/create-transforms-units.component';

@Component({
  selector: 'app-list-units',
  templateUrl: './list-units.component.html',
  styleUrls: ['./list-units.component.scss']
})
  export class ListUnitsComponent {
    search:string = '';
    UNIT_FULL:any = [];
    isLoading$: any;

  
    totalPages: number = 0;
    currentPage: number = 1;
  
  
    constructor(
      public modalService: NgbModal,
      public unitService: UnitsService,
  
    ){}
    
    ngOnInit(): void {
  
   //DE AQUI EN ADELANTA 
      this.isLoading$ = this.unitService.isLoading$;
      this.listUnits();
      
      }
  
      listUnits(page = 1){
      this.unitService.listUnits(page,this.search).subscribe((resp:any) =>{
       console.log(resp);
       this.UNIT_FULL = resp.units;
       this.totalPages = resp.total;
       this.currentPage = page;
     })
   }
  

   loadPage($event:any){
      this.listUnits($event);
   }
  
   createunit(){
     const modalRef = this.modalService.open(CreateUnitsComponent,{centered:true,size: 'md'});
     
     modalRef.componentInstance.UnitC.subscribe((unit_var:any) =>{
       this.UNIT_FULL.unshift(unit_var); //unshift para que aparezca primero
       
      
      })
    } 
    
    
    editunit(UNIT:any){
      const modalRef = this.modalService.open(EditUnitsComponent,{centered:true,size: 'md'});
      modalRef.componentInstance.UNIT_FULL = UNIT;
      
       
      modalRef.componentInstance.UnitE.subscribe((unit_var_otra:any) =>{
        let INDEX = this.UNIT_FULL.findIndex((unit_var:any)=> unit_var.id == UNIT.id); 
          if (INDEX!= -1){
            this.UNIT_FULL[INDEX] = unit_var_otra;
          }
        })
   }
    
   deleteunit(UNIT:any){
    const modalRef = this.modalService.open(DeleteUnitsComponent, {centered:true,size: 'md'});
      modalRef.componentInstance.UNIT_FULL = UNIT;
       
      modalRef.componentInstance.UnitD.subscribe((providerfullname:any) =>{
        let INDEX = this.UNIT_FULL.findIndex((unit_var:any)=> unit_var.id == UNIT.id); 
          if (INDEX!= -1){
            this.UNIT_FULL.splice(INDEX,1);  //eliminacion de un permiso
          }
        })
   }
  
   addtransform(UNIT:any){ //ver la ventana.
    const modalRef = this.modalService.open(CreateTransformsUnitsComponent, {centered:true,size: 'md'});
      modalRef.componentInstance.UNIT_FULL = UNIT; // pasar la unidad que se ha seleccionado.
      modalRef.componentInstance.UNITS = this.UNIT_FULL.filter((unit:any)=> unit.id != UNIT.id); //pasamos de unit_full la lista que tenemos hasta el momento
   }
  
  refreshunit(): void {
    this.search = ''; // Limpia el campo de búsqueda
    this.listUnits(); // Vuelve a cargar toda la lista de users
    }
}
