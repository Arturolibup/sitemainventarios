import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AiDashboardComponent } from './pages/ai-dashboard/ai-dashboard.component';
import { AiGlobalInsightsComponent } from './components/ai-global-insights/ai-global-insights.component';
import { AiPriorityProductsComponent } from './components/ai-priority-products/ai-priority-products.component';
import { AiAreasComparisonComponent } from './components/ai-areas-comparison/ai-areas-comparison.component';
import { AiChatPanelComponent } from './components/ai-chat-panel/ai-chat-panel.component';
import { VehicleDashboardComponent } from "./components/vehicle-dashboard.component/vehicle-dashboard.component";

import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgbModule, NgbModalModule, NgbPaginationModule } from '@ng-bootstrap/ng-bootstrap';
import { InlineSVGModule } from 'ng-inline-svg-2';
import { AiRoutingModule } from './ai-routing.module';



@NgModule({
  declarations: [
    AiDashboardComponent,
    AiGlobalInsightsComponent,
    AiPriorityProductsComponent,
    AiAreasComparisonComponent,
    AiChatPanelComponent,
    VehicleDashboardComponent,
   
  ],
  imports: [
    CommonModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    NgbModule,
    NgbModalModule,
    NgbPaginationModule,
    InlineSVGModule,
    AiRoutingModule,
  
]
})
export class AiModule { }
