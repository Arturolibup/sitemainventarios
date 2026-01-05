import { Injectable } from '@angular/core';
import { Socket, io } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  private socket?: Socket;
  private readonly serverUrl = 'http://localhost:3000';

  constructor() {
    // ❌ NO conectar automáticamente
  }

  connect(): void {
    if (this.socket) return;

    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.socket?.on('connect', () => {
      console.log('🔔 Notification socket conectado');
    });

    this.socket?.on('disconnect', (reason) => {
      console.warn('🔔 Notification socket desconectado:', reason);
    });

    this.socket?.on('connect_error', (error) => {
      console.error('🔔 Error socket notifications:', error);
    });
  }

  listenForNotifications(callback: (data: any) => void): void {
    this.socket?.on('notification', callback);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = undefined;
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }
}
