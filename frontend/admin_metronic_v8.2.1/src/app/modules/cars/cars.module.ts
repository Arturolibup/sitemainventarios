import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { CarsRoutingModule } from './cars-routing.module';
import { CarsComponent } from './cars.component';
import { CreateCarComponent } from './create-car/create-car.component';
import { EditCarComponent } from './edit-car/edit-car.component';
import { ListCarComponent } from './list-car/list-car.component';
import { DeleteCarComponent } from './delete-car/delete-car.component';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule, NgbModalModule, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { ToastrModule } from 'ngx-toastr';


@NgModule({
  declarations: [
    CarsComponent,
    CreateCarComponent,
    EditCarComponent,
    ListCarComponent,
    DeleteCarComponent,
  ],
  imports: [
    CommonModule,
    CarsRoutingModule,
    HttpClientModule,
    FormsModule,
    NgbModule,
    ReactiveFormsModule,
    InlineSVGModule,
    NgbModalModule,
    NgbPaginationModule,
    ToastrModule,
  ]
})
export class CarsModule { }
