import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProductComponent } from './product.component';
import { ListProductComponent } from './list-product/list-product.component';
import { CreateProductComponent } from './create-product/create-product.component';
import { EditProductComponent } from './edit-product/edit-product.component';
import { DeleteProductComponent } from './delete-product/delete-product.component';
import { CreatePurchaseDocumentsComponent } from './create-purchase-documents/create-purchase-documents.component';
import { ListPurchaseDocumentsComponent } from './list-purchase-documents/list-purchase-documents.component';
import { DeletePurchaseDocumentsComponent } from './delete-purchase-documents/delete-purchase-documents.component';
import { EditPurchaseDocumentsComponent } from './edit-purchase-documents/edit-purchase-documents.component';
import { ProductExitCreateComponent } from './product-exit-create/product-exit-create.component';
import { ProductExitListComponent } from './product-exit-list/product-exit-list.component';
import { ProductExitEditComponent } from './product-exit-edit/product-exit-edit.component';
import { AuthGuard } from '../auth/services/auth.guard';

const routes: Routes = [

  {
    path: '',
    component: ProductComponent,
    children: [
      {
        path: 'list', // /product-entries
        canActivate: [AuthGuard],
        component: ListProductComponent, data: {permission: 'product_entries.list'}
      },
      {
        path: 'create', // /product_entries/create
        canActivate: [AuthGuard],
        component: CreateProductComponent, data: {permission: 'product_entries.create'}
      },
      {
        path: 'edit/:id', // /product_entries/edit/:id
        canActivate: [AuthGuard],
        component: EditProductComponent, data: {permission: 'product_entries.update'}
      },
      {
        path: 'delete/:id', // /product_entries/delete/:id
        canActivate: [AuthGuard],
        component: DeleteProductComponent, data: {permission: 'product_entries.delete'}
      },
      {
        path: 'create-purchase-documents', 
        canActivate: [AuthGuard],
        component: CreatePurchaseDocumentsComponent,data: {permission: 'product_entries.create'}
      },
      //{
        //path: 'list-purchase-documents/:entryId',
        //component: ListPurchaseDocumentsComponent,
      //},
      {
        path: 'delete-purchase-document/:documentId',
        canActivate: [AuthGuard],
        component: DeletePurchaseDocumentsComponent, 
        data: {permission: 'product_entries.delete'}
      },
      {
        path: 'edit-purchase-document/:id',
        canActivate: [AuthGuard],
        component: EditPurchaseDocumentsComponent, 
        data: {permission: 'product_entries.update'}
      },

      { 
        path: 'list-purchase-documents/:id', 
        canActivate: [AuthGuard],
        component: ListPurchaseDocumentsComponent, 
        data: {permission: 'product_entries.list'}
      },
      
      
      
        {
        path: 'product-exits',
        canActivate: [AuthGuard],
        children: [
            { path: 'create', component: ProductExitCreateComponent, 
              data: {permission: 'product_exits.create'}},
            { path: 'list', component: ProductExitListComponent, 
              data: {permission: 'product_exits.list'}},
            { path: 'edit/:id', component: ProductExitEditComponent, 
              data: {permission: 'product_exits.update'}},
            //{ path: '', redirectTo: 'list', pathMatch: 'full' }
        ]
    }


    ]
  }
];




@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProductRoutingModule { }
