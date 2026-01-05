import { Routes } from '@angular/router';

const Routing: Routes = [
  {
    path: 'dashboard',
    loadChildren: () => import('./dashboard/dashboard.module').then((m) => m.DashboardModule),
  },
  {
    path: 'builder',
    loadChildren: () => import('./builder/builder.module').then((m) => m.BuilderModule),
  },
  {
    path: 'crafted/pages/profile',
    loadChildren: () => import('../modules/profile/profile.module').then((m) => m.ProfileModule),
    // data: { layout: 'light-sidebar' },
  },
  {
    path: 'crafted/account',
    loadChildren: () => import('../modules/account/account.module').then((m) => m.AccountModule),
    // data: { layout: 'dark-header' },
  },
  {
    path: 'crafted/pages/wizards',
    loadChildren: () => import('../modules/wizards/wizards.module').then((m) => m.WizardsModule),
    // data: { layout: 'light-header' },
  },
  {
    path: 'crafted/widgets',
    loadChildren: () => import('../modules/widgets-examples/widgets-examples.module').then((m) => m.WidgetsExamplesModule),
    // data: { layout: 'light-header' },
  },
  /*
  {
    path: 'apps/chat',
    loadChildren: () => import('../modules/apps/chat/chat.module').then((m) => m.ChatModule),
    // data: { layout: 'light-sidebar' },
  },*/
  
  {
    path: 'apps/users',
    loadChildren: () => import('./user/user.module').then((m) => m.UserModule),
  },
  {
    path: 'apps/roles',
    loadChildren: () => import('./role/role.module').then((m) => m.RoleModule),
  },
  {
    path: 'apps/permissions',
    loadChildren: () => import('./permission/permission.module').then((m) => m.PermissionModule),
  },
  //MIS MODULOS
  {
    path: 'roles',
    loadChildren: () => import('../modules/roles/roles.module').then((m) => m.RolesModule),
    data: { permission: 'roles.list' },
  },
  {
    path: 'usuarios',
    loadChildren: () => import('../modules/users/users.module').then((m) => m.UsersModule),
    data: { permission: 'users.list' },
  },
  // mi modulo localhost:4200/configuraciones/areas/list
  {
    path: 'configuraciones',
    loadChildren: () => import('../modules/configuration/configuration.module').then((m) => m.ConfigurationModule),
  },
  
  {
    path: 'productos', //routing listo para producltos
    loadChildren: () => import('../modules/products/products.module').then((m) => m.ProductsModule),
    data: {breadcrumb: 'Productos'} as any,
  },

  {
    path: 'product-entries',
    loadChildren: () => import('../modules/product/product.module').then((m) => m.ProductModule),
    data: { permission: 'product-entries.list' },
  },
  {
    path: 'ordenpedido',
    loadChildren: () => import('../modules/ordenpedido/ordenpedido.module').then((m) => m.OrdenpedidoModule),
    data: { permission: 'orders.list' },
  },

  {
    path:'cars',
    loadChildren: () => import('../modules/cars/cars.module').then((m) => m.CarsModule),
    data: { permission: 'vehicles.list' },
  },


  // ===============================
// MODULOS OPERATIVOS PRINCIPALES
// ===============================

{
  path: 'requisitions',
  loadChildren: () =>
    import('../app/modules/requisitions/requisitions.module')
      .then(m => m.RequisitionsModule),
},

{
  path: 'ai',
  loadChildren: () =>
    import('../../modules/ai/ai.module')
      .then(m => m.AiModule),
},

{
  path: 'chat',
  loadChildren: () =>
    import('../modules/chat/chat.module')
      .then(m => m.ChatModule),
},

{
  path: 'signature',
  loadChildren: () =>
    import('../modules/signatories/signatories.module')
      .then(m => m.SignatoriesModule),
},
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'error/404',
  },
];

export { Routing };
