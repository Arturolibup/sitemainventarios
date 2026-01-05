import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SignatoriesRoutingModule } from './signatories-routing.module';
import { CreateSignaComponent } from './components/create-signa/create-signa.component';
import { ListSignaComponent } from './components/list-signa/list-signa.component';
import { EditSignaComponent } from './components/edit-signa/edit-signa.component';
import { DeleteSignaComponent } from './components/delete-signa/delete-signa.component';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule, NgbModalModule, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { SignatoriesComponent } from './signatories.component';


@NgModule({
  declarations: [
    SignatoriesComponent,
    CreateSignaComponent,
    ListSignaComponent,
    EditSignaComponent,
    DeleteSignaComponent
  ],
  imports: [
    CommonModule,
    SignatoriesRoutingModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    NgbModalModule,
    NgbPaginationModule,
    InlineSVGModule
  ]
})
export class SignatoriesModule { }
