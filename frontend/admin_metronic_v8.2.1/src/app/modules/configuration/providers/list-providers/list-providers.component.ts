import { Component } from '@angular/core';
import { ProvidersService } from '../service/providers.service';
import { CreateProvidersComponent } from '../create-providers/create-providers.component';
import { EditProvidersComponent } from '../edit-providers/edit-providers.component';
import { DeleteProvidersComponent } from '../delete-providers/delete-providers.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-list-providers',
  templateUrl: './list-providers.component.html',
  styleUrls: ['./list-providers.component.scss']
})
export class ListProvidersComponent {

search:string = '';
    PROVIDER_FULLNAME:any = [];
    isLoading$: any;

  
    totalPages: number = 0;
    currentPage: number = 1;
  
  
    constructor(
      public modalService: NgbModal,
      public providerService: ProvidersService,
  
    ){}
    
    ngOnInit(): void {
  
   //DE AQUI EN ADELANTA 
      this.isLoading$ = this.providerService.isLoading$;
      this.listProviders();
      
      }
  
   listProviders(page = 1){
     this.providerService.listProviders(page,this.search).subscribe((resp:any) =>{
       console.log(resp);
       this.PROVIDER_FULLNAME = resp.providers;
       this.totalPages = resp.total;
       this.currentPage = page;
     })
   }
  

   loadPage($event:any){
      this.listProviders($event);
   }
  
   createProvider(){
     const modalRef = this.modalService.open(CreateProvidersComponent,{centered:true,size: 'md'});
     
     modalRef.componentInstance.providerC.subscribe((providerfullname:any) =>{
       this.PROVIDER_FULLNAME.unshift(providerfullname); //unshift para que aparezca primero
       
      
      })
    } 
    
    
    editProvider(PROVIDER:any){
      const modalRef = this.modalService.open(EditProvidersComponent,{centered:true,size: 'md'});
      modalRef.componentInstance.PROVIDER_FULLNAME = PROVIDER;
      
       
      modalRef.componentInstance.providerE.subscribe((providerfullname:any) =>{
        let INDEX = this.PROVIDER_FULLNAME.findIndex((prov_name:any)=> prov_name.id == PROVIDER.id); //this.userS.unshift(user);
          if (INDEX!= -1){
            this.PROVIDER_FULLNAME[INDEX] = providerfullname;
          }
        })
   }
    
   deleteProvider(PROVIDER:any){
    const modalRef = this.modalService.open(DeleteProvidersComponent, {centered:true,size: 'md'});
      modalRef.componentInstance.PROVIDER_FULLNAME = PROVIDER;
       
      modalRef.componentInstance.providerD.subscribe((providerfullname:any) =>{
        let INDEX = this.PROVIDER_FULLNAME.findIndex((prov_name:any)=> prov_name.id == PROVIDER.id); 
          if (INDEX!= -1){
            this.PROVIDER_FULLNAME.splice(INDEX,1);  //eliminacion de un permiso
          }
        })
   }
  
  
  
  refreshProvider(): void {
    this.search = ''; // Limpia el campo de búsqueda
    this.listProviders(); // Vuelve a cargar toda la lista de users
    }

}
