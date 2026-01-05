import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ChatService } from 'src/app/_metronic/services/chat.service';

import { AuthService } from 'src/app/modules/auth';

@Component({
  selector: 'app-messenger-drawer',
  templateUrl: './messenger-drawer.component.html',
})
export class MessengerDrawerComponent implements OnInit {
  @ViewChild('ktDrawerChat', { static: true }) ktDrawerChat: ElementRef;
  showDrawer = false;
  selectedUserId: number | null = null;
  currentUserId: number;

  constructor(private chatService: ChatService, private authService: AuthService) {
    this.currentUserId = this.authService.getUserId();
    console.log('🔄 MessengerDrawerComponent construido, currentUserId:', this.currentUserId);
  }

  ngOnInit(): void {
    console.log('🚀 MessengerDrawerComponent inicializado');
    
    // Hacer el método openDrawer accesible globalmente para otros componentes
    (window as any).openChatDrawer = (userId: number) => {
      this.openDrawer(userId);
    };
  }

  openDrawer(userId: number) {
    console.log('🔧 Abriendo drawer con userId:', userId);
    this.selectedUserId = userId;
    this.chatService.joinRoom(this.currentUserId, userId);
    this.showDrawer = true;
    
    console.log('🔍 Estado después de abrir:', {
      showDrawer: this.showDrawer,
      selectedUserId: this.selectedUserId
    });

    // Forzar actualización de la vista
    setTimeout(() => {
      this.forceViewUpdate();
    }, 100);
  }

  private forceViewUpdate() {
    // Forzar detección de cambios
    this.showDrawer = false;
    setTimeout(() => {
      this.showDrawer = true;
    }, 50);
  }

  closeDrawer() {
    console.log('🚪 Cerrando drawer');
    this.showDrawer = false;
    this.selectedUserId = null;
  }

  // Método público para verificar estado
  getDrawerState() {
    return {
      showDrawer: this.showDrawer,
      selectedUserId: this.selectedUserId,
      currentUserId: this.currentUserId
    };
  }
}