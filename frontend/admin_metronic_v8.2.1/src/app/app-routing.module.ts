import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AuthGuard } from './modules/auth/services/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () =>
      import('./modules/auth/auth.module').then((m) => m.AuthModule),
  },
  {
    path: 'error',
    loadChildren: () =>
      import('./modules/errors/errors.module').then((m) => m.ErrorsModule),
  },
  {
    path: '',
    canActivate: [AuthGuard],
    loadChildren: () =>
      import('./_metronic/layout/layout.module').then((m) => m.LayoutModule),
  },
  /*
  { path: 'requisitions', 
    loadChildren: () => 
      import('./app/modules/requisitions/requisitions.module').then(m => m.RequisitionsModule) 
  },

  {
  path: 'ai',
  loadChildren: () => import('../modules/ai/ai.module').then(m => m.AiModule),
},

  { 
  path: 'signature', 
    loadChildren: () => 
      import('./modules/signatories/signatories.module').then(m => m.SignatoriesModule) 
  },

  {
  path: 'chat',
  loadChildren: () =>
    import('./modules/chat/chat.module').then((m) => m.ChatModule),
},
*/
  { path: '**', 
    redirectTo: 'error/404' 
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
