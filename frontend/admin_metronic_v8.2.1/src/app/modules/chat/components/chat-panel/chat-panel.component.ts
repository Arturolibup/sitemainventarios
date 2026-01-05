// chat-panel.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

import { ChatService } from '../../services/chat.service';
import { ChatConversation, ChatMessage, ChatUser } from '../../models/chat.models';
import { AuthService } from 'src/app/modules/auth/services/auth.service';
import { SocketService } from 'src/app/services/socket.service';

interface ChatUserItem {
  user: ChatUser;
  conversation: ChatConversation | null;
}

@Component({
  selector: 'app-chat-panel',
  templateUrl: './chat-panel.component.html',
  styleUrls: ['./chat-panel.component.scss'],
})
export class ChatPanelComponent implements OnInit, OnDestroy {
  currentUser!: ChatUser;

  users: ChatUser[] = [];
  conversations: ChatConversation[] = [];
  userItems: ChatUserItem[] = [];
  private lastWsOnlineUsers: any[] = [];


  selectedConversation: ChatConversation | null = null;

  loadingUsers = false;
  loadingConversations = false;
  errorMessage: string | null = null;
  unreadTotal = 0;

  private subs: Subscription[] = [];
  private started = false;

  constructor(
    private chatService: ChatService,
    private authService: AuthService,
    private socket: SocketService
  ) {}

  ngOnInit(): void {
  this.subs.push(
    this.authService.currentUser$.subscribe((user: any) => {
      if (!user) return;

      this.currentUser = {
        id: user.id,
        name: `${user.name ?? ''} ${user.surname ?? ''}`.trim() || user.name,
        email: user.email,
        avatar_url: user.avatar_url ?? user.avatar ?? null,
        status: 'online',
      };

      if (this.started) return;
      this.started = true;

      // 1️⃣ REST primero
      this.loadUsers();
      this.loadConversations();

      // 2️⃣ WS después
      this.subscribeOnlineUsers();
      this.subscribeRealtimeEvents();
    })
  );
}


  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  private applyOnlineUsers(wsUsers: any[]) {
  const onlineIds = new Set<number>(
    (wsUsers || []).map((u) => Number(u.id))
  );

    // aplica status a TODOS los usuarios ya cargados
  this.users = (this.users || []).map((u) => ({
    ...u,
    status: onlineIds.has(u.id) ? 'online' : 'offline',
  }));

  this.mergeUsersAndConversations();
}


  // =========================
  //   ONLINE USERS (WS)
  // =========================
  /*
  private subscribeOnlineUsers() {
    this.loadingUsers = true;

    this.subs.push(
      this.socket.onlineUsers$.subscribe((wsUsers: any[]) => {
        // wsUsers vienen como WsOnlineUser; los normalizamos a ChatUser
        this.users = (wsUsers || []).map((u: any) => ({
          id: u.id,
          name: u.name,
          email: u.email ?? undefined,
          avatar_url: u.avatar_url ?? null,
          status: (u.status as any) || 'offline',
        }));

        this.mergeUsersAndConversations();
        this.loadingUsers = false;
      })
    );
  }
*/
private subscribeOnlineUsers() {
  this.subs.push(
    this.socket.onlineUsers$.subscribe((wsUsers: any[]) => {
      // ✅ siempre guardar último estado WS
      this.lastWsOnlineUsers = wsUsers || [];

      // ✅ si ya tenemos lista REST, aplicamos ya
      if (this.users.length > 0) {
        this.applyOnlineUsers(this.lastWsOnlineUsers);
      }
    })
  );
}


  // =========================
  //   CONVERSACIONES (REST)
  // =========================
  loadConversations() {
    this.loadingConversations = true;

    this.chatService.getConversations().subscribe({
      next: (convs) => {
        this.conversations = convs || [];
        this.mergeUsersAndConversations();
        this.updateUnreadTotal();
        this.loadingConversations = false;
      },
      error: () => {
        this.errorMessage = 'No se pudieron cargar las conversaciones.';
        this.loadingConversations = false;
      },
    });
  }

  // =========================
  //   UNIR USUARIOS + CHATS
  // =========================
  private mergeUsersAndConversations() {
  if (!this.currentUser?.id) return;

  this.userItems = this.users
    .filter((u) => u.id !== this.currentUser.id)
    .map((user) => {
      const conversation =
        this.conversations.find((c) =>
          c.participants?.some((p) => p.id === user.id)
        ) || null;

      return { user, conversation };
    })
    .sort((a, b) => {
      // 1️⃣ Online primero
      if (a.user.status !== b.user.status) {
        return a.user.status === 'online' ? -1 : 1;
      }

      // 2️⃣ Conversaciones con mensajes primero
      const aDate = a.conversation?.last_message?.sent_at ?? null;
      const bDate = b.conversation?.last_message?.sent_at ?? null;

      if (aDate && bDate) {
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      }

      if (aDate) return -1;
      if (bDate) return 1;

      // 3️⃣ Alfabético
      return a.user.name.localeCompare(b.user.name);
    });
}


getSelectedConversationTitle(): string {
  if (!this.selectedConversation || !this.currentUser) {
    return '';
  }

  const other = this.selectedConversation.participants?.find(
    (p) => p.id !== this.currentUser.id
  );

  return other?.name || 'Usuario';
}



  onUserSelected(item: ChatUserItem) {
    if (!item?.user) return;

    if (item.conversation) {
      this.selectedConversation = item.conversation;
      return;
    }

    if (this.loadingConversations) return;
    this.loadingConversations = true;

    this.chatService.openConversation(item.user.id).subscribe({
      next: (conv) => {
        const exists = this.conversations.some((c) => c.id === conv.id);
        if (!exists) this.conversations.unshift(conv);

        this.mergeUsersAndConversations();
        this.selectedConversation = conv;
        this.updateUnreadTotal();
      },
      error: (err) => console.error('Error abriendo conversación:', err),
      complete: () => (this.loadingConversations = false),
    });
  }

  onBackToUsers() {
  this.selectedConversation = null;
}

  // =========================
  //   EVENTOS DESDE CHATWINDOW
  // =========================
  onNewMessage(event: { message: ChatMessage; conversation: ChatConversation }) {
    const { message, conversation } = event;
    const index = this.conversations.findIndex((c) => c.id === conversation.id);

    if (index >= 0) this.conversations[index].last_message = message;
    else this.conversations.unshift({ ...conversation, last_message: message, unread_count: 0 });

    this.mergeUsersAndConversations();
    this.updateUnreadTotal();
  }

  onConversationRead(conversationId: number) {
    const conv = this.conversations.find((c) => c.id === conversationId);
    if (conv) conv.unread_count = 0;
    this.updateUnreadTotal();
  }

  // =========================
  //   WS EVENTS (PRODUCCIÓN)
  // =========================
  private subscribeRealtimeEvents() {
    // chat:message
    this.subs.push(
      this.socket.newMessage$.subscribe((evt: any) => {
        if (!evt?.conversation_id || !evt?.message) return;

        const conversation_id = Number(evt.conversation_id);
        const message: ChatMessage = evt.message;

        // Si no tengo la conversación, la traigo (esto arregla tu bug del receptor)
        const conv = this.conversations.find((c) => c.id === conversation_id);

        if (!conv) {
          this.chatService.getConversation(conversation_id).subscribe({
            next: (freshConv) => {
              const exists = this.conversations.some((c) => c.id === freshConv.id);
              if (!exists) this.conversations.unshift(freshConv);

              const c2 = this.conversations.find((c) => c.id === conversation_id);
              if (c2) {
                c2.last_message = message;

                if (
                  (!this.selectedConversation || this.selectedConversation.id !== conversation_id) &&
                  message.sender_id !== this.currentUser.id
                ) {
                  c2.unread_count = (c2.unread_count || 0) + 1;
                }
              }

              this.mergeUsersAndConversations();
              this.updateUnreadTotal();
            },
            error: (err) => console.error('No se pudo traer conversación nueva:', err),
          });
          return;
        }

        // Si existe en cache
        conv.last_message = message;

        if (
          (!this.selectedConversation || this.selectedConversation.id !== conversation_id) &&
          message.sender_id !== this.currentUser.id
        ) {
          conv.unread_count = (conv.unread_count || 0) + 1;
        }

        this.mergeUsersAndConversations();
        this.updateUnreadTotal();
      })
    );

    // chat:read (opcional UI)
    this.subs.push(
      this.socket.read$.subscribe((_evt: any) => {
        // Aquí puedes reflejar "leído" por el otro usuario si luego metemos doble check
      })
    );
  }

  updateUnreadTotal() {
    this.unreadTotal = this.conversations.reduce(
      (acc, c) => acc + (c.unread_count || 0),
      0
    );
  }

  loadUsers() {
  this.loadingUsers = true;

  this.chatService.getUsers().subscribe({
    next: (resp) => {
      this.users = (resp.data || []).map((u: ChatUser) => ({
        ...u,
        status: 'offline', // por defecto
      }));

      this.applyOnlineUsers(this.lastWsOnlineUsers);
      this.mergeUsersAndConversations();
      this.loadingUsers = false;
    },
    error: () => {
      this.loadingUsers = false;
    },
  });
}

get onlineUsers() {
  return this.userItems.filter(
    (i) => i.user.status === 'online'
  );
}

get offlineUsers() {
  return this.userItems.filter(
    (i) => i.user.status !== 'online'
  );
}

}
