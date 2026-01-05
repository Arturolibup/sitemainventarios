import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ListRolesComponent } from './list-roles/list-roles.component';
import { RolesComponent } from './roles.component';
import { AuthGuard } from '../auth/services/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: RolesComponent,
    children: [
      {
        path: 'list',
        component: ListRolesComponent, 
        canActivate: [AuthGuard],
        data:{permission:'roles.list'}},
     
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RolesRoutingModule { }
