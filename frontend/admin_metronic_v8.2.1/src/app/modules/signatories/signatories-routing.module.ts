import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '../auth/services/auth.guard';
import { ListSignaComponent } from './components/list-signa/list-signa.component';
import { SignatoriesComponent } from './signatories.component';

const routes: Routes =  [
  {
    path:'',
    component: SignatoriesComponent,
    
    children:[
      {
        path:'list',
        canActivate: [AuthGuard],
        component: ListSignaComponent, data:{permission: 'signatories.list'}
      },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SignatoriesRoutingModule {}
