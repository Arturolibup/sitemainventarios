import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CarsComponent } from './cars.component';
import { ListCarComponent } from './list-car/list-car.component';
import { CreateCarComponent } from './create-car/create-car.component';
import { EditCarComponent } from './edit-car/edit-car.component';
import { DeleteCarComponent } from './delete-car/delete-car.component';
import { AuthGuard } from '../auth/services/auth.guard';

const routes: Routes = [

  {
      path: '',
      component: CarsComponent,
      children: [
        {
          path: 'list', // /car-entries
          canActivate: [AuthGuard],
          component: ListCarComponent, data: {permission: 'vehicles.list'}
        },
        {
          path: 'create', // /car-entries/create
          canActivate: [AuthGuard],
          component: CreateCarComponent, data: {permission: 'vehicles.create'}
        },
        {
          path: 'edit/:id', // /car-entries/edit/:id
          canActivate: [AuthGuard],
          component: EditCarComponent, data: {permission: 'vehicles.update'}
        },
        {
          path: 'delete/:id', // /car-entries/delete/:id
          canActivate: [AuthGuard],
          component: DeleteCarComponent, data:{permission: 'vehicles.delete'}
        },
      ]
  }

];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CarsRoutingModule { }
