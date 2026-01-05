import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { RequisitionService } from '../../services/requisition.service';
import { NotificationService } from 'src/app/services/notification.service';
import Swal from 'sweetalert2';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { RequisitionCallService } from '../../services/requisition-call.service';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-requisition-create',
  templateUrl: './requisition-create.component.html',
  styleUrls: ['./requisition-create.component.scss']
})
export class RequisitionCreateComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  loading = false;
  products: any[] = [];
  destroy$ = new Subject<void>();
  savedRequisitionId?: number | null = null; // <- guardaremos aquí el ID creado
  isEditMode = false;
  requisitionTitle: string | null = null;

  constructor(
    private fb: FormBuilder,
    private requisitionService: RequisitionService,
    private callService: RequisitionCallService,
    private notificationService: NotificationService,
    private requisitionCallService: RequisitionCallService,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  
  

ngOnInit(): void {
    console.log('🧩 Inicializando RequisitionCreateComponent');
    this.loading = false;
    this.products = [];
    this.savedRequisitionId = null;
    this.isEditMode = false;

    const id = this.route.snapshot.paramMap.get('id');
    console.log('🧩 ID desde la ruta:', id);
    this.initForm();

    if (id) {
      this.isEditMode = true;
      console.log('🧩 Modo edición:', this.isEditMode);
      console.log('🧩 Entrando en modo edición para ID:', id);
      this.loadRequisition(Number(id));
    } else {
      console.log('🧩 Modo edición:', this.isEditMode);
      console.log('🧩 Entrando en modo creación');
      this.loadActiveCall();
    }
  }



  private initForm(): void {
    this.form = this.fb.group({
      requisition_call_id: [null, Validators.required],
      area_id: [null, Validators.required],
      subarea_id: [null, Validators.required],
      items: this.fb.array([])
    });
  }

  get items(): FormArray {
    return this.form.get('items') as FormArray;
  }




  /** 🔹 Enviar requisición */
  sendRequisition(): void {
    const id = this.savedRequisitionId;
    if (!id) {
      Swal.fire('Atención', 'Primero guarda el borrador antes de enviar.', 'info');
      return;
    }

    Swal.fire({
      title: '¿Enviar requisición?',
      text: 'Una vez enviada no podrás modificar las cantidades.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, enviar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (!result.isConfirmed) return;

      this.loading = true;
      this.requisitionService.submitRequisition(id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            Swal.fire('Enviada', res.message, 'success');
            this.loading = false;
          },
          error: () => (this.loading = false)
        });
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


/** 🔹 Carga convocatoria activa */
private loadActiveCall(): void {
  console.log('🧩 Cargando convocatoria activa');
  this.loading = true;
  this.callService.getActive()
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res: any | null) => {
        console.log('🧩 Respuesta de getActive:', res);
        if (!res || !res.id || !res.success) {
          console.error('🧩 No se encontró convocatoria activa o respuesta inválida:', res);
          Swal.fire('Atención', 'No hay convocatorias activas o la respuesta es inválida.', 'info');
          this.loading = false;
          return;
        }
        console.log('🧩 Convocatoria activa encontrada, ID:', res.id);
        this.form.patchValue({ requisition_call_id: res.id });
        this.loadProducts(res.id);
      },
      error: (err) => {
        console.error('🧩 Error cargando convocatoria activa:', err);
        Swal.fire('Error', 'No se pudo cargar la convocatoria activa.', 'error');
        this.loading = false;
      }
    });
}

/** 🔹 Carga productos de la convocatoria */
private loadProducts(callId: number): void {
  console.log('🧩 Cargando productos para call ID:', callId);
  this.callService.getById(callId)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res: any) => {
        console.log('🧩 Respuesta de getById (productos):', res);
        if (!res || !res.success || !Array.isArray(res.products)) {
          console.error('🧩 Respuesta inválida o sin productos:', res);
          Swal.fire('Error', 'No se pudieron cargar los productos de la convocatoria.', 'error');
          this.products = [];
          this.items.clear();
          this.loading = false;
          return;
        }

        const list = res.products || [];
        this.products = list;
        this.items.clear();

        list.forEach((i: any) => {
          try {
            this.items.push(this.fb.group({
              item_id: [i.id || null, Validators.required],
              product_name: [i.product?.title || i.product?.name || 'Producto', Validators.required],
              requested_qty: [0, [Validators.required, Validators.min(1)]],
              unit_id: [i.unit?.id || i.product?.unit_id || null], // 👈 agregado
              unit_name: [i.unit?.name || '-', Validators.required],
              notes: ['']
            }));
          } catch (err) {
            console.error('🧩 Error al procesar producto:', i, err);
          }
        });

        console.log('🧩 FormArray items después de cargar productos:', this.items.value);
        console.log('🧩 Products asignados:', this.products);
        this.loading = false;
      },
      error: (err) => {
        console.error('🧩 Error cargando productos:', err);
        Swal.fire('Error', 'No se pudieron cargar los productos.', 'error');
        this.products = [];
        this.items.clear();
        this.loading = false;
      }
    });
}


/** Carga una requisición existente para edición (modo edición) */
private loadRequisition(id: number): void {
  console.log('Iniciando carga de requisición ID:', id);
  this.loading = true;

  this.requisitionService.getRequisitionForEdit(id)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res: any) => {
        console.log('✅ Respuesta completa de getRequisitionForEdit:', res);

        // 🔹 Normalizar estructura (acepta ambas variantes del servicio)
        const req = res.data || res;
        const items = req.items || res.items || [];

        console.log('📦 Items recibidos:', items);

        // 🔹 Validar datos mínimos
        if (!req.id || !Array.isArray(items)) {
          Swal.fire('Error', 'Datos de requisición inválidos.', 'error');
          this.loading = false;
          this.cdr.detectChanges();
          return;
        }

        // 🔹 Guardar ID y título
        this.savedRequisitionId = req.id;
        this.requisitionTitle = req.call?.title || 'Sin título';
        console.log('savedRequisitionId:', this.savedRequisitionId);
        console.log('requisitionTitle:', this.requisitionTitle);

        // 🔹 Rellenar formulario base
        this.form.patchValue({
          requisition_call_id: req.requisition_call_id,
          area_id: req.area_id,
          subarea_id: req.subarea_id
        });

        // 🔹 Limpiar y cargar items
        this.items.clear();

        if (items.length === 0) {
          console.warn('⚠️ La requisición no tiene productos cargados.');
        }

        items.forEach((i: any) => {
          this.items.push(this.fb.group({
            item_id: [i.id, Validators.required],
            product_name: [i.product?.title || i.product?.name || '-', Validators.required],
            requested_qty: [i.requested_qty ?? 0, [Validators.required, Validators.min(0)]],
            unit_id: [i.unit?.id || null],
            unit_name: [i.unit?.name || '-', Validators.required],
            notes: [i.notes || '']
          }));
        });

        this.loading = false;
        this.cdr.detectChanges();
        console.log('FormArray items cargado:', this.items.value);
      },
      error: (err) => {
        console.error('❌ Error al cargar requisición:', err);
        Swal.fire('Error', 'No se pudo cargar la requisición.', 'error');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
}

get itemsArray() {
  return this.form.get('items') as FormArray | null;
}
/** Guardar borrador: crea nueva o actualiza existente */
saveDraft(): void 
{
  console.log('Iniciando saveDraft - Formulario:', this.form.value);
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    Swal.fire('Atención', 'Completa todos los campos requeridos.', 'warning');
    return;
  }

  Swal.fire({
    title: '¿Guardar borrador?',
    text: 'Podrás editarlo más tarde.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, guardar'
  }).then(result => {
    if (!result.isConfirmed) return;

    this.loading = true;
    this.cdr.detectChanges();

    const itemsPayload = this.items.value.map((i: any) => ({
      item_id: i.item_id,
      requested_qty: i.requested_qty,
      unit_id: i.unit_id,
      notes: i.notes
    }));

    const request$ = this.isEditMode && this.savedRequisitionId
      ? this.requisitionService.updateRequisitionDraft(this.savedRequisitionId, itemsPayload)
      : this.requisitionService.saveDraftFromCall({
          requisition_call_id: this.form.get('requisition_call_id')?.value,
          area_id: this.form.get('area_id')?.value,
          subarea_id: this.form.get('subarea_id')?.value,
          items: itemsPayload
        });

    request$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: any) => {
        this.savedRequisitionId = res.data?.id || this.savedRequisitionId;
        console.log('Borrador guardado, ID:', this.savedRequisitionId);

        Swal.fire({
          title: '¡Guardado!',
          text: this.isEditMode ? 'Borrador actualizado.' : 'Borrador creado.',
          icon: 'success'
        }).then(() => {
          this.router.navigate(['/requisitions/my']);
        });

        this.loading = false;
      },
      error: (err) => {
        console.error('Error al guardar borrador:', err);
        Swal.fire('Error', err.message || 'No se pudo guardar.', 'error');
        this.loading = false;
      }
    });
  });
}

/** Enviar requisición a aprobación */
submitRequisition(): void 
{
  console.log('Iniciando submitRequisition');
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    Swal.fire('Atención', 'Completa los campos requeridos.', 'warning');
    return;
  }

  if (!this.savedRequisitionId) {
    Swal.fire('Info', 'Guarda el borrador primero.', 'info');
    return;
  }

  Swal.fire({
    title: '¿Enviar requisición?',
    text: 'No podrás modificarla después.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, enviar'
  }).then(result => {
    if (!result.isConfirmed) return;

    this.loading = true;
    this.cdr.detectChanges();

    this.requisitionService.sendRequisition(this.savedRequisitionId!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          console.log('Requisición enviada:', res);
          Swal.fire({
            title: '¡Enviada!',
            text: res.message || 'Tu requisición fue enviada correctamente.',
            icon: 'success'
          }).then(() => {
            this.router.navigate(['/requisitions/my']);
          });
          this.loading = false;
        },
        error: (err) => {
          console.error('Error al enviar:', err);
          Swal.fire('Error', err.message || 'No se pudo enviar.', 'error');
          this.loading = false;
        }
      });
  });
}


reloadFromCall(): void {
  const callId = this.form.get('requisition_call_id')?.value;
  if (!callId || !this.isEditMode) return;

  Swal.fire({
    title: '¿Recargar productos?',
    text: 'Se resetearán todas las cantidades a 0 y se recargarán los productos de la convocatoria.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, recargar',
    cancelButtonText: 'Cancelar'
  }).then(result => {
    if (!result.isConfirmed) return;

    this.loading = true;
    this.callService.getById(callId).subscribe({
      next: (res: any) => {
        const list = res.products || [];
        this.items.clear();

        list.forEach((i: any) => {
          this.items.push(this.fb.group({
            item_id: [null], // será nuevo o sobrescrito
            product_name: [i.product?.title || 'Producto', Validators.required],
            requested_qty: [0, [Validators.required, Validators.min(0)]],
            unit_id: [i.unit?.id || i.product?.unit_id || null],
            unit_name: [i.unit?.name || '-', Validators.required],
            notes: ['']
          }));
        });

        this.loading = false;
        Swal.fire('Listo', 'Productos recargados. Ahora edita las cantidades.', 'success');
      },
      error: () => {
        this.loading = false;
        Swal.fire('Error', 'No se pudieron cargar los productos.', 'error');
      }
    });
  });
}
}



/** Carga una requisición existente para edición (modo edición) 
private loadRequisition(id: number): void 
{
  console.log('Iniciando carga de requisición ID:', id);
  this.loading = true;

  this.requisitionService.getRequisitionForEdit(id)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res: any) => {
        console.log('✅ Respuesta completa de getRequisitionForEdit:', res);
        console.log('📦 Items recibidos:', res.data?.items || res.items);
        if (!res.success || !res.data) {
          Swal.fire('Error', res.message || 'No se encontró la requisición.', 'error');
          this.loading = false;
          this.cdr.detectChanges();
          return;
        }

        const req = res.data;
        console.log('Datos de requisición cargada:', req);

        if (!req.id || !Array.isArray(req.items)) {
          Swal.fire('Error', 'Datos de requisición inválidos.', 'error');
          this.loading = false;
          return;
        }

        // Guardar ID y título
        this.savedRequisitionId = req.id;
        this.requisitionTitle = req.call?.title || 'Sin título';
        console.log('savedRequisitionId:', this.savedRequisitionId);
        console.log('requisitionTitle:', this.requisitionTitle);

        // Rellenar formulario base
        this.form.patchValue({
          requisition_call_id: req.requisition_call_id,
          area_id: req.area_id,
          subarea_id: req.subarea_id
        });

        // Limpiar y cargar items
        this.items.clear();
        req.items.forEach((i: any) => {
          this.items.push(this.fb.group({
            item_id: [i.id, Validators.required],
            product_name: [i.product?.title || i.product?.name || '-', Validators.required],
            requested_qty: [i.requested_qty ?? 0, [Validators.required, Validators.min(0)]],
            unit_id: [i.unit?.id || null],
            unit_name: [i.unit?.name || '-', Validators.required],
            notes: [i.notes || '']
          }));
        });

        this.loading = false;
        this.cdr.detectChanges();
        console.log('FormArray items cargado:', this.items.value);
      },
      error: (err) => {
        console.error('Error al cargar requisición:', err);
        Swal.fire('Error', 'No se pudo cargar la requisición.', 'error');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
}
*/








