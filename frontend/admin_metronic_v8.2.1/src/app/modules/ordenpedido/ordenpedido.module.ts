import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OrdenpedidoRoutingModule } from './ordenpedido-routing.module';
import { OrdenpedidoComponent } from './ordenpedido.component';
import { OpDeleteComponent } from './op-delete/op-delete.component';
import { OpEditComponent } from './op-edit/op-edit.component';
import { OpListComponent } from './op-list/op-list.component';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule, NgbModalModule, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { ToastrModule } from 'ngx-toastr';
import { OpCreateComponent } from './op-create/op-create.component';
import { CreateInvoiceFormComponent } from './create-invoice-form/create-invoice-form.component';
import { EditInvoiceFormComponent } from './edit-invoice-form/edit-invoice-form.component';
import { ListInvoiceFormComponent } from './list-invoice-form/list-invoice-form.component';
import { DeleteInvoiceFormComponent } from './delete-invoice-form/delete-invoice-form.component';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';


@NgModule({
  declarations: [
    
    OrdenpedidoComponent,
    OpDeleteComponent,
    OpEditComponent,
    OpListComponent,
    OpCreateComponent,
    
    CreateInvoiceFormComponent,
    EditInvoiceFormComponent,
    ListInvoiceFormComponent,
    DeleteInvoiceFormComponent

   
    
    
  ],
  imports: [
    CommonModule,
    RouterModule,
    OrdenpedidoRoutingModule,
    HttpClientModule,
    FormsModule,
    NgbModule,
    ReactiveFormsModule,
    InlineSVGModule,
    NgbModalModule,
    NgbPaginationModule,
    ToastrModule,
    SweetAlert2Module.forChild(),
    
    
    
  ]
})
export class OrdenpedidoModule { }
