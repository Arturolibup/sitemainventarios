import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, of, forkJoin } from 'rxjs';
import { catchError, finalize, map, takeUntil } from 'rxjs/operators';
import { AuthService } from '../../auth';
import { OpserviceService } from '../service/opservice.service';

@Component({
  selector: 'app-op-receive-list',
  templateUrl: './op-receive-list.component.html',
  styleUrls: ['./op-receive-list.component.scss']
})
export class OpReceiveListComponent implements OnInit, OnDestroy {
  isLoading = false;
  query = '';
  itemsPerPage = 10;
  page = 1;
  total = 0;

  orders: any[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private orderService: OpserviceService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.auth.hasPermission('orders.receive')) {
      this.router.navigate(['/ordenpedido/oplist']);
      return;
    }
    this.load();
  }

  /**
   * Carga la lista.
   * 1) Si existe orderService.listOrders -> la usa.
   * 2) Si NO existe -> fallback: combina getOrders(pending_warehouse) + getOrders(partially_received)
   */
  load(): void {
    console.log('🟦 Cargando lista...');
    this.isLoading = true;

    // @ts-ignore - detectamos si el método está definido en runtime
    if (typeof this.orderService.listOrders === 'function') {
      // ✅ Camino principal (service tiene listOrders)
      // @ts-ignore
      this.orderService.listOrders({
        page: this.page,
        per_page: this.itemsPerPage,
        status_in: ['pending_warehouse', 'partially_received'],
        q: this.query || '',
        sort: 'created_at',
        direction: 'desc'
      })
      .pipe(
        catchError(() => of({ data: [], total: 0 })),
        finalize(() => (this.isLoading = false)),
        takeUntil(this.destroy$)
      )
      .subscribe((res: any) => {
        const data = res?.data || res?.orders || [];
        this.orders = data;
        this.total = Number(res?.total || data.length || 0);
      });

    } else {
      // 🔁 Fallback: NO hay listOrders → combinamos dos llamadas de getOrders.
      // IMPORTANTE: getOrders maneja paginación por status por separado,
      // así que aquí haremos paginación en cliente para el combinado total.

      const perPageForEach = 200; // trae “bastante” por status para poder paginar en cliente
      const pageForEach = 1;      // primera página de cada status

      const q = this.query || '';

      forkJoin([
        this.orderService.getOrders(pageForEach, perPageForEach, q, 'pending_warehouse')
          .pipe(catchError(() => of({ data: [], meta: { total: 0 } }))),
        this.orderService.getOrders(pageForEach, perPageForEach, q, 'partially_received')
          .pipe(catchError(() => of({ data: [], meta: { total: 0 } })))
      ])
      .pipe(
        map(([resA, resB]: any[]) => {
          const a = resA?.data || [];
          const b = resB?.data || [];
          // combinamos
          let merged = [...a, ...b];

          // Orden descendente por created_at si existe, si no, por id
          merged.sort((x: any, y: any) => {
            const dx = new Date(x.created_at || x.createdAt || 0).getTime();
            const dy = new Date(y.created_at || y.createdAt || 0).getTime();
            if (dx !== dy) return dy - dx;
            return (y.id || 0) - (x.id || 0);
          });

          const total = merged.length;

          // paginación en cliente
          const start = (this.page - 1) * this.itemsPerPage;
          const end = start + this.itemsPerPage;
          const pageSlice = merged.slice(start, end);

          return { data: pageSlice, total };
        }),
        finalize(() => (this.isLoading = false)),
        takeUntil(this.destroy$)
      )
      .subscribe(({ data, total }) => {
        this.orders = data || [];
        this.total = Number(total || 0);
      });
    }
  }

  onSearchChange(value: string): void {
    this.query = value;
    this.page = 1;
    this.load();
  }

  goToReceive(order: any): void {
    if (!order?.id) return;
    this.router.navigate(['/ordenpedido/receive', order.id], { queryParams: { mode: 'receive' } });
  }

  onPageChange(page: number): void {
    if (page < 1) return;
    this.page = page;
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // trackBy para performance
trackByOrder = (_: number, item: any) => item?.id ?? _;

// badge/semaforo según status
getSemaforoClass(status: string): string {
  switch ((status || '').toLowerCase()) {
    case 'pending_warehouse':
      return 'badge badge-warning';     // amarillo
    case 'partially_received':
      return 'badge badge-orange';      // naranja (ver style en el HTML)
    case 'completed':
      return 'badge badge-success';     // verde
    default:
      return 'badge badge-secondary';   // gris por si acaso
  }
}

// etiqueta amigable
getStatusLabel(status: string): string {
  switch ((status || '').toLowerCase()) {
    case 'pending_warehouse': return 'Pendiente';
    case 'partially_received': return 'Parcial';
    case 'completed': return 'Completa';
    default: return '—';
  }
}
}
