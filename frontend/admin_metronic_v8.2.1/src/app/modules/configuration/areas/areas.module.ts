import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AreasRoutingModule } from './areas-routing.module';
import { AreasComponent } from './areas.component';
import { CreateAreaComponent } from './create-area/create-area.component';
import { EditAreaComponent } from './edit-area/edit-area.component';
import { DeleteAreaComponent } from './delete-area/delete-area.component';
import { ListAreaComponent } from './list-area/list-area.component';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule, NgbModalModule, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { InlineSVGModule } from 'ng-inline-svg-2';


@NgModule({
  declarations: [
    AreasComponent,
    CreateAreaComponent,
    EditAreaComponent,
    DeleteAreaComponent,
    ListAreaComponent

    
  ],
  imports: [
    CommonModule,
    AreasRoutingModule,
    HttpClientModule,
    FormsModule,
    NgbModule,
    ReactiveFormsModule,
    InlineSVGModule,
    NgbModalModule,
    NgbPaginationModule,
  ]
})
export class AreasModule { }
