import { Component } from '@angular/core';
import { CreateUserComponent } from '../create-user/create-user.component';
import { EditUserComponent } from '../edit-user/edit-user.component';
import { DeleteUserComponent } from '../delete-user/delete-user.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { UsersService } from '../service/users.service';



@Component({
  selector: 'app-list-user',
  templateUrl: './list-users.component.html',
  styleUrls: ['./list-users.component.scss']
})
export class ListUsersComponent {

    search:string = '';
    USERS:any = [];
    isLoading$: any;

    loading: boolean;
    roles: any = [];
    totalPages: number = 0;
    currentPage: number = 1;
  
  
    constructor(
      public modalService: NgbModal,
      public usersService: UsersService,
  
    ){}
    
      
     
  
    ngOnInit(): void {
  
   //DE AQUI EN ADELANTA 
      this.isLoading$ = this.usersService.isLoading$;
      this.listUsers();
      this.configAll();
      }
  
   listUsers(page = 1){
     this.usersService.listUsers(page,this.search).subscribe((resp:any) =>{
       console.log(resp);
       this.USERS = resp.users;
       this.totalPages = resp.total;
       this.currentPage = page;
     })
   }
  

   configAll(){
    this.usersService.configAll().subscribe((resp:any) =>{
      console.log(resp);
      this.roles = resp.roles;
    })
   }


   loadPage($event:any){
      this.listUsers($event);
   }
  
   createUser(){
     const modalRef = this.modalService.open(CreateUserComponent,{centered:true,size: 'lg'});
      modalRef.componentInstance.roles = this.roles; //pasar los roles al momento de crear
     
     modalRef.componentInstance.UserC.subscribe((user:any) =>{
       this.USERS.unshift(user); //unshift para que aparezca primero
       
      
      })
    } 
    
    
    editUser(USER:any){
      const modalRef = this.modalService.open(EditUserComponent,{centered:true,size: 'lg'});
      modalRef.componentInstance.USER_SELECTED = USER;
      modalRef.componentInstance.roles = this.roles;
       
      modalRef.componentInstance.UserE.subscribe((user:any) =>{
        let INDEX = this.USERS.findIndex((user:any)=> user.id == USER.id); //this.userS.unshift(user);
          if (INDEX!= -1){
            this.USERS[INDEX] = user;
          }
        })
   }
    
   deleteUser(USER:any){
    const modalRef = this.modalService.open(DeleteUserComponent, {centered:true,size: 'lg'});
      modalRef.componentInstance.USER_SELECTED = USER;
       
      modalRef.componentInstance.UserD.subscribe((user:any) =>{
        let INDEX = this.USERS.findIndex((user:any)=> user.id == USER.id); 
          if (INDEX!= -1){
            this.USERS.splice(INDEX,1);  //eliminacion de un permiso
          }
        })
   }
  
   // AGREGAR ESTE MÉTODO:
  openCha(user: any) {
    console.log('Abrir chat con usuario:', user);
    
    // Buscar el componente MessengerDrawerComponent en el DOM
    const messengerDrawer = document.querySelector('app-messenger-drawer') as any;
    
    if (messengerDrawer && messengerDrawer.openDrawer) {
      messengerDrawer.openDrawer(user.id);
    } else {
      console.error('No se encontró el componente MessengerDrawer');
      // Alternativa: usar un servicio para comunicación entre componentes
    }
  }

  // En list-users.component.ts
openChat(user: any) {
  console.log('💬 Abriendo chat con usuario:', user);
  
  // Método 1: Usando la función global
  if ((window as any).openChatDrawer) {
    (window as any).openChatDrawer(user.id);
  } else {
    console.error('❌ No se pudo encontrar el drawer de chat');
    // Método alternativo: usar el servicio de chat directamente
    // this.chatService.joinRoom(this.currentUserId, user.id);
  }
}

  
  
  refreshUser(): void {
    this.search = ''; // Limpia el campo de búsqueda
    this.listUsers(); // Vuelve a cargar toda la lista de users
    }
}
