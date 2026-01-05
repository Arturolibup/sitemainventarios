import { Component, OnDestroy, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { FormGroup, FormBuilder, FormArray, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { AuthService } from '../../auth';
import { OpserviceService } from '../service/opservice.service';

type ReceiveLine = {
  id: number;
  quantity: number;
  received_quantity: number;
  is_delivered: boolean;
  observations: string | null;
};

@Component({
  selector: 'app-op-receive',
  templateUrl: './op-receive.component.html',
  styleUrls: ['./op-receive.component.scss']
})
export class OpReceiveComponent implements OnInit, OnDestroy {
  orderId!: number;
  isLoading = false;

  orderForm!: FormGroup;
  format_type: 'REFACCIONES' | 'PRODUCTOS' | 'FERRETERIA' | string = 'PRODUCTOS';

  notifications: any[] = [];
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OpserviceService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef,  // 👈 fuerza render/markForCheck
    private ngZone: NgZone           // 👈 asegura correr dentro de Angular
  ) {}

  // -------------------- Lifecycle --------------------

  ngOnInit(): void {
    console.group('[OpReceive] ngOnInit');
    console.log('hasPermission(receive):', this.auth.hasPermission('orders.receive'));
    console.log('route id param:', this.route.snapshot.params['id']);
    console.groupEnd();

    if (!this.auth.hasPermission('orders.receive')) {
      Swal.fire('Acceso denegado', 'No tienes permiso para recibir productos.', 'error')
        .then(() => this.router.navigate(['/ordenpedido/oplist']));
      return;
    }

    const idParam = this.route.snapshot.params['id'];
    this.orderId = Number(idParam);
    if (!this.orderId || Number.isNaN(this.orderId)) {
      Swal.fire('Error', 'Identificador de orden inválido.', 'error')
        .then(() => this.router.navigate(['/ordenpedido/oplist']));
      return;
    }

    this.buildForm();
    this.loadOrder();
    this.loadNotifications(this.orderId);

    this.orderForm.get('format_type')?.valueChanges.subscribe(v => {
      this.format_type = (v || '').toUpperCase();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // -------------------- Form --------------------

  private buildForm(): void {
    this.orderForm = this.fb.group({
      // encabezado
      order_number: [{ value: '', disabled: true }],
      foliosf: [{ value: '', disabled: true }],
      provider_name: [{ value: '', disabled: true }],
      brand: [{ value: '', disabled: true }],
      date: [{ value: '', disabled: true }],
      date_limited: [{ value: '', disabled: true }],
      requester_area_name: [{ value: '', disabled: true }],
      requester_subarea_name: [{ value: '', disabled: true }],
      
      delivery_place: [{ value: '', disabled: true }],
      general_observations: [''],
      format_type: ['PRODUCTOS'],   // ← usado en el *ngIf del HTML

      // productos (tabla)
      products: this.fb.array([]),
    });

    console.log('[OpReceive] buildForm -> de order.Form inicial:', this.orderForm.value);
  }

  get productsFormArray(): FormArray {
    return this.orderForm.get('products') as FormArray;
  }

  // Valida 0 <= recibido <= cantidad (input por fila)
  validateReceivedQuantity(i: number): void {
    const row = this.productsFormArray.at(i) as FormGroup;
    if (!row) return;

    const qty = Number(row.get('quantity')?.value ?? 0);
    const rec = Number(row.get('received_quantity')?.value ?? 0);

    if (Number.isNaN(rec) || rec < 0 || rec > qty) {
      row.get('received_quantity')?.setErrors({ invalidReceivedQuantity: true });
    } else {
      row.get('received_quantity')?.setErrors(null);
    }
  }

  // trackBy para *ngFor de productos
  trackByProduct(index: number, ctrl: AbstractControl): any {
    return ctrl.get('id')?.value
      ?? ctrl.get('product_id')?.value
      ?? index;
  }

  // Crea una fila de producto normalizada
  private addProductRow(p: any): void {
    const fg = this.fb.group({
      id: [p.id],
      description: [{ value: p.description || p.title || '', disabled: true }],
      unit_nombre: [{ value: p.unit_nombre || '', disabled: true }],
      quantity: [{ value: Number(p.quantity) || 0, disabled: true }],
      brand: [{ value: p.brand || '', disabled: true }],
      unit_price: [{ value: Number(p.unit_price) || 0, disabled: true }],
      amount: [{ value: (Number(p.quantity)||0) * (Number(p.unit_price)||0), disabled: true }],

      // automotriz
      placa: [{ value: p.placa || '', disabled: true }],
      marca_nombre: [{ value: p.marca_nombre || p.marca?.nombre || p.brand || '', disabled: true }],
      tipo_nombre: [{ value: p.tipo_nombre || p.tipo?.nombre || '', disabled: true }],
      modelo: [{ value: p.modelo || '', disabled: true }],
      cilindro: [{ value: p.cilindro || '', disabled: true }],

      // edición de recepción
      received_quantity: [Number(p.received_quantity) || 0, [Validators.min(0)]],
      is_delivered: [!!p.is_delivered],
      observations: [p.observations || '']
    });

    // regla por fila: 0 <= recibido <= cantidad
    fg.setValidators(() => {
      const qty = Number(fg.get('quantity')?.value || 0);
      const rec = Number(fg.get('received_quantity')?.value || 0);
      return (rec < 0 || rec > qty) ? { invalidReceivedQuantity: true } : null;
    });

    this.productsFormArray.push(fg);
    // Si usas OnPush, marca la vista:
    this.cdr.markForCheck();
  }

  // -------------------- Carga / Normalización --------------------

  private loadOrder(): void {
    console.group('[OpReceive] loadOrder');
    this.isLoading = true;
    console.log('orderId:', this.orderId);

    this.orderService.getOrderById(this.orderId).pipe(
      catchError((err) => {
        console.error('[OpReceive] getOrderById ERROR:', err);
        this.isLoading = false;
        Swal.fire('Error', 'No se pudo cargar la orden.', 'error');
        this.router.navigate(['/ordenpedido/oplist']);
        console.groupEnd();
        return of(null);
      }),
      takeUntil(this.destroy$)
    ).subscribe(order => {
      this.isLoading = false;
      if (!order) return;

      // Aseguramos correr en la zona de Angular para que detecte cambios
      this.ngZone.run(() => {
        // DUMPS (útiles mientras pruebas)
        console.log('RAW order:', order);
        console.log('RAW order.products:', order?.products);

        // encabezado
        this.orderForm.patchValue({
          order_number: order.order_number || '',
          foliosf: order.foliosf || '',
          brand: order.brand || '',
          provider_name: order?.provider?.full_name || '',
          date: this.toYmd(order.date),                      // ← formateado
          date_limited: this.pickLimitedDate(order), 
          delivery_place: order.delivery_place || '',
          requester_area_name:
            order.requester_area_name || order.requester_area?.name || '',
          requester_subarea_name:
            order.requester_subarea_name ||
            order.requester_subarea?.name || '',  
          general_observations: order.general_observations || '',
          format_type: (order.format_type || 'PRODUCTOS').toUpperCase()
        }, { emitEvent: false });

        this.format_type = (order.format_type || 'PRODUCTOS').toUpperCase();

        // productos (normalizados)
        const lines = this.normalizeOrderLines(order);
        console.log('[receive] productos normalizados:', lines.length);
        if (lines[0]) console.log('normalizeOrderLines -> first line sample:', lines[0]);

        this.productsFormArray.clear();
        lines.forEach(p => this.addProductRow(p));

        // Actualiza validez y fuerza render
        this.orderForm.updateValueAndValidity({ emitEvent: false });

        // Forzar refresco de la UI (especialmente con OnPush)
        this.cdr.detectChanges();

        console.log('[UI CHECK] productsFormArray.length (post-detect):', this.productsFormArray.length);
        console.log('[UI CHECK] orderForm.format_type:', this.orderForm.get('format_type')?.value);
        console.groupEnd();
      });
    });
  }

  /** Regresa 'YYYY-MM-DD' si recibe un ISO como '2025-10-12T07:00:00.000000Z' */
private toYmd(dateStr: any): string {
  if (!dateStr || typeof dateStr !== 'string') return '';
  // Si ya viene como YYYY-MM-DD, úsalo tal cual:
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // Si viene ISO: 'YYYY-MM-DDTHH:mm:ss...'
  const m = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

/** Fallback: intenta con 'date_limited' o 'date_limit' */
private pickLimitedDate(order: any): string {
  const raw = order?.date_limited ?? order?.date_limit ?? '';
  return this.toYmd(raw);
}
  /** Normaliza líneas como en edit.ts (soporta varias formas de payload) */
  private normalizeOrderLines(order: any): Array<any> {
    console.group('[OpReceive] normalizeOrderLines');
    let raw: any = order?.products ?? order?.order_products ?? order?.items ?? order?.details ?? [];
    console.log('INPUT keys:', Object.keys(order || {}));
    console.log('raw (pre):', raw);

    if (raw && typeof raw === 'object' && Array.isArray(raw.data)) {
      console.log('Detectado paginado: products.data');
      raw = raw.data;
    }
    if (!Array.isArray(raw)) {
      console.warn('raw NO es array. Se forza a []');
      raw = [];
    }
    console.log('raw (post ensure array) length:', raw.length);

    const lines = raw.map((item: any, idx: number) => {
      const description =
        item.description ?? item.title ?? item.name ?? item.product?.title ?? item.product?.name ?? '';

      const unit_nombre =
        item.unit_nombre ?? item.unit_label ?? item.unit?.nombre ?? item.unit?.name ?? item.unit_name ?? '';
      const brand = item.brand ?? item.product?.brand ?? '';        item.brand ?? item.product?.brand ?? '';
      const quantity = Number(item.quantity ?? item.qty ?? item.pivot?.quantity ?? 0);
      const unit_price = Number(item.unit_price ?? item.price ?? item.pivot?.unit_price ?? 0);
      const received_quantity = Number(item.received_quantity ?? item.pivot?.received_quantity ?? 0);
      const is_delivered = Boolean(item.is_delivered ?? item.pivot?.is_delivered ?? false);
      const observations = item.observations ?? item.pivot?.observations ?? null;

      const id =
        item.id ?? item.order_product_id ?? item.pivot?.id ?? item.product_id ?? null;

      const mapped = {
        id,
        description,
        unit_nombre,
        brand,
        quantity,
        unit_price,
        amount: Number((quantity * unit_price).toFixed(2)),

        // automotriz (si aplica)
        placa: item.placa ?? '',
        marca_nombre: item.marca?.nombre ?? item.marca_nombre ?? item.brand ?? '',
        tipo_nombre: item.tipo?.nombre ?? item.tipo_nombre ?? '',
        modelo: item.modelo ?? '',
        cilindro: item.cilindro ?? '',

        received_quantity,
        is_delivered,
        observations
      };
      if (idx < 3) console.log(`mapped[${idx}]:`, mapped);
      return mapped;
    });

    console.log('lines length:', lines.length);
    console.groupEnd();
    return lines;
  }

  // -------------------- Acciones --------------------

  submit(): void {
    if (!this.orderId) return;

    // Re-valida filas
    for (let i = 0; i < this.productsFormArray.length; i++) {
      const g = this.productsFormArray.at(i);
      g.updateValueAndValidity({ onlySelf: true });
    }
    if (this.orderForm.invalid) {
      Swal.fire('Error', 'Verifica las cantidades recibidas.', 'error');
      return;
    }

    // Payload
    const raw = this.orderForm.getRawValue();
    const lines: ReceiveLine[] = (raw.products || []).map((p: any, idx: number) => ({
      id: Number(p.id),
      quantity: Number((this.productsFormArray.at(idx)?.get('quantity')?.value) || 0),
      brand: this.productsFormArray.at(idx)?.get('brand')?.value || '',
      received_quantity: Number(p.received_quantity) || 0,
      is_delivered: !!p.is_delivered,
      observations: p.observations || null
    }));

    // Estatus según recepción
    const allReceived = lines.length > 0 && lines.every(x => x.received_quantity >= x.quantity && x.quantity > 0);
    const anyReceived = lines.some(x => x.received_quantity > 0);
    const status: 'completed' | 'partially_received' | 'pending_warehouse' =
      allReceived ? 'completed' : (anyReceived ? 'partially_received' : 'pending_warehouse');

    const body = {
      general_observations: raw.general_observations || '',
      products: lines.map(l => ({
        id: l.id,
        received_quantity: l.received_quantity,
        
        is_delivered: l.is_delivered,
        observations: l.observations
      })),
      status
    };

    this.isLoading = true;
    this.orderService.receiveProducts(this.orderId, body).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.isLoading = false;

        // notificación realtime
        const userId = this.auth.currentUserValue?.id;
        if (userId) {
          this.orderService.createNotification({
            user_id: userId,
            order_request_id: this.orderId,
            message: `Recepción ${status === 'completed' ? 'COMPLETA' : (status === 'partially_received' ? 'PARCIAL' : 'SIN CAMBIOS')} registrada.`
          }).subscribe({ error: () => {} });
        }

        Swal.fire({
          icon: 'success',
          title: 'Recepción registrada',
          text:
            status === 'completed'
              ? 'Se recibió el total de productos.'
              : status === 'partially_received'
              ? 'Se registró recepción parcial.'
              : 'No hubo cambios en la recepción.',
          showCancelButton: true,
          confirmButtonText: 'Volver a la lista',
          cancelButtonText: 'Seguir aquí'
        }).then(r => {
          if (r.isConfirmed) this.router.navigate(['/ordenpedido/oplist']);
        });
      },
      error: (err) => {
        this.isLoading = false;
        // Mensaje del backend
        const backendMsg = (err?.error?.message || err?.message || '').toString().toLowerCase();

        // Caso especial: "La orden no está en estado para recepción"
        if (backendMsg.includes('no está en estado para recepción') || backendMsg.includes('estado para recepción')) {
          Swal.fire({
            icon: 'warning',
            title: 'No es posible registrar la recepción',
            text: 'Aún no se ha asignado número de orden.',
            confirmButtonText: 'Ir a la lista'
          }).then(() => this.router.navigate(['/ordenpedido/oplist']));
          return;
        }

        // Genérico
        Swal.fire('Error', 'No se pudo registrar la recepción.', 'error');
      }
    });
}

  cancel(): void {
    this.router.navigate(['/ordenpedido/oplist']);
  }

  // -------------------- Notificaciones --------------------

  private loadNotifications(orderId: number): void {
    if (!orderId) { this.notifications = []; return; }
    this.orderService.getNotifications(orderId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        const arr = Array.isArray(res?.notifications) ? res.notifications : [];
        this.notifications = arr.filter((n: any) => !n.is_read);
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  markNotificationAsRead(id: number): void {
    this.orderService.markNotificationAsRead(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.notifications = this.notifications.map(n =>
          n.id === id ? { ...n, is_read: true } : n
        );
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }
}
