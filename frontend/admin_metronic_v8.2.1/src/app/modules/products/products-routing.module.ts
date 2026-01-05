import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProductsComponent } from './products.component';
import { ListProductComponent } from './list-product/list-product.component';
import { CreateProductComponent } from './create-product/create-product.component';
import { EditProductComponent } from './edit-product/edit-product.component';
import { AuthGuard } from '../auth/services/auth.guard';

const routes: Routes = [
  {
    path:"",
    component: ProductsComponent,
    children:[
      {
        path:"list",
        canActivate: [AuthGuard],
        component: ListProductComponent,
        data: { breadcrumb: 'Listado', permission: 'products.list'  },
        

      },
      {
        path:'registro',
        canActivate: [AuthGuard],
        component: CreateProductComponent,
        data: { breadcrumb: 'Registro de Productos', permission: 'products.create' },
        
      },
      {
        path:'list/editar/:id',
        canActivate: [AuthGuard],
        component: EditProductComponent,
        data: { breadcrumb: 'Edición de Productos', permission: 'products.update'},
        
      },
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProductsRoutingModule { }
