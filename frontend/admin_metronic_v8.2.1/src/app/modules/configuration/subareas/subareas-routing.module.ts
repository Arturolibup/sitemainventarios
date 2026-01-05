import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SubareasComponent } from './subareas.component';
import { ListSubareaComponent } from './list-subarea/list-subarea.component';
import { AuthGuard } from '../../auth/services/auth.guard';

const routes: Routes = [{

  path: "",
  component: SubareasComponent,
  children:[
    {
      path:"list",
      component: ListSubareaComponent,
      canActivate: [AuthGuard],
      data:{permission:'subareas.list'}
    },
  ]
}];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SubareasRoutingModule { }
