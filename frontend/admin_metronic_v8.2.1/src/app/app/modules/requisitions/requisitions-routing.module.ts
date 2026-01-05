import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RequisitionsComponent } from './requisitions.component';
import { MyRequisitionsListComponent } from './pages/my-requisitions-list/my-requisitions-list.component';
import { RequisitionCreateComponent } from './pages/requisition-create/requisition-create.component';
import { RequisitionApproveComponent } from './pages/requisition-approve/requisition-approve.component';
import { AuthGuard } from 'src/app/modules/auth/services/auth.guard';
import { RequisitionApproveListComponent } from './pages/requisition-approve-list/requisition-approve-list.component';
import { RequisitionCallListComponent } from './pages/requisition-call-list/requisition-call-list.component';
import { RequisitionCallsCreateComponent } from './pages/requisition-call-create/requisition-call-create.component';




const routes: Routes = [
  {
    path: '', 
    component: RequisitionsComponent,
    children: [ 
      { path: '', redirectTo: 'requisitions', pathMatch: 'full' },
      
      //requisiciones del usuario
      {
        path: 'my',
        component: MyRequisitionsListComponent,
        canActivate: [AuthGuard],
        data: { roles: ['Super-Admin', 'Almacen','Areas'] }
      },
      
      //crear / editar requisicion
      {
        path: 'create',
        component: RequisitionCreateComponent,
        canActivate: [AuthGuard],
        data: { roles: ['Super-Admin', 'Almacen'] }
      },

      {
        path: 'create/:id',
        component: RequisitionCreateComponent,
        canActivate: [AuthGuard],
        data: { roles: ['Super-Admin', 'Almacen','Areas'] }
      },

      //lista para aprobar requisiciones
      {
        path: 'approve',
        component: RequisitionApproveListComponent,
        canActivate: [AuthGuard],
        data: { roles: ['Super-Admin', 'Almacen'] }
      },
      {
        path: 'approve/:id',
        component: RequisitionApproveComponent,
        canActivate: [AuthGuard],
        data: { roles: ['Super-Admin', 'Almacen'] }
      },
      {
        path: 'requisitions/detail/:id',
        component: RequisitionApproveComponent,
        canActivate: [AuthGuard],
        data: { roles: ['Super-Admin', 'Almacen'] }
      },

      //convocatorias
      {
        path: 'calls',
        component: RequisitionCallListComponent,
        canActivate: [AuthGuard],
        data: { roles: ['Super-Admin', 'Almacen','Areas'] }
      },

      {
        path: 'calls/create',
        component: RequisitionCallsCreateComponent,
        canActivate: [AuthGuard],
        data: { roles: ['Super-Admin', 'Almacen'] }
      },

      {
        path: 'calls/create/:id',
        component: RequisitionCallsCreateComponent,
        canActivate: [AuthGuard],
        data: { roles: ['Super-Admin', 'Almacen'] }
      },
      

      
    ]
  }
];
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RequisitionsRoutingModule { }


