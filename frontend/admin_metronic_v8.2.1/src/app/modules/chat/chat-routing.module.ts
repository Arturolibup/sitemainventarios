import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ChatPanelComponent } from './components/chat-panel/chat-panel.component';

const routes: Routes = [
  {
    path: '',
    component: ChatPanelComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ChatRoutingModule { }
