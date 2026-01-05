import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { OpEditComponent } from './op-edit/op-edit.component';
import { OpListComponent } from './op-list/op-list.component';
import { OpDeleteComponent } from './op-delete/op-delete.component';
import { OrdenpedidoComponent } from './ordenpedido.component';
import { OpCreateComponent } from './op-create/op-create.component';
import { ListInvoiceFormComponent } from './list-invoice-form/list-invoice-form.component';
import { CreateInvoiceFormComponent } from './create-invoice-form/create-invoice-form.component';
import { AuthGuard } from '../auth/services/auth.guard';
import { OpReceiveComponent } from './op-receive/op-receive.component';
import { OpReceiveListComponent } from './op-receive-list/op-receive-list.component';


const routes: Routes = [
  {
    path: '',
    component: OrdenpedidoComponent,
    children: [
      { path: '', redirectTo: 'oplist', pathMatch: 'full' },

      { path: 'oplist', component: OpListComponent, 
        canActivate:[AuthGuard], 
        data:{permission:'orders.list'}},

  
// Create Suficiencia (Área 1)
      { path: 'opcreate', component: OpCreateComponent,
        canActivate:[AuthGuard], 
        data:{anyPermission:['orders.create_sf','invoices.create']}}, // ?mode=create_sf

      // Reusar create para validar/recibir usando query param ?mode=validate|validate_sf|receive
      { path: 'opcreate/:id', component: OpCreateComponent, 
        canActivate:[AuthGuard],
        data:{anyPermission:['orders.add_order_number','orders.assign_partidas','orders.receive','orders.update']}
      },

      // Edit dedicado
      { path: 'opedit/:id', component: OpEditComponent,
        canActivate:[AuthGuard], 
        data:{permission:'orders.update'}},

      // Delete (siempre con id)
      { path: 'opdelete/:id', component: OpDeleteComponent,
        canActivate:[AuthGuard], 
        data:{permission:'orders.delete'} 
      },

      // Invoices
      // invoices del módulo OP
      { path: 'invoices/:order_request_id', component: CreateInvoiceFormComponent,
        canActivate:[AuthGuard], 
        data: { permission: 'invoices.create' } 
      },

      { path: 'invoices', component: ListInvoiceFormComponent,
        canActivate:[AuthGuard], 
        data: { permission: 'invoices.list' } 
      },

      // app-routing (o routes de ordenpedido)
      { path: 'receive/:id', 
        component: OpReceiveComponent },           // detalle recepción
      
        // opcional:
      { path: 'op-receive-list', 
        component: OpReceiveListComponent }, 

      
    ]
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class OrdenpedidoRoutingModule { }
