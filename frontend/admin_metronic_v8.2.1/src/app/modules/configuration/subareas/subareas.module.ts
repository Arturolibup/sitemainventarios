import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SubareasRoutingModule } from './subareas-routing.module';
import { SubareasComponent } from './subareas.component';
import { CreateSubareaComponent } from './create-subarea/create-subarea.component';
import { DeleteSubareaComponent } from './delete-subarea/delete-subarea.component';
import { EditSubareaComponent } from './edit-subarea/edit-subarea.component';
import { ListSubareaComponent } from './list-subarea/list-subarea.component';
import { HttpClientModule } from '@angular/common/http';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule, NgbModalModule, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { InlineSVGModule } from 'ng-inline-svg-2';


@NgModule({
  declarations: [
    SubareasComponent,
    CreateSubareaComponent,
    DeleteSubareaComponent,
    EditSubareaComponent,
    ListSubareaComponent
  ],
  imports: [
    CommonModule,
    SubareasRoutingModule,
    HttpClientModule,
    FormsModule,
    NgbModule,
    ReactiveFormsModule,
    InlineSVGModule,
    NgbModalModule,
    NgbPaginationModule,


  ]
})
export class SubareasModule { }
