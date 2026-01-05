import { Component, OnInit } from '@angular/core';
import { ChatUiStateService } from '../../services/chat-ui-state.service';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-chat-fab',
  templateUrl: './chat-fab.component.html',
  styleUrls: ['./chat-fab.component.scss'],
})
export class ChatFabComponent implements OnInit {
  unread = 0;

  constructor(
    public ui: ChatUiStateService,
    private chatService: ChatService
  ) {}

  ngOnInit() {
    this.chatService.unreadCount$.subscribe(count => {
      this.unread = count;
    });
  }

  open() {
    this.ui.open();
  }
}
