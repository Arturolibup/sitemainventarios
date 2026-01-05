import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AreasComponent } from './areas.component';
import { ListAreaComponent } from './list-area/list-area.component';
import { AuthGuard } from '../../auth/services/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: AreasComponent,
    children:[
      {
        path: 'list',
        component : ListAreaComponent,
        canActivate:[AuthGuard],
        data: {permission: 'areas.list'}
      }
    ]
  }
];



@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AreasRoutingModule { }
