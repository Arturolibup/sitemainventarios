import { Component } from '@angular/core';
import { ChatUiStateService } from '../../services/chat-ui-state.service';

@Component({
  selector: 'app-floating-chat-window',
  templateUrl: './floating-chat-window.component.html',
  styleUrls: ['./floating-chat-window.component.scss'],
})
export class FloatingChatWindowComponent {
  isMaximized = false;

  constructor(public ui: ChatUiStateService) {}

  close() {
    this.ui.close();
  }

  maximize() {
    this.isMaximized = !this.isMaximized;
  }
}
