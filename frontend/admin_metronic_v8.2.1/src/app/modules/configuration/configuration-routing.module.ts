import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '../auth/services/auth.guard';

const routes: Routes = [
  {
    path: 'areas',
    canActivate: [AuthGuard],
    data: { permission: 'areas.list' }, // Permiso para ver áreas
    loadChildren: () => import('./areas/areas.module').then((m) => m.AreasModule),
  },
  {
    path: 'subareas',
    canActivate: [AuthGuard],
    data: { permission: 'subareas.list' }, // Permiso para ver subáreas
    loadChildren: () => import('./subareas/subareas.module').then((m) => m.SubareasModule),
  },
  {
    path: 'categoria-de-productos',
    canActivate: [AuthGuard],
    data: { permission: 'categories.list' }, // Permiso para ver categorías
    loadChildren: () => import('./product-categories/product-categories.module').then((m) => m.ProductCategoriesModule),
  },
  {
    path: 'proveedores',
    canActivate: [AuthGuard],
    data: { permission: 'providers.list' }, // Permiso para ver proveedores
    loadChildren: () => import('./providers/providers.module').then((m) => m.ProvidersModule),
  },
  {
    path: 'unidades',
    canActivate: [AuthGuard],
    data: { permission: 'units.list' }, // Permiso para ver unidades
    loadChildren: () => import('./units/units.module').then((m) => m.UnitsModule),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ConfigurationRoutingModule { }
