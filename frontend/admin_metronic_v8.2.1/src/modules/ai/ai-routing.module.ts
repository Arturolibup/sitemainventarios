import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AiDashboardComponent } from './pages/ai-dashboard/ai-dashboard.component';
import { AiChatPanelComponent } from './components/ai-chat-panel/ai-chat-panel.component';
import { AiGlobalInsightsComponent } from './components/ai-global-insights/ai-global-insights.component';
import { AiPriorityProductsComponent } from './components/ai-priority-products/ai-priority-products.component';
import { AiAreasComparisonComponent } from './components/ai-areas-comparison/ai-areas-comparison.component';
import { VehicleDashboardComponent } from './components/vehicle-dashboard.component/vehicle-dashboard.component';

const routes: Routes = [
  {
    path: 'dashboard',
    component: AiDashboardComponent,
    data: {
      title: 'Inteligencia Artificial - Dashboard',
      roles: ['Super-Admin', 'Almacen'],
    },
  },

  {
    path: 'global-insights',
    component: AiGlobalInsightsComponent,
    data: {
      title: 'Insights Globales',
      roles: ['Super-Admin', 'Almacen'],
      icon: 'fas fa-lightbulb',
      breadcrumb: 'Insights'
    },
    
  },
  {
    path: 'priority-products',
    component: AiPriorityProductsComponent,
    data: {
      title: 'Productos Prioritarios',
      roles: ['Super-Admin', 'Almacen'],
      icon: 'fas fa-star',
      breadcrumb: 'Productos'
    },
   
  },
  {
    path: 'areas-comparison',
    component: AiAreasComparisonComponent,
    data: {
      title: 'Comparación por Áreas',
      roles: ['Super-Admin', 'Almacen'],
      icon: 'fas fa-chart-bar',
      breadcrumb: 'Áreas'
    },
    
  },
  {
    path: 'chat',
    component: AiChatPanelComponent,
    data: {
      title: 'Chat con IA',
      roles: ['Super-Admin', 'Almacen', 'Usuario'],
      icon: 'fas fa-comment-dots',
      breadcrumb: 'Chat IA'
    },
    
  },
  {
    path: 'vehiculos',
    component: VehicleDashboardComponent,
    data: {
      title: 'Vehiculos',
      roles: ['Super-Admin', 'Almacen', 'Usuario'],
      icon: 'fas fa-comment-dots',
      breadcrumb: 'Vehiculo IA'
    },
    
  },

  // === REDIRECCIÓN POR DEFECTO ===
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },

  // === 404 DEL MÓDULO ===
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AiRoutingModule {}
