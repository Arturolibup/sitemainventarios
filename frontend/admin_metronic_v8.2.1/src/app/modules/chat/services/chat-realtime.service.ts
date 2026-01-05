import { Injectable, NgZone } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject } from 'rxjs';
import {
  ChatMessage,
  ChatUser,
  ChatUserStatus,
} from '../models/chat.models';
import { environment } from '../../../../environments/environment';

interface ChatMessageEvent {
  message: ChatMessage;
  conversation_id: number;
}

@Injectable({
  providedIn: 'root',
})
export class ChatRealtimeService {
  private socket?: Socket;

  private onlineUsersSubject = new BehaviorSubject<ChatUser[]>([]);
  onlineUsers$ = this.onlineUsersSubject.asObservable();

  private incomingMessageSubject = new BehaviorSubject<ChatMessageEvent | null>(
    null
  );
  incomingMessage$ = this.incomingMessageSubject.asObservable();

  private typingSubject = new BehaviorSubject<{
    conversation_id: number;
    from_user_id: number;
    is_typing: boolean;
  } | null>(null);
  typing$ = this.typingSubject.asObservable();

  private readSubject = new BehaviorSubject<{
    conversation_id: number;
    user_id: number;
  } | null>(null);
  read$ = this.readSubject.asObservable();

  constructor(private ngZone: NgZone) {}

  connect(currentUser: ChatUser) {
    if (this.socket) {
      return;
    }

    this.socket = io(environment.chatWsUrl, {
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      this.socket?.emit('register', {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        avatar_url: currentUser.avatar_url,
        status: 'online',
      });
    });

    this.socket.on('disconnect', (reason) => {
      this.ngZone.run(() => {
        console.warn('Chat WS desconectado:', reason);
        this.onlineUsersSubject.next([]);
      });
    });

    this.socket.on('users:online', (payload: { users: ChatUser[] }) => {
      this.ngZone.run(() => {
        this.onlineUsersSubject.next(payload.users || []);
      });
    });

    this.socket.on('chat:message', (payload: ChatMessageEvent) => {
      this.ngZone.run(() => {
        this.incomingMessageSubject.next(payload);
      });
    });

    this.socket.on(
      'chat:typing',
      (payload: { conversation_id: number; from_user_id: number; is_typing: boolean }) => {
        this.ngZone.run(() => {
          this.typingSubject.next(payload);
        });
      }
    );

    this.socket.on(
      'chat:read',
      (payload: { conversation_id: number; user_id: number }) => {
        this.ngZone.run(() => {
          this.readSubject.next(payload);
        });
      }
    );
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = undefined;
  }

  updateStatus(userId: number, status: ChatUserStatus) {
    this.socket?.emit('user:status', { userId, status });
  }

  emitMessage(
    message: ChatMessage,
    receiverIds: number[],
    conversationId: number
  ) {
    this.socket?.emit('chat:send', {
      message,
      receiver_ids: receiverIds,
      conversation_id: conversationId,
    });
  }

  emitTyping(
    conversationId: number,
    fromUserId: number,
    toUserIds: number[],
    isTyping: boolean
  ) {
    this.socket?.emit('chat:typing', {
      conversation_id: conversationId,
      from_user_id: fromUserId,
      to_user_ids: toUserIds,
      is_typing: isTyping,
    });
  }

  emitRead(conversationId: number, userId: number, otherUserIds: number[]) {
    this.socket?.emit('chat:read', {
      conversation_id: conversationId,
      user_id: userId,
      other_user_ids: otherUserIds,
    });
  }
}
