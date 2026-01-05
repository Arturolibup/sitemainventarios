import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { OpserviceService } from '../service/opservice.service';
import { AuthService } from '../../auth/services/auth.service';
import { Router } from '@angular/router';
import { of, Subject, Subscription } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { Order, PagedResponse } from '../../../models/interfaces';
import { NotificationService } from '../../../services/notification.service';


@Component({
  selector: 'app-op-list',
  templateUrl: './op-list.component.html',
  styleUrls: ['./op-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default
})
export class OpListComponent implements OnInit, OnDestroy {
  orders: Order[] = [];
  notifications: any[] = [];
  subscriptions: Subscription[] = [];
  

  searchQuery = '';
  currentPage = 1;
  totalItems = 0;
  itemsPerPage = 10;

  isLoading = false;

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  constructor(
    private orderService: OpserviceService,
    public authService: AuthService,
    private router: Router,
    private cdRef: ChangeDetectorRef,
    private notificationService: NotificationService
  ) {}

 // FIX[PT1-D]: Esperar a que el usuario esté hidratado antes de verificar permisos
// ===============================
ngOnInit(): void {
  this.setupRealTimeNotifications();

  // Suscríbete al usuario autenticado
  const sub = this.authService.currentUser$.subscribe((user) => {
    if (!user) return; // Espera a que esté disponible
    console.log('🧩 Usuario listo:', user.roleName);
    console.log('Permisos actuales:', user.permissions);

    // ✅ Evaluar permisos solo cuando ya haya usuario
    if (
      !this.authService.has('orders.create_sf') &&
      !this.authService.has('orders.assign_partidas') &&
      !this.authService.has('orders.validate_sf') &&
      !this.authService.has('orders.add_order_number') &&
      !this.authService.has('orders.list') &&
      !this.authService.has('orders.view') &&
      !this.authService.has('orders.receive')
      ) {
        this.showNotification('error', 'No tienes permisos.....');
        this.router.navigate(['/ordenpedido/oplist']);
      } else {
        this.loadOrders();
        this.cdRef.detectChanges();
        this.setupSearch();
      }
  });

  if (!this.subscriptions) this.subscriptions = [];
  this.subscriptions.push(sub);

  
}


  ngOnDestroy(): void {
    this.subscriptions.forEach(s => s.unsubscribe());
    this.destroy$.next();
    this.destroy$.complete();
  }

    // AÑADE ESTE NUEVO Metodo
  private setupRealTimeNotifications(): void {
    this.notificationService.listenForNotifications((data: any) => {
      console.log('🔔 Notificación en tiempo real recibida:', data);
      
      // Muestra la notificación flotante
      this.showRealTimeNotification(data);
      
      // Si es una notificación relacionada con órdenes, recarga la lista
      if (data.module === 'ordenes' || data.type === 'order_update') {
        this.loadOrders(); // Recarga la lista de órdenes
      }
    });
  }

  // AÑADE ESTE MÉTODO PARA NOTIFICACIONES FLOTANTES, CIERRE AUTOMATICO
  private showRealTimeNotification(data: any): void {
  const icon = data.type || 'info';
  const isUrgent = data.type === 'error' || data.priority === 'high';
  
  Swal.fire({
    title: data.title || 'Nueva notificación',
    text: data.message,
    icon: icon,
    position: 'top-end',
    toast: true,
    showConfirmButton: false,
    showCloseButton: true, // ← Siempre mostrar botón cerrar
    allowOutsideClick: true, // ← CORRECTO: Cerrar al hacer clic fuera
    timer: 0,
    timerProgressBar: false,
    background: this.getNotificationBackground(icon),
    color: this.getNotificationColor(icon),
    iconColor: this.getNotificationIconColor(icon),
    customClass: {
      popup: 'real-time-notification'
    }
    });
  }

  private getNotificationBackground(type: string): string {
  // defino tipo especiico.
    const backgrounds : { [key: string]: string } = {
      success: '#d4edda', // Verde claro
      error: '#f8d7da',   // Rojo claro  
      warning: '#fff3cd', // Amarillo claro
      info: '#d1ecf1'     // Azul claro
    };

    return backgrounds[type] || '#d1ecf1'; // Default azul
  }


  private getNotificationColor(type: string): string {
    const colors: { [key: string]: string } = {
      success: '#155724',
      error: '#721c24',
      warning: '#856404', 
      info: '#0c5460'
    };
    return colors[type] || '#0c5460';
  }

  private getNotificationIconColor(type: string): string {
    const iconColors: { [key: string]: string } = {
      success: '#28a745',
      error: '#dc3545',
      warning: '#ffc107',
      info: '#17a2b8'
    };
    return iconColors[type] || '#17a2b8';
  }
  // -----------------------------
  // Helpers de permisos para el HTML
  // -----------------------------
  canEdit(order: any): boolean {
  return order?.status === 'pending_sf_validation' &&
         this.authService.hasPermission('orders.update');
}

// Área 1 asigna número de orden DESPUÉS de que Área 2 valida
canAddOrderNumber(order: any): boolean {
  return this.authService.hasPermission('orders.add_order_number') &&
         order?.status === 'validate_sf';
}

canValidate(order: any): boolean {
  // Validar SF (Área 2)
  return order?.status === 'pending_sf_validation' &&
         this.authService.hasPermission('orders.assign_partidas');
}

//canAssignOrderNumber(order: any): boolean {
  // Asignar No. Orden (Área 1)
  //return order?.status === 'sf_validated' &&
         //this.authService.hasPermission('');
//}

canReceive(order: any): boolean {
  return ['pending_warehouse','partially_received'].includes(order?.status) &&
         this.authService.hasPermission('orders.receive');
}

  canDownloadPdf(order: any): boolean {
    return order?.status === 'validate_sf';
  }

  canUploadInvoice(order: any): boolean {
    // Ajusta la condición si quieres permitir en más estados
    return order?.status === 'validate_sf';
  }

  // -----------------------------
  // Filtro de estatus según permisos
  // -----------------------------
  private getStatusFilter(): string {
  // Área 2 (conta): valida partidas sobre SF pendientes

    // 🔥 Si el usuario es superadmin o tiene todos los permisos
    if (this.authService.hasPermission('orders.list') || this.authService.hasRole('Super Admin')) {
      return ''; // sin filtro → todas las órdenes
    }


    if (this.authService.hasPermission('orders.assign_partidas')) {
      return 'validate_sf';
    }
    // Área 1 (RM) paso 2: asigna número a las SF que ya validó Área 2
    if (this.authService.hasPermission('orders.add_order_number')) {
      return 'pending_warehouse';
    }
    // Área 3 (almacén)
    if (this.authService.hasPermission('orders.receive')) {
      return 'partially_received, completed';
    }
   if (this.authService.hasPermission('orders.create_sf') || this.authService.hasPermission('orders.update'))
    return 'pending_sf_validation';
  return '';
}



  // -----------------------------
  // Búsqueda
  // -----------------------------
  

  // -----------------------------
  // Carga de órdenes y notificaciones
  // -----------------------------
  private loadOrders(): void {
    console.log ('inicio de loadOrders')
    console.time('loadOrders');
    this.isLoading = true;
    console.log('estado iniciando loadOrdes de isloaging', this.isLoading)
    const statusFilter = this.getStatusFilter();

    this.orderService.getOrders(this.currentPage, this.itemsPerPage, this.searchQuery, statusFilter)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          console.log('Finalizando loadOrders, isLoading:', this.isLoading);
          this.isLoading = false;
          this.cdRef.detectChanges();
          console.log('Vista actualizada después cargar inicio y finalize', statusFilter);
          console.timeEnd('loadOrders');
        })
      )
      .subscribe({
        next: (response) => {
          console.log('Respuesta de getOrders:', response);
          console.log('Datos de órdenes:', response?.data);
          console.log('Metadatos:', response?.meta);
          this.orders = response?.data || [];
          this.totalItems = response?.meta?.total || 0;
          this.loadNotifications();
          console.log('Orders asignados:', this.orders, 'Total Items:', this.totalItems);
          this.cdRef.detectChanges();
        },
        error: (error) => {
          console.error('Error al cargar órdenes:', error);
          this.showNotification('error', 'No se pudieron cargar las órdenes.');
          this.orders = [];
          this.totalItems = 0;
          this.cdRef.detectChanges();
          
        }
      });
  }

  private setupSearch(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        this.isLoading = true;
        const statusFilter = this.getStatusFilter();
        return this.orderService
          .getOrders(this.currentPage, this.itemsPerPage, query, statusFilter)
          .pipe(
            catchError(err => {
              console.error('Error en búsqueda:', err);
              this.showNotification('error', 'Error al buscar órdenes.');
              return of<PagedResponse<any>>({ data: [], meta: { total: 0 } });
            }),
            finalize(() => {
              this.isLoading = false;
            this.cdRef.detectChanges();
            //console.log('Vista actualizada después de finalize');
            //console.timeEnd('loadOrders');
          })
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        this.orders = response?.data || [];
        this.totalItems = response?.meta?.total || 0;
        this.loadNotifications();
        this.cdRef.detectChanges();
      },
      error: (error) => {
        console.error('Error en el flujo de búsqueda:', error);
        this.orders = [];
        this.totalItems = 0;
      }
    });
  }

  onSearchChange(query: string): void {
    this.searchQuery = query || '';
    this.currentPage = 1;
    this.searchSubject.next(this.searchQuery);
  }

  resetSearch(): void {
    this.searchQuery = '';
    this.currentPage = 1;
    this.loadOrders();
  }

  private loadNotifications(): void {
    const orderIds = this.orders.map((o: any) => o?.id).filter(Boolean);

    if (orderIds.length === 0) {
      this.notifications = [];
      return;
    }

    this.orderService.getNotifications(null)
      .pipe(
        takeUntil(this.destroy$),
        catchError(error => {
          console.error('Error al cargar notificaciones:', error);
          return of({ notifications: [] });
        })
      )
      .subscribe({
        next: (response) => {
          const all = response?.notifications || [];
          this.notifications = all.filter((n: any) => !n.is_read);
          // && orderIds.includes(n.order_request_id));

          // Asignar notificaciones a cada orden
          //this.orders = this.orders.map((order: any) => ({
            //...order,
            //notifications: this.notifications.filter(n => n.order_request_id === order.id)
          //}));
        }
      });
  }

  // -----------------------------
  // Paginación
  // -----------------------------
  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;

    if (this.searchQuery) {
      this.searchSubject.next(this.searchQuery);
    } else {
      this.loadOrders();
    }
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  getPageNumbers(): number[] {
    const totalPages = this.totalPages;
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: number[] = [];
    pages.push(1);

    if (this.currentPage > 3) pages.push(-1); // Ellipsis

    const start = Math.max(2, this.currentPage - 1);
    const end = Math.min(totalPages - 1, this.currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (this.currentPage < totalPages - 2) pages.push(-1); // Ellipsis

    pages.push(totalPages);

    return pages;
  }

  // -----------------------------
  // Navegación y acciones
  // -----------------------------
  navigateToCreate(): void {
    this.router.navigate(['/ordenpedido/opcreate'], { queryParams: { mode: 'create_sf' } });
  }

  navigateToEdit(orderId: number): void {
  this.router.navigate(['/ordenpedido/opedit', orderId], { queryParams: { mode: 'update' } });
}

  navigateToValidate(orderId: number): void {
  // Área 2 (validar SF) Activo desde boton.
  
    this.router.navigate(['/ordenpedido/opcreate', orderId], { queryParams: { mode: 'validate_sf' } });
    return;
    
  }
  // Área 1: asignar número de orden (antes usabas 'validate')
  navigateToAddOrderNumber(orderId: number): void {
    this.router.navigate(['/ordenpedido/opcreate', orderId], { queryParams: { mode: 'add_order_number' } });
  }


 navigateToInvoices(order: any): void {
  this.router.navigate(
    ['/ordenpedido/invoices', order.id],
    {
      queryParams: {
        provider_id: order.provider_id,
        foliosf: order.foliosf,
        order_number: order.order_number
      }
    }
  );
}

  downloadPdf(orderId: number): void {
    this.isLoading = true;
    this.orderService.getOrderPdf(orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const order: any = this.orders.find(o => o.id === orderId);
          a.download = order?.status === 'validated_sf'
            ? `suficiencia_${order?.foliosf}.pdf`
            : `order_${order?.order_number}.pdf`;
          a.click();
          window.URL.revokeObjectURL(url);
          this.isLoading = false;
          this.showNotification('success', 'PDF descargado exitosamente.');
        },
        error: () => {
          this.isLoading = false;
          this.showNotification('error', 'No se pudo descargar el PDF.');
        }
      });
  }

  uploadInvoice(orderId: number): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('order_request_id', orderId.toString());
        this.orderService.createInvoice(formData)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (response) => {
              this.showNotification('success', response?.message || 'Factura subida exitosamente.');
            },
            error: (err) => {
              this.showNotification('error', err?.message || 'Error al subir la factura.');
            }
          });
      }
    };
    input.click();
  }

  dismissNotification(notificationId: number): void {
    console.log('Cerrando notificación:', notificationId);
    this.orderService.markNotificationAsRead(notificationId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.notifications = this.notifications.filter(n => n.id !== notificationId);
          this.orders = this.orders.map((order: any) => ({
            ...order,
            notifications: (order.notifications || []).filter((n: any) => n.id !== notificationId)
          }));
          this.showNotification('success', 'Notificación cerrada exitosamente.');
        },
        error: (err) => {
          this.showNotification('error', 'No se pudo cerrar la notificación: ' + (err?.message || ''));
        }
      });
  }

  // -----------------------------
  // Utilidades de UI
  // -----------------------------
  showNotification(type: 'success' | 'error', message: string): void {
    Swal.fire({
      title: type === 'success' ? '¡Éxito!' : '¡Error!',
      text: message,
      icon: type,
      background: '#fff3cd',
      customClass: { popup: 'post-it-notification' },
      showConfirmButton: false,
      timer: 3000,
      position: 'top-end'
    });
  }

  getReceiveDotClass(order: any): string {
  const { received_items, total_items, status } = order || {};
  if (Number.isFinite(received_items) && Number.isFinite(total_items) && total_items > 0) {
    if (received_items <= 0)          return 'sem-yellow';
    if (received_items < total_items) return 'sem-orange'; // ← pulso aquí
    return 'sem-green';
  }
  if (status === 'pending_warehouse')  return 'sem-yellow';
  if (status === 'partially_received') return 'sem-orange'; // ← pulso aquí
  if (status === 'completed')          return 'sem-green';
  return 'sem-gray';
}

getReceiveTooltip(order: any): string {
  const st = (order?.status || '').toLowerCase();
  if (st === 'pending_warehouse')  return 'Pendiente de recepción';
  if (st === 'partially_received') return 'Recepción parcial';
  if (st === 'completed')          return 'Recepción completa';
  return 'Estatus no disponible';
}





  getSemaforoClass(status: string): string {
  switch ((status || '').toLowerCase()) {
    case 'pending_warehouse':   return 'badge badge--yellow';  // amarillo sólido
    case 'partially_received':  return 'badge badge--orange';  // naranja sólido
    case 'completed':           return 'badge badge--green';   // verde sólido
    default:                    return 'badge badge-secondary';
  }
}
  getStatusLabel(status: string): string {
    switch (status) {
      case 'pending_sf_validation': return 'Pendiente de Validación';
      case 'validate_sf':         return 'Validada (Asignar Orden)';
      case 'pending_warehouse':    return 'Pendiente en Almacén';
      case 'partially_received':   return 'Parcialmente Recibida';
      case 'completed' :           return 'Completada'
      default:                     return status || '—';
    }
  }

  trackByOrder(_: number, item: any): number {
    return item?.id ?? _;
  }

  trackByNotification(_: number, item: any): number {
    return item?.id ?? _;
  }

  trackByPage(_: number, page: number): number {
    return page;
  }

  deleteOrder(order: any): void {
    Swal.fire({
      title: '¿Eliminar?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    }).then(result => {
      if (!result.isConfirmed) return;

      this.orderService.deleteOrder(order.id).subscribe({
        next: (res) => {
          Swal.fire('Eliminado', res?.message || 'Orden eliminada correctamente.', 'success');
          // Recargar la lista (o quitar la fila localmente)
          this.loadOrders();
          // O si prefieres navegar:
          // this.router.navigate(['/ordenpedido/oplist']);
        },
        error: (err) => {
          const msg = err?.error?.message || err?.message || 'No se pudo eliminar.';
          Swal.fire('Error', msg, 'error');
        }
      });
    });
  }

  goToReceive(order: any) {
  if (!order?.id) return;
  this.router.navigate(['/ordenpedido/receive', order.id], { queryParams: { mode: 'receive' } });
}
}

  /*/ Criterio: preferimos progress proveniente de API; si no, usando status
getReceiveBtnClass(order: any): string {
  const { received_items, total_items, status } = order || {};

  // 1) si la API ya da totales:
  if (Number.isFinite(received_items) && Number.isFinite(total_items) && total_items > 0) {
    if (received_items <= 0)        return 'btn-light-warning';  // amarillo
    if (received_items < total_items) return 'btn-light-orange'; // naranja
    return 'btn-light-success';                                   // verde
  }

  // 2) fallback por status
  if (status === 'pending_warehouse')  return 'btn-light-warning';
  if (status === 'partially_received') return 'btn-light-orange';
  if (status === 'completed')          return 'btn-light-success';
  return 'btn-light-secondary';
}

getReceiveToolt(order: any): string {
  const { received_items, total_items, status } = order || {};
  if (Number.isFinite(received_items) && Number.isFinite(total_items) && total_items > 0) {
    return `Recibidos ${received_items}/${total_items}`;
  }
  const map: any = {
    pending_warehouse: 'Pendiente de recepción',
    partially_received: 'Recepción parcial',
    completed: 'Recepción completa'
  };
  return map[status] || 'Recepción';
}
*/







