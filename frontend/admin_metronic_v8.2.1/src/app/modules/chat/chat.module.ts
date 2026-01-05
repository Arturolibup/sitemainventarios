import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ChatRoutingModule } from './chat-routing.module';
import { ChatPanelComponent } from './components/chat-panel/chat-panel.component';
import { ChatUserListComponent } from './components/chat-user-list/chat-user-list.component';
import { ChatWindowComponent } from './components/chat-window/chat-window.component';
import { ChatAttachmentPreviewComponent } from './components/chat-attachment-preview/chat-attachment-preview.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { ChatFabComponent } from './components/chat-fab/chat-fab.component';
import { FloatingChatWindowComponent } from './components/floating-chat-window/floating-chat-window.component';


@NgModule({
  declarations: [
    ChatPanelComponent,
    ChatUserListComponent,
    ChatWindowComponent,
    ChatAttachmentPreviewComponent,
    ChatFabComponent,
    FloatingChatWindowComponent,

  ],
  imports: [
    CommonModule,
    ChatRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    ChatRoutingModule,
    HttpClientModule,
    
  ],
  exports: [
    // Exportamos estos para usarlos en app.component.html
    ChatFabComponent,
    FloatingChatWindowComponent,
  ],
})
export class ChatModule {
  
 }
