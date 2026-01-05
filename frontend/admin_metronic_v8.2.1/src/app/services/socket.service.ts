import { Injectable, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { AuthService } from '../modules/auth/services/auth.service';
import { environment } from 'src/environments/environment';

export interface WsNotification {
  id: number;
  title: string;
  message: string;
  type: string;
  module?: string | null;
  user_id?: number | null;
  created_at: string;
}

export interface WsOnlineUser {
  id: number;
  name: string;
  email?: string | null;
  avatar_url?: string | null;
  status: string;
}

@Injectable({
  providedIn: 'root',
})
export class SocketService implements OnDestroy {
  /**
   * Instancia de socket.io-client. Puede ser null si aún no se ha conectado.
   */
  private socket: Socket | null = null;

  /**
   * ID del usuario autenticado actual (según AuthService).
   */
  private userId: number | null = null;

  /**
   * Marca si la conexión WS está activa.
   */
  private isConnected = false;

  /**
   * Suscripción a los cambios de usuario de AuthService.
   * Así detectamos login/logout/cambio de usuario.
   */
  private authSub?: Subscription;

  // ==== STREAMS PARA ANGULAR (públicos como hasta ahora) ====
  private onlineUsersSubject = new BehaviorSubject<WsOnlineUser[]>([]);
  onlineUsers$ = this.onlineUsersSubject.asObservable();

  private newMessageSubject = new Subject<any>();
  newMessage$ = this.newMessageSubject.asObservable();

  private typingSubject = new Subject<any>();
  typing$ = this.typingSubject.asObservable();

  private readSubject = new Subject<any>();
  read$ = this.readSubject.asObservable();

  private notificationSubject = new Subject<WsNotification>();
  notification$ = this.notificationSubject.asObservable();

  private statusSubject = new BehaviorSubject<boolean>(false);
  status$ = this.statusSubject.asObservable();

  constructor(private auth: AuthService) {
    /**
     * En vez de usar setTimeout, nos enganchamos al flujo
     * de currentUser$ de AuthService. Así:
     *
     *  - Cuando hay login por primera vez → conectamos WS.
     *  - Cuando hay logout → desconectamos WS.
     *  - Si cambia de usuario (caso raro) → reconectamos con nuevo ID.
     */
    this.authSub = this.auth.currentUser$.subscribe((user: any) => {
      const prevUserId = this.userId;
      this.userId = user?.id ?? null;

      // 1) Primer login (antes no había usuario, ahora sí)
      if (!prevUserId && this.userId) {
        this.connect();
        return;
      }

      // 2) Logout (había usuario, ahora no hay)
      if (prevUserId && !this.userId) {
        this.disconnect();
        return;
      }

      // 3) Cambio de usuario (raro pero posible)
      if (prevUserId && this.userId && prevUserId !== this.userId) {
        this.disconnect(false);
        this.connect();
        return;
      }

      // 4) Caso inicial (sin usuario) → aún no conectamos.
    });
  }

  // =========================================================
  // 🔌 CONEXIÓN / DESCONEXIÓN
  // =========================================================

  /**
   * Crear conexión de WebSocket si hay usuario autenticado.
   */
  private connect(): void {
    if (!this.userId) {
      console.warn('[SocketService] No hay usuario para conectar WS todavía.');
      return;
    }

    // Si ya hay un socket conectado, solo re-registrar usuario.
    if (this.socket && this.isConnected) {
      console.log('[SocketService] Reutilizando socket existente:', this.socket.id);
      this.registerUser();
      return;
    }

    console.log(
      '%c[SocketService] Conectando a WS...',
      'color:#0d6efd;font-weight:bold;',
      environment.chatWsUrl,
      'userId:',
      this.userId
    );

    this.socket = io(environment.chatWsUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: Infinity,
      query: {
        // Si en algún momento quieres validar el token en el server WS,
        // aquí ya lo estás enviando.
        token: this.auth.token || '',
      },
    });

    this.registerCoreEvents(this.socket);
  }

  /**
   * Desconecta el WebSocket y limpia estados.
   *
   * @param clearOnlineUsers si true, limpia la lista de usuarios online
   */
  private disconnect(clearOnlineUsers: boolean = true): void {
    if (this.socket) {
      console.log('[SocketService] Desconectando WebSocket...');
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.statusSubject.next(false);
    if (clearOnlineUsers) {
      this.onlineUsersSubject.next([]);
    }
  }

  // =========================================================
  // 🔧 REGISTRO DE EVENTOS BÁSICOS
  // =========================================================
  private registerCoreEvents(socket: Socket): void {
    // CONNECT
    socket.on('connect', () => {
      this.isConnected = true;
      this.statusSubject.next(true);
      console.log('🟢 [SocketService] Conectado a WebSocket:', socket.id);

      // Apenas conectamos, registramos usuario
      this.registerUser();
    });

    // DISCONNECT
    socket.on('disconnect', (reason: string) => {
      this.isConnected = false;
      this.statusSubject.next(false);
      console.warn('🔴 [SocketService] Desconectado de WebSocket. Razón:', reason);
    });

    // USERS ONLINE
    socket.on('users:online', (payload: any) => {
      if (payload?.users) {
        // Tipado defensivo
        this.onlineUsersSubject.next(payload.users as WsOnlineUser[]);
      } else {
        this.onlineUsersSubject.next([]);
      }
    });

    // NUEVO MENSAJE DEL CHAT
    socket.on('chat:message', (payload: any) => {
      this.newMessageSubject.next(payload);
    });

    // EVENTO "TYPING"
    socket.on('chat:typing', (payload: any) => {
      this.typingSubject.next(payload);
    });

    // MENSAJE LEÍDO
    socket.on('chat:read', (payload: any) => {
      this.readSubject.next(payload);
    });

    // 🔔 NOTIFICACIONES INTERNAS
    socket.on('notification', (payload: WsNotification) => {
      this.notificationSubject.next(payload);
    });
  }

  // =========================================================
  // 🧍 REGISTRO / ESTADO DEL USUARIO
  // =========================================================
  private registerUser(): void {
    if (!this.socket || !this.isConnected) {
      console.warn('[SocketService] No se puede registrar usuario: socket no está conectado.');
      return;
    }

    const user: any = this.auth.currentUserValue;
    if (!user || !user.id) {
      console.warn('[SocketService] No se puede registrar WS sin usuario actual.');
      return;
    }

    const payload = {
      id: user.id,
      name: `${user.name ?? ''} ${user.surname ?? ''}`.trim(),
      email: user.email,
      avatar_url: user.avatar_url || null,
      status: 'online',
    };

    console.log('[SocketService] Registrando usuario en WS:', payload);

    this.socket.emit('register', payload);
  }

  /**
   * Cambiar el estado del usuario (online/away/busy/etc.)
   * a futuro si lo manejas en el server.
   */
  public setUserStatus(status: string): void {
    if (!this.socket || !this.userId) return;

    this.socket.emit('user:status', {
      userId: this.userId,
      status,
    });
  }

  // =========================================================
  // 💬 CHAT: ENVIAR MENSAJE
  // =========================================================
  public sendChatMessage(
    message: any,
    receiverIds: number[],
    conversationId: number
  ): void {
    if (!this.socket || !this.isConnected) {
      console.warn('[SocketService] No conectado, no se envía chat:send');
      return;
    }

    this.socket.emit('chat:send', {
      message,
      receiver_ids: receiverIds,
      conversation_id: conversationId,
    });
  }

  emitTyping(conversationId: number, isTyping: boolean) {
  if (!this.socket || !this.isConnected) return;

  this.socket.emit('chat:typing', {
    conversation_id: conversationId,
    is_typing: isTyping
  });
}

  // =========================================================
  // ✏️ TYPING
  // =========================================================
  public sendTyping(
  conversationId: number,
  isTyping: boolean
): void {
  if (!this.socket || !this.isConnected) return;

  this.socket.emit('chat:typing', {
    conversation_id: conversationId,
    is_typing: isTyping,
  });
}

  // =========================================================
  // 👁 MARCAR LEÍDO
  // =========================================================
  public sendRead(
    conversationId: number,
    userId: number,
    otherUsers: number[]
  ): void {
    if (!this.socket || !this.isConnected) {
      return;
    }

    this.socket.emit('chat:read', {
      conversation_id: conversationId,
      user_id: userId,
      other_user_ids: otherUsers,
    });
  }

  // =========================================================
  // 🔔 NOTIFICACIONES LOCALES (sin pasar por WS)
  // =========================================================
  /**
   * Esto solo dispara la notificación dentro de Angular,
   * útil si quieres inyectar notificaciones manuales.
   */
  public sendLocalNotification(payload: WsNotification): void {
    this.notificationSubject.next(payload);
  }

  // =========================================================
  // 🧹 LIMPIEZA
  // =========================================================
  ngOnDestroy(): void {
    if (this.authSub) {
      this.authSub.unsubscribe();
    }
    this.disconnect();
  }
}
