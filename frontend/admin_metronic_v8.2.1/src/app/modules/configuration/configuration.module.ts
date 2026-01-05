import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ConfigurationRoutingModule } from './configuration-routing.module';
import { AreasModule } from './areas/areas.module';
import { SubareasModule } from './subareas/subareas.module';
import { ProductCategoriesModule } from './product-categories/product-categories.module';
import { ProvidersModule } from './providers/providers.module';
import { UnitsModule } from './units/units.module';


@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ConfigurationRoutingModule,
    AreasModule,
    SubareasModule,
    ProductCategoriesModule,
    ProvidersModule,
    UnitsModule
    
    
  ]
})
export class ConfigurationModule { }
