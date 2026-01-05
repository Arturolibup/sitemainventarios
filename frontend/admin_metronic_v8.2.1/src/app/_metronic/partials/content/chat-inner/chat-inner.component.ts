import { Component, ElementRef, HostBinding, Input, OnInit, SimpleChanges, ViewChild } from '@angular/core';

import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ChatService } from 'src/app/_metronic/services/chat.service';
import { AuthService } from 'src/app/modules/auth';

@Component({
  selector: 'app-chat-inner',
  templateUrl: './chat-inner.component.html',
})

export class ChatInnerComponent implements OnInit {
  @Input() isDrawer: boolean = false;
  @Input() selectedUserId: number | null = null; // Aceptar null

  @HostBinding('class') class = 'card-body';
  @HostBinding('id') id = this.isDrawer ? 'kt_drawer_chat_messenger_body' : 'kt_chat_messenger_body';

  @ViewChild('messageInput', { static: true }) messageInput: ElementRef<HTMLTextAreaElement>;

  messages: any[] = [];
  private destroy$ = new Subject<void>();
  currentUserId: number;

 
  constructor(private chatService: ChatService, private authService: AuthService) {
    this.currentUserId = this.authService.getUserId();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.selectedUserId && changes.selectedUserId.currentValue) {
      console.log('🔄 selectedUserId cambió:', changes.selectedUserId.currentValue);
      this.initializeChat();
    } 
  } 

  ngOnInit() {
    console.log('🚀 ChatInnerComponent iniciado');
    this.initializeChat();
    
    // Suscribirse a mensajes
    this.chatService.getMessages().pipe(takeUntil(this.destroy$)).subscribe(msg => {
      console.log('📨 Mensaje recibido en chat-inner:', msg);
      this.mapAndAddMessage(msg);
    });
  }

  private initializeChat() {
    if (this.selectedUserId) {
      console.log('🔗 Uniendo a room con userId:', this.selectedUserId);
      this.chatService.joinRoom(this.currentUserId, this.selectedUserId);
      this.chatService.receiveMessages();
    } else {
      console.warn('⚠️ selectedUserId no disponible para inicializar chat');
    }
  }

  private mapAndAddMessage(msg: any) {
    const type = msg.userId === this.currentUserId ? 'out' : 'in';
    const mappedMessage = {
      type: type,
      user: msg.userId,
      text: msg.message,
      time: new Date(msg.timestamp).toLocaleTimeString()
    };
    this.messages.push(mappedMessage);
    console.log('💾 Mensaje añadido:', mappedMessage);
  }

  submitMessage(): void {
    const text = this.messageInput.nativeElement.value.trim();
    console.log('📤 Intentando enviar mensaje:', { text, selectedUserId: this.selectedUserId });
    
    if (text && this.selectedUserId) {
      console.log('✅ Enviando mensaje a:', this.selectedUserId);
      this.chatService.sendMessage(this.selectedUserId, text);
      
      // Añadir mensaje localmente inmediatamente
      this.mapAndAddMessage({ 
        userId: this.currentUserId, 
        message: text, 
        timestamp: new Date().toISOString() 
      });
      
      this.messageInput.nativeElement.value = '';
    } else {
      console.error('❌ Error: selectedUserId no definido o mensaje vacío', {
        text: text,
        selectedUserId: this.selectedUserId
      });
    }
  }

  getUser(userId: number) {
    return userId === this.currentUserId 
      ? { name: 'You', avatar: 'avatars/300-6.jpg' } 
      : { name: `User ${userId}`, avatar: 'avatars/300-1.jpg' };
  }

  getMessageCssClass(message: any): string {
    return `p-5 rounded text-gray-900 fw-bold mw-lg-400px bg-light-${
      message.type === 'out' ? 'primary' : 'info'
    } text-${message.type === 'out' ? 'end' : 'start'}`;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}


/*import {
  Component,
  ElementRef,
  HostBinding,
  Input,
  OnInit,
  ViewChild,
} from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  defaultMessages,
  defaultUserInfos,
  messageFromClient,
  MessageModel,
  UserInfoModel,
} from './dataExample';

@Component({
  selector: 'app-chat-inner',
  templateUrl: './chat-inner.component.html',
})
export class ChatInnerComponent implements OnInit {
  @Input() isDrawer: boolean = false;
  @HostBinding('class') class = 'card-body';
  @HostBinding('id') id = this.isDrawer
    ? 'kt_drawer_chat_messenger_body'
    : 'kt_chat_messenger_body';
  @ViewChild('messageInput', { static: true })
  messageInput: ElementRef<HTMLTextAreaElement>;

  private messages$: BehaviorSubject<Array<MessageModel>> = new BehaviorSubject<
    Array<MessageModel>
  >(defaultMessages);
  messagesObs: Observable<Array<MessageModel>>;

  constructor() {
    this.messagesObs = this.messages$.asObservable();
  }

  submitMessage(): void {
    const text = this.messageInput.nativeElement.value;
    const newMessage: MessageModel = {
      user: 2,
      type: 'out',
      text,
      time: 'Just now',
    };
    this.addMessage(newMessage);
    // auto answer
    setTimeout(() => {
      this.addMessage(messageFromClient);
    }, 4000);
    // clear input
    this.messageInput.nativeElement.value = '';
  }

  addMessage(newMessage: MessageModel): void {
    const messages = [...this.messages$.value];
    messages.push(newMessage);
    this.messages$.next(messages);
  }

  getUser(user: number): UserInfoModel {
    return defaultUserInfos[user];
  }

  getMessageCssClass(message: MessageModel): string {
    return `p-5 rounded text-gray-900 fw-bold mw-lg-400px bg-light-${
      message.type === 'in' ? 'info' : 'primary'
    } text-${message.type === 'in' ? 'start' : 'end'}`;
  }

  ngOnInit(): void {}
}*/
