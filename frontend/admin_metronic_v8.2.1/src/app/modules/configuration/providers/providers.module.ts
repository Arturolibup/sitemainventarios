import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ProvidersRoutingModule } from './providers-routing.module';
import { ProvidersComponent } from './providers.component';
import { CreateProvidersComponent } from './create-providers/create-providers.component';
import { EditProvidersComponent } from './edit-providers/edit-providers.component';
import { DeleteProvidersComponent } from './delete-providers/delete-providers.component';
import { ListProvidersComponent } from './list-providers/list-providers.component';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule, NgbModalModule, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { InlineSVGModule } from 'ng-inline-svg-2';


@NgModule({
  declarations: [
    ProvidersComponent,
    CreateProvidersComponent,
    EditProvidersComponent,
    DeleteProvidersComponent,
    ListProvidersComponent
  ],
  imports: [
    CommonModule,
    ProvidersRoutingModule,
    HttpClientModule,
    FormsModule,
    NgbModule,
    ReactiveFormsModule,
    InlineSVGModule,
    NgbModalModule,


    NgbPaginationModule,
  ]
})
export class ProvidersModule { }
