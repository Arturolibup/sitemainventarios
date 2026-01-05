import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ProductCategoriesRoutingModule } from './product-categories-routing.module';
import { ProductCategoriesComponent } from './product-categories.component';
import { CreateProductCategorieComponent } from './create-product-categorie/create-product-categorie.component';
import { DeleteProductCategorieComponent } from './delete-product-categorie/delete-product-categorie.component';
import { EditProductCategorieComponent } from './edit-product-categorie/edit-product-categorie.component';
import { ListProductCategorieComponent } from './list-product-categorie/list-product-categorie.component';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule, NgbModalModule, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { InlineSVGModule } from 'ng-inline-svg-2';


@NgModule({
  declarations: [
    ProductCategoriesComponent,
    CreateProductCategorieComponent,
    DeleteProductCategorieComponent,
    EditProductCategorieComponent,
    ListProductCategorieComponent,
  ],
  imports: [
    CommonModule,
    ProductCategoriesRoutingModule,
    
    HttpClientModule,
    FormsModule,
    NgbModule,
    ReactiveFormsModule,
    InlineSVGModule,
    NgbModalModule,
    NgbPaginationModule,
  ]
})
export class ProductCategoriesModule { }
