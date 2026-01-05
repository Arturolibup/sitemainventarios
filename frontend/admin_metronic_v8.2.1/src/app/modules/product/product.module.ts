import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ProductRoutingModule } from './product-routing.module';
import { ProductComponent } from './product.component';
import { CreateProductComponent } from './create-product/create-product.component';
import { DeleteProductComponent } from './delete-product/delete-product.component';
import { EditProductComponent } from './edit-product/edit-product.component';
import { ListProductComponent } from './list-product/list-product.component';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule, NgbModalModule, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { CreatePurchaseDocumentsComponent } from './create-purchase-documents/create-purchase-documents.component';
import { ListPurchaseDocumentsComponent } from './list-purchase-documents/list-purchase-documents.component';
import { EditPurchaseDocumentsComponent } from './edit-purchase-documents/edit-purchase-documents.component';
import { DeletePurchaseDocumentsComponent } from './delete-purchase-documents/delete-purchase-documents.component';
import { ProductExitCreateComponent } from './product-exit-create/product-exit-create.component';
import { ProductExitListComponent } from './product-exit-list/product-exit-list.component';
import { ToastrModule } from 'ngx-toastr';
import { ProductExitEditComponent } from './product-exit-edit/product-exit-edit.component';
//import { AppRoutingModule } from 'src/app/app-routing.module';


@NgModule({
  declarations: [
    ProductComponent,
    CreateProductComponent,
    DeleteProductComponent,
    EditProductComponent,
    ListProductComponent,
    CreatePurchaseDocumentsComponent,
    ListPurchaseDocumentsComponent,
    EditPurchaseDocumentsComponent,
    DeletePurchaseDocumentsComponent,
    ProductExitCreateComponent,
    ProductExitListComponent,
    ProductExitEditComponent
  ],
  imports: [
    CommonModule,
    ProductRoutingModule,
    HttpClientModule,
    FormsModule,
    NgbModule,
    ReactiveFormsModule,
    InlineSVGModule,
    NgbModalModule,
    NgbPaginationModule,
    ToastrModule,
    //AppRoutingModule,


    
 
  ],
    //providers: [ProductService]
})
export class ProductModule { }
