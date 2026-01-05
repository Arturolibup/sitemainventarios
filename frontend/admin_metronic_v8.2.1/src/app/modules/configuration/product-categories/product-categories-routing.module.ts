import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ProductCategoriesComponent } from './product-categories.component';
import { ListProductCategorieComponent } from './list-product-categorie/list-product-categorie.component';
import { AuthGuard } from '../../auth/services/auth.guard';

const routes: Routes = [
  {
    path:'',
    component: ProductCategoriesComponent,
    children:[
      {
      path: 'list',
      component: ListProductCategorieComponent,
      canActivate:[AuthGuard],
      data: {permission: 'categories.list'}
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ProductCategoriesRoutingModule { }
