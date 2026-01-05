
import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import Swal from 'sweetalert2';
import { SocketService } from './socket.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {


  error(message: string, details: string[] = []) {
    const footer = details.length
      ? `<ul style="text-align:left;margin:0;padding-left:1.2rem;">${details.map((item) => `<li>${item}</li>`).join('')}</ul>`
      : undefined;

    Swal.fire({ icon: 'error', title: 'Error', text: message, ...(footer ? { footer } : {}) });
  }
  warning(message: string) {
    Swal.fire({ icon: 'warning', title: 'Atención', text: message });
  }
  success(message: string) {
    Swal.fire({ icon: 'success', title: 'Atención', text: message });
  }
  info(message: any) {
    Swal.fire({ icon: 'info', title: 'Información', text: message });
  }
  private socket: Socket;
  private readonly serverUrl = 'http://localhost:3000';

  constructor(private socketService: SocketService) {
    this.initializeSocket();
  }

// ===============================
  // SOCKET INIT (CON TOKEN)
  // ===============================
  private initializeSocket(): void {
    try {
      const token =
        localStorage.getItem('token') ||
        sessionStorage.getItem('token') ||
        '';

      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],

        // ✅ 1) Legacy servers: token en query
        query: { token },

        // ✅ 2) Socket.IO v4: token en auth
        auth: { token },

        // ✅ 3) Servers que leen Authorization header
        extraHeaders: token ? { Authorization: `Bearer ${token}` } : {},

        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.setupEventListeners();
    } catch (error) {
      console.error('Error inicializando socket:', error);
    }
  }

  /*
  private initializeSocket(): void {
    try {
      
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      this.setupEventListeners();
    } catch (error) {
      console.error('Error inicializando socket:', error);
    }
  }
*/
  private setupEventListeners(): void {
    this.socket.on('connect', () => {
      console.log('✅ Conectado al servidor de sockets');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Desconectado del servidor de sockets:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Error de conexión:', error);
    });
  }

  private normalizeSocketNotification(n: any) {
  return {
    id: n.id ?? ('socket-' + Date.now()),
    message: n.message || n.title || 'Notificación',
    type: n.type || 'info',
    order_request_id: n.order_id ?? null,
    is_read: false,
    created_at: new Date().toISOString()
  };
}


  // Escuchar notificaciones
  listenForNotifications(callback: (data: any) => void): void {
    this.socket.on('notification', (data: any)=> {
      const normalized = this.normalizeSocketNotification(data);
      callback(normalized);
    });
  }

  // Unirse a una sala específica
  joinRoom(room: string): void {
    this.socket.emit('subscribe', room);
  }

  // Salir de una sala
  leaveRoom(room: string): void {
    this.socket.emit('unsubscribe', room);
  }

  // Desconectar
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  // Obtener ID del socket
  getSocketId(): string {
    return this.socket?.id || '';
  }

  // Verificar si está conectado
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}
  