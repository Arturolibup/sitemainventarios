import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { RolesRoutingModule } from './roles-routing.module';
import { CreateRolesComponent } from './create-roles/create-roles.component';
import { RolesComponent } from './roles.component';
import { EditRolesComponent } from './edit-roles/edit-roles.component';
import { DeleteRolesComponent } from './delete-roles/delete-roles.component';
import { ListRolesComponent } from './list-roles/list-roles.component';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule, NgbModalModule, NgbPaginationModule, NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap';
import { InlineSVGModule } from 'ng-inline-svg-2';


@NgModule({
  declarations: [
    CreateRolesComponent,
    RolesComponent,
    EditRolesComponent,
    DeleteRolesComponent,
    ListRolesComponent
  ],
  imports: [
    CommonModule,
    RolesRoutingModule,
    HttpClientModule,
    FormsModule,
    NgbModule,
    ReactiveFormsModule,
    InlineSVGModule,
    NgbModalModule,
    NgbPaginationModule,
    NgbAccordionModule
  ]
})
export class RolesModule { }
