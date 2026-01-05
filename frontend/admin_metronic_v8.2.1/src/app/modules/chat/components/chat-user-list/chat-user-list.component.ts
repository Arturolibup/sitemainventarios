import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ChatConversation, ChatUser } from '../../models/chat.models';

@Component({
  selector: 'app-chat-user-list',
  templateUrl: './chat-user-list.component.html',
  styleUrls: ['./chat-user-list.component.scss'],
})
export class ChatUserListComponent {
  @Input() conversations: ChatConversation[] = [];
  @Input() items: { user: ChatUser; conversation: ChatConversation | null }[] = [];
  @Input() loading: boolean = false;
  @Input() errorMessage: string | null = null;
  @Input() currentUserId!: number;

  @Output() conversationSelected = new EventEmitter<ChatConversation>();
  @Output() userSelected = new EventEmitter<{
  user: ChatUser;
  conversation: ChatConversation | null;
}>();

  getOtherParticipantName(conv: ChatConversation): string {
    const other = conv.participants.find((p) => p.id !== this.currentUserId);
    return other ? other.name : 'Usuario';
  }

  selectConversation(conv: ChatConversation) {
    this.conversationSelected.emit(conv);
  }

  select(item: { user: ChatUser; conversation: ChatConversation | null }) {
  this.userSelected.emit(item);
}
}
