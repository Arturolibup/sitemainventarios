import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { RequisitionsRoutingModule } from './requisitions-routing.module';
import { RequisitionsComponent } from './requisitions.component';
import { RequisitionCallListComponent } from './pages/requisition-call-list/requisition-call-list.component';
import { RequisitionCallsCreateComponent } from './pages/requisition-call-create/requisition-call-create.component';
import { MyRequisitionsListComponent } from './pages/my-requisitions-list/my-requisitions-list.component';
import { RequisitionCreateComponent } from './pages/requisition-create/requisition-create.component';
import { RequisitionApproveListComponent } from './pages/requisition-approve-list/requisition-approve-list.component';
import { RequisitionApproveComponent } from './pages/requisition-approve/requisition-approve.component';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule, NgbModalModule, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { SweetAlert2Module } from '@sweetalert2/ngx-sweetalert2';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { ToastrModule } from 'ngx-toastr';
import { NumberFormatDirective } from 'src/app/directives/number-format.directive';


@NgModule({
  declarations: [
    MyRequisitionsListComponent,
    RequisitionApproveComponent,
    RequisitionApproveListComponent,
    RequisitionCallsCreateComponent,
    RequisitionCallListComponent,
    RequisitionsComponent,
    RequisitionCreateComponent,
    NumberFormatDirective,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RequisitionsRoutingModule,
    HttpClientModule,
    NgbModule,
    InlineSVGModule,
    NgbModalModule,
    NgbPaginationModule,
    ToastrModule,
    SweetAlert2Module.forChild(),
  ],

    exports: [NumberFormatDirective]
    
})
export class RequisitionsModule { }
