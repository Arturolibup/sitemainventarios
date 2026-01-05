import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { UsersComponent } from './users.component';
import { ListUsersComponent } from './list-users/list-users.component';
import { AuthGuard } from '../auth/services/auth.guard';

const routes: Routes = [
  {
    path:'',
    component: UsersComponent,
    
    children:[
      {
        path:'list',
        canActivate: [AuthGuard],
        component: ListUsersComponent, data:{permission: 'users.list'}
      },
    ]

  }
];




@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UsersRoutingModule { }
