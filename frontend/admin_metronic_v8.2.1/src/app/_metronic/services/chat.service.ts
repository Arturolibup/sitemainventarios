import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { AuthService } from 'src/app/modules/auth';
import { URL_SERVICIOS } from 'src/app/config/config';

@Injectable({
  providedIn: 'root'
})
export class ChatService implements OnDestroy {
  private socket: Socket;
  private messagesSubject = new Subject<any>();
  messages$ = this.messagesSubject.asObservable();
  private currentUserId: number;
  private isConnected = false;

  constructor(private http: HttpClient, private authService: AuthService) {
    this.currentUserId = this.authService.getUserId();
    this.initializeSocket();
  }

  private initializeSocket() {
    return;
  }

  private setupSocketListeners() {
    this.socket.on('connect', () => {
      console.log('✅ Conectado a Socket.IO con ID:', this.socket.id);
      this.isConnected = true;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Desconectado de Socket.IO:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Error de conexión Socket.IO:', error);
      this.isConnected = false;
    });

    // ✅ CORREGIDO: Recibir TODOS los mensajes, el filtro se hará en el componente
    this.socket.on('receive_chat_message', (data) => {
      console.log('📨 Mensaje recibido en servicio:', data);
      this.messagesSubject.next(data);
    });

    this.socket.on('join_chat_room_confirmation', (data) => {
      console.log('✅ Unido a room:', data.room);
    });
  }

  joinRoom(currentUserId: number, receiverId: number) {
    if (!this.isConnected) {
      console.warn('⚠️ Socket no conectado, intentando reconectar...');
      setTimeout(() => this.joinRoom(currentUserId, receiverId), 1000);
      return;
    }

    const room = `chat_${currentUserId}_${receiverId}`;
    console.log(`🔗 Uniendo a room: ${room}`);
    this.socket.emit('join_chat_room', { 
      currentUserId, 
      receiverId,
      room 
    });
  }

  sendMessage(receiverId: number, message: string) {
    if (!receiverId) {
      console.error('❌ receiverId no definido en sendMessage');
      return;
    }

    if (!this.isConnected) {
      console.error('❌ Socket no conectado, no se puede enviar mensaje');
      return;
    }

    const data = {
      currentUserId: this.currentUserId,
      receiverId: receiverId,
      message: message,
      timestamp: new Date().toISOString()
    };

    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    console.log('📤 Enviando mensaje:', data);

    // ✅ Enviar por HTTP para persistencia
    this.http.post(`${URL_SERVICIOS}/chat/send`, data, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (response) => console.log('✅ Mensaje guardado en BD:', response),
      error: (error) => console.error('❌ Error al guardar mensaje:', error)
    });

    // ✅ También enviar por socket para tiempo real
    const room = `chat_${this.currentUserId}_${receiverId}`;
    console.log(`🔊 Emitiendo mensaje por socket en room: ${room}`);
    this.socket.emit('send_chat_message', { ...data, room });
  }

  receiveMessages() {
    // Este método ya no es necesario porque los listeners se configuran en el constructor
    console.log('🎯 Escuchando mensajes...');
  }

  getMessages(): Observable<any> {
    return this.messages$;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  ngOnDestroy() {
    if (this.socket) {
      this.socket.disconnect();
      console.log('🔌 Socket desconectado');
    }
  }
}