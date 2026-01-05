// chat-window.component.ts
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { Subscription, timer } from 'rxjs';

import { ChatConversation, ChatMessage, ChatUser } from '../../models/chat.models';
import { ChatService } from '../../services/chat.service';
import { SocketService } from 'src/app/services/socket.service';

@Component({
  selector: 'app-chat-window',
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
})
export class ChatWindowComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() conversation!: ChatConversation;
  @Input() currentUser!: ChatUser;

  @Output() newMessage = new EventEmitter<{ message: ChatMessage; conversation: ChatConversation }>();
  @Output() conversationRead = new EventEmitter<number>();

  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLElement>;
  @ViewChild('messageInput') messageInput!: ElementRef<HTMLTextAreaElement>;

  messages: ChatMessage[] = [];
  loadingMessages = false;
  sending = false;
  page = 1;
  lastPage = 1;
  body = '';
  attachments: File[] = [];
  errorMessage: string | null = null;

  typingUsers: { [userId: number]: boolean } = {};

  private subs: Subscription[] = [];
  private typingTimerSub?: Subscription;
  private typingTimeouts: { [userId: number]: any } = {};
  private pendingScrollToBottom = false;

  constructor(private chatService: ChatService, private socket: SocketService) {}

  // =========================
  //  LIFECYCLE
  // =========================
  ngOnInit(): void {
    this.subscribeWsEvents();
    this.loadMessages(true);
    this.markAsRead();
  
    
  }

  ngAfterViewInit(): void {
    // primer paint
    this.scrollToBottom(true);
    this.focusInput();
  }

  


  ngOnChanges(changes: SimpleChanges): void {
    if (changes['conversation'] && this.conversation) {
      this.resetState();
      this.loadMessages(true);
      this.markAsRead();

      // al cambiar conversación: asegura foco + scroll
      this.focusInput();
      this.scrollToBottom(true);
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    if (this.typingTimerSub) this.typingTimerSub.unsubscribe();

    // limpia timeouts typing
    Object.keys(this.typingTimeouts).forEach((k) => clearTimeout(this.typingTimeouts[+k]));
  }

  // =========================
  //  UI HELPERS
  // =========================
  private scrollToBottom(force: boolean = false): void {
  const el = this.messagesContainer?.nativeElement;
  if (!el) return;

  const doScroll = () => {
    el.scrollTop = el.scrollHeight;
  };

  if (force) {
    // 🔥 Esperar a que Angular pinte el mensaje
    requestAnimationFrame(() => {
      doScroll();

      requestAnimationFrame(() => {
        doScroll();

        // último seguro (wrap, fonts, imágenes)
        setTimeout(doScroll, 20);
      });
    });
    return;
  }

  const threshold = 150;
  const distanceFromBottom =
    el.scrollHeight - el.scrollTop - el.clientHeight;

  if (distanceFromBottom < threshold) {
    requestAnimationFrame(() => {
      doScroll();
      requestAnimationFrame(doScroll);
    });
  }
}




  private focusInput(): void {
    setTimeout(() => {
      this.messageInput?.nativeElement?.focus();
    }, 50);
  }

  // =========================
  //  STATE
  // =========================
  private resetState(): void {
    this.messages = [];
    this.page = 1;
    this.lastPage = 1;
    this.body = '';
    this.attachments = [];
    this.errorMessage = null;
    this.typingUsers = {};
  }

  // =========================
  //  LOAD MESSAGES (REST)
  // =========================
  /*
  loadMessages(scrollBottom: boolean = false): void {
  if (!this.conversation) return;

  this.loadingMessages = true;

  this.chatService.getMessages(this.conversation.id, this.page).subscribe({
    next: (resp) => {
      const newMessages = (resp.data || []).reverse();

      // 🔥 concatenar correctamente
      this.messages = [...this.messages, ...newMessages];

      this.page = (resp.meta?.current_page || this.page) + 1;
      this.lastPage = resp.meta?.last_page || this.lastPage;

      this.loadingMessages = false;

      if (scrollBottom) {
        // 🔥 ESPERAR RENDER REAL (CLAVE)
        
          this.scrollToBottom(true);

          // 🔥 segundo intento por mensajes largos / fuentes
          setTimeout(() => {
            this.scrollToBottom(true);
          }, 50);
        
      }
    },
    error: (err) => {
      console.error(err);
      this.errorMessage = 'No se pudieron cargar los mensajes.';
      this.loadingMessages = false;
    },
  });
}
*/
loadMessages(scrollBottom: boolean = false): void {
  if (!this.conversation) return;

  this.loadingMessages = true;

  this.chatService.getMessages(this.conversation.id, this.page).subscribe({
    next: (resp) => {
      const newMessages = (resp.data || []).reverse();

      this.messages = [...this.messages, ...newMessages];

      this.page = (resp.meta?.current_page || this.page) + 1;
      this.lastPage = resp.meta?.last_page || this.lastPage;

      this.loadingMessages = false;

      if (scrollBottom) {
        this.pendingScrollToBottom = true;
        this.deferScroll(); // 👈 IMPORTANTE
      }
    },
    error: () => {
      this.errorMessage = 'No se pudieron cargar los mensajes.';
      this.loadingMessages = false;
    },
  });
}

private deferScroll(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = this.messagesContainer?.nativeElement;
      if (!el) return;

      el.scrollTop = el.scrollHeight;

      // 🔥 ÚLTIMO AJUSTE para textos largos / PDF / wrap
      setTimeout(() => {
        el.scrollTop = el.scrollHeight;
        this.pendingScrollToBottom = false;
      }, 30);
    });
  });
}


  canLoadMore(): boolean {
    return this.page <= this.lastPage;
  }

  onLoadMore(): void {
    if (this.canLoadMore() && !this.loadingMessages) this.loadMessages(false);
  }

  // =========================
  //  SEND MESSAGE (REST + WS)
  // =========================
  sendMessage(): void {
    if (!this.conversation) return;
    if (!this.body.trim() && this.attachments.length === 0) return;

    this.sending = true;
    this.errorMessage = null;

    this.chatService.sendMessage(this.conversation.id, this.body, this.attachments).subscribe({
      next: (msg) => {
        this.messages.push(msg);
        this.body = '';
        this.attachments = [];
        this.sending = false;

        this.scrollToBottom(true);
        this.focusInput();

        // notifica al panel
        this.newMessage.emit({ message: msg, conversation: this.conversation });

        // WS a otros
        const otherUserIds = (this.conversation.participants || [])
          .filter((p) => p.id !== this.currentUser.id)
          .map((p) => p.id);

        this.socket.sendChatMessage(msg, otherUserIds, this.conversation.id);

        // cuando yo envío, yo ya lo “leí”
        this.markAsRead();

        // apagar typing inmediatamente
        this.emitTyping(false);
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = 'No se pudo enviar el mensaje.';
        this.sending = false;
      },
    });
  }

  // =========================
  //  ATTACHMENTS
  // =========================
  onFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  const files = Array.from(input.files); // 🔥 CLAVE

  this.attachments = [...this.attachments, ...files];

  // limpiar input para poder volver a seleccionar el mismo archivo
  input.value = '';

  this.focusInput();
}


  onRemoveAttachment(index: number): void {
    this.attachments.splice(index, 1);
    this.attachments = [...this.attachments];
    this.focusInput();
  }

  // =========================
  //  KEYDOWN + TYPING
  // =========================
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
      return;
    }

    // typing ON
    this.emitTyping(true);

    // typing OFF debounce
    if (this.typingTimerSub) this.typingTimerSub.unsubscribe();
    this.typingTimerSub = timer(1200).subscribe(() => this.emitTyping(false));
  }

  private emitTyping(isTyping: boolean): void {
    // ✅ IMPORTANTE: esto debe coincidir con tu SocketService nuevo
    // socket.emit('chat:typing', { conversation_id, is_typing })
    this.socket.emitTyping(this.conversation.id, isTyping);
  }

  // =========================
  //  WS EVENTS (message/typing/read)
  // =========================
  private subscribeWsEvents(): void {

  // ==========================
  // 📨 MENSAJES ENTRANTES
  // ==========================
  this.subs.push(
    this.socket.newMessage$.subscribe((evt: any) => {
      if (!evt) return;
      if (!this.conversation) return;
      if (Number(evt.conversation_id) !== this.conversation.id) return;

      const msg: ChatMessage = evt.message;

      // evitar eco
      if (msg.sender_id === this.currentUser.id) return;

      this.messages.push(msg);
      this.pendingScrollToBottom = true;
      this.deferScroll();

      // notifica al panel
      this.newMessage.emit({ message: msg, conversation: this.conversation });
      
      this.scrollToBottom(true);
      this.markAsRead();
    })
  );

  // ==========================
  // ✏️ ESCRIBIENDO
  // ==========================
  this.subs.push(
    this.socket.typing$.subscribe((evt: any) => {
      if (!evt) return;
      if (!this.conversation) return;
      if (Number(evt.conversation_id) !== this.conversation.id) return;
      if (Number(evt.from_user_id) === this.currentUser.id) return;

      const uid = Number(evt.from_user_id);

      this.typingUsers[uid] = !!evt.is_typing;

      clearTimeout(this.typingTimeouts[uid]);
      if (evt.is_typing) {
        this.typingTimeouts[uid] = setTimeout(() => {
          this.typingUsers[uid] = false;
        }, 1800);
      }
    })
  );

  // ==========================
  // 👁 LEÍDO (✓✓)
  // ==========================
  this.subs.push(
    this.socket.read$.subscribe((evt: any) => {
      if (!evt) return;
      if (!this.conversation) return;
      if (Number(evt.conversation_id) !== this.conversation.id) return;

      this.messages = this.messages.map(m =>
        m.sender_id === this.currentUser.id
          ? { ...m, read_at: new Date().toISOString() }
          : m
      );
    })
  );
}



  // =========================
  //  READ (REST + WS)
  // =========================
  private markAsRead(): void {
    if (!this.conversation) return;

    this.chatService.markAsRead(this.conversation.id).subscribe({
      next: () => {
        this.conversationRead.emit(this.conversation.id);

        const otherUserIds = (this.conversation.participants || [])
          .filter((p) => p.id !== this.currentUser.id)
          .map((p) => p.id);

        this.socket.sendRead(this.conversation.id, this.currentUser.id, otherUserIds);
      },
      error: (err) => console.error(err),
    });
  }

  // =========================
  //  TEMPLATE HELPERS
  // =========================
  getOtherParticipantName(): string {
    const other = (this.conversation.participants || []).find((p) => p.id !== this.currentUser.id);
    return other ? other.name : 'Usuario';
  }

  getTypingText(): boolean {
    return Object.values(this.typingUsers).some((v) => v);
  }

  isMine(msg: ChatMessage): boolean {
    return msg.sender_id === this.currentUser.id;
  }

  downloadAttachment(att: any): void {
    this.chatService.downloadAttachment(att.download_url).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = att.original_name || 'archivo';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.errorMessage = 'No se pudo descargar el archivo.';
      },
    });
  }
}
