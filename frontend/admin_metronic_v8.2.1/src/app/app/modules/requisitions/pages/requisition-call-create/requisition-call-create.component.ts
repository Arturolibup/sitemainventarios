import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { debounceTime, switchMap, catchError, finalize, distinctUntilChanged } from 'rxjs/operators';
import { of } from 'rxjs';
import Swal from 'sweetalert2';
import { RequisitionCallService } from '../../services/requisition-call.service';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from 'src/app/modules/auth';

/** 🔹 Modelo del buscador (como ProductExitController@searchProducts) */
interface SearchProduct {
  product_id: number;
  title: string;
  sku: string;
  stock: number;
  stock_global: number;
  invoice_number: string | null;
  entry_id: number | null;
  unit: string;
  /** Nuevo: para poder enviar default_unit_id al backend si lo tenemos */
  unit_id?: number | null;
}



@Component({
  selector: 'app-requisition-call-create',
  templateUrl: './requisition-call-create.component.html',
  styleUrls: ['./requisition-call-create.component.scss']
})
export class RequisitionCallsCreateComponent implements OnInit {
  form!: FormGroup;
  searchControl = new FormControl('');
  loading = false;
  searching = false;

  results: SearchProduct[] = [];
  selectedProducts: (SearchProduct & { quantity?: number })[] = [];

  dateDiffDays: number | null = null;

  user: any;
  isloading: any;
  roles: string[] = [];

  readonly months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  constructor(
    private fb: FormBuilder,
    private callService: RequisitionCallService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    public authService: AuthService
  ) {}


  ngOnInit(): void {
    this.user = this.authService.user;
    this.roles = this.authService.roles;
    this.initForm();
    this.setupSearch();
    this.handleTitleUppercase();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadCallData(+id);
    }
  }

  hasAnyRole(allowedRoles: string[]): boolean {
    return this.authService.hasRole(allowedRoles);
  }

  /** 🔙 Volver a la lista */
  goBack(): void {
    this.router.navigate(['/requisitions/calls']);
  }

  /** 🧩 Form principal */
  private initForm(): void {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(5)]],
      year: [new Date().getFullYear(), Validators.required],
      month: [new Date().getMonth() + 1, Validators.required],
      open_at: ['', Validators.required],
      close_at: ['', Validators.required],
      is_active: [true]
    });
  }

  /** 🔠 Título a mayúsculas en tiempo real */
  private handleTitleUppercase(): void {
    this.form.get('title')?.valueChanges.subscribe(val => {
      if (val && val !== val.toUpperCase()) {
        this.form.get('title')?.setValue(val.toUpperCase(), { emitEvent: false });
      }
    });
  }

  

  /** 🔄 Cargar convocatoria (modo edición) */
  private loadCallData(id: number): void {
    this.loading = true;
    this.callService.getById(id).subscribe({
      next: (response) => {
        const call = response?.data || response;

        // Encabezado
        this.form.patchValue({
          title: call.title,
          year: call.year,
          month: call.month,
          open_at: call.open_at ? String(call.open_at).split('T')[0] : '',
          close_at: call.close_at ? String(call.close_at).split('T')[0] : '',
          is_active: call.is_active
        });

        // Calcular días (si ya vienen fechas)
        this.validateDateWindow();

        // Productos existentes de la convocatoria
        const products = Array.isArray(call.products) ? call.products : [];

        // Mapeo consistente a SearchProduct incluyendo unit_id (desde default_unit_id)
        this.selectedProducts = products.map((p: any) => ({
          product_id: p.product_id,
          title: p.product?.title ?? p.title ?? 'SIN NOMBRE',
          sku: p.product?.sku ?? p.sku ?? '—',
          stock: p.stock ?? 0,
          stock_global: p.stock_global ?? 0,
          unit: p.unit?.name ?? p.unit_name ?? '—',
          unit_id: p.default_unit_id ?? null,     // 👈 importante para TS y payload
          entry_id: p.entry_id ?? null,
          invoice_number: p.invoice_number ?? null,
          quantity: p.quantity ?? 1
        }));

        this.cdr.detectChanges();
        this.loading = false;
      },
      error: (err) => {
        console.error('❌ Error cargando convocatoria:', err);
        Swal.fire('Error', 'No se pudo cargar la convocatoria.', 'error');
        this.loading = false;
      }
    });
  }

  

// === EN setupSearch() === REEMPLAZA TODO ===
private setupSearch(): void {
  console.log(' Buscador iniciado'); // LOG

  this.searchControl.valueChanges
    .pipe(
      debounceTime(300),
      distinctUntilChanged()
    )
    .subscribe(term => {
      const cleanTerm = (term || '').toString().trim().toUpperCase();
      console.log(' Buscando:', cleanTerm); // LOG

      if (cleanTerm.length < 2) {
        this.results = [];
        console.log(' Menos de 2 letras → resultados vacíos'); // LOG
        return of([]);
      }

      this.searching = true;
      this.cdr.detectChanges();

      this.callService.searchProducts(cleanTerm).subscribe({
        next: (res: any) => {
          const list = Array.isArray(res) ? res : res?.products || [];
          this.results = list.map((p: any) => ({
            product_id: p.product_id ?? p.id,
            title: p.title ?? p.product?.title ?? 'SIN NOMBRE',
            sku: p.sku ?? p.product?.sku ?? '—',
            stock: p.stock ?? 0,
            stock_global: p.stock_global ?? 0,
            unit: p.unit ?? p.unit_name ?? p.product?.unit_name ?? '—',
            unit_id: p.unit_id ?? p.product?.unit_id ?? null,
            invoice_number: p.invoice_number ?? null,
            entry_id: p.entry_id ?? null,
            quantity: 1
          }));
          console.log(' Resultados:', this.results.length); // LOG
          this.searching = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error(' Error búsqueda:', err); // LOG
          this.results = [];
          this.searching = false;
          this.cdr.detectChanges();
        }
      });
    });
}

  /** 📆 Nombre del mes */
  getMonthName(num: number): string {
    return this.months[num - 1] || '';
  }

  addProduct(p: any, event?: Event): void {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (!p) return;

  const exists = this.selectedProducts.some(sp => sp.product_id === p.product_id);
  if (exists) {
    Swal.fire('Atención', `"${p.title}" ya fue agregado.`, 'info');
    return;
  }

  console.log(' Añadido con 1 click:', p.title, p.sku); // LOG

  this.selectedProducts.push({ ...p, quantity: 1 });

  this.results = [];
  this.searchControl.setValue('');
  this.cdr.detectChanges();

  setTimeout(() => {
    const input = document.querySelector('input[formControlName="searchControl"]') as HTMLInputElement;
    if (input) input.focus();
  }, 100);
}




  /** 🧾 Uppercase helper */
  toUpperCase(field: string): void {
    const value = this.form.get(field)?.value?.toUpperCase() || '';
    this.form.get(field)?.setValue(value, { emitEvent: false });
  }

  /** ❌ Eliminar producto por índice (tabla + BD) */
  removeProduct(index: number): void {
    const removed = this.selectedProducts[index];
    Swal.fire({
      title: '¿Eliminar producto?',
      text: `Se quitará "${removed.title}" de la convocatoria actual.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(res => {
      if (!res.isConfirmed) return;

      // 1) UI
      this.selectedProducts.splice(index, 1);
      this.cdr.detectChanges();

      // 2) Si estamos editando, sincronizar con backend
      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        const payload = {
          products: this.selectedProducts.map((p, i) => ({
            product_id: p.product_id,
            default_unit_id: p.unit_id ?? null, // 👈 importante
            unit: p.unit ?? null,
            is_enabled: true,
            sort_order: i
          }))
        };

        this.loading = true;
        this.callService.syncProducts(+id, payload).subscribe({
          next: () => {
            Swal.fire('Eliminado', `"${removed.title}" fue eliminado correctamente.`, 'success');
          },
          error: (err) => {
            console.error('❌ Error al sincronizar productos:', err);
            Swal.fire('Error', 'No se pudo eliminar el producto en la base de datos.', 'error');
          },
          complete: () => { this.loading = false; }
        });
      } else {
        Swal.fire('Eliminado', `"${removed.title}" fue eliminado del listado.`, 'success');
      }
    });
  }

  /** 💾 Guardar (crear o actualizar) */
  save(): void {
    if (this.form.invalid) {
      Swal.fire('Atención', 'Completa todos los campos requeridos.', 'warning');
      return;
    }
    if (this.selectedProducts.length === 0) {
      Swal.fire('Aviso', 'Agrega al menos un producto.', 'info');
      return;
    }
    if (!this.validateDateWindow()) return;

    const id = this.route.snapshot.paramMap.get('id');
    const open_at = new Date(this.form.get('open_at')?.value);
    const close_at = new Date(this.form.get('close_at')?.value);

    if (id) {
      // EDITAR: actualiza encabezado y sincroniza productos
      const headerPayload = {
        title: this.form.value.title,
        open_at: open_at.toISOString().split('T')[0],
        close_at: close_at.toISOString().split('T')[0],
        is_active: this.form.value.is_active
      };

      const productsPayload = {
        products: this.selectedProducts.map((p, i) => ({
          product_id: p.product_id,
          default_unit_id: p.unit_id ?? null, // 👈 importante
          unit: p.unit ?? null,
          is_enabled: true,
          sort_order: i
        }))
      };

      Swal.fire({
        title: '¿Guardar cambios?',
        text: `Se actualizarán los datos y los productos de la convocatoria.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'Cancelar'
      }).then(result => {
        if (!result.isConfirmed) return;

        this.loading = true;

        // 1) Actualiza encabezado
        this.callService.update(+id, headerPayload).subscribe({
          next: () => {
            // 2) Sincroniza productos
            this.callService.syncProducts(+id, productsPayload).subscribe({
              next: () => {
                Swal.fire('Éxito', 'Convocatoria y productos actualizados.', 'success');
              },
              
              error: () => {
                Swal.fire('Error', 'Se actualizó la convocatoria, pero falló la sincronización de productos.', 'error');
              },
              complete: () => (this.loading = false)
            });
            this.cdr.detectChanges();
            this.router.navigate(['/requisitions/calls']);
          },
          error: () => {
            this.loading = false;
            Swal.fire('Error', 'No se pudo actualizar la convocatoria.', 'error');
          }
        });
      });

    } else {
      // CREAR
      const payload = {
        ...this.form.value,
        open_at: open_at.toISOString().split('T')[0],
        close_at: close_at.toISOString().split('T')[0],
        products: this.selectedProducts.map((p, index) => ({
          product_id: p.product_id,
          entry_id: p.entry_id,
          sku: p.sku,
          title: p.title,
          stock: p.stock,
          stock_global: p.stock_global,
          default_unit_id: p.unit_id ?? null, // 👈 importante
          unit: p.unit ?? null,
          invoice_number: p.invoice_number,
          sort_order: index,
          quantity: p.quantity ?? 1
        }))
      };

      Swal.fire({
        title: '¿Crear convocatoria?',
        text: `Se creará la convocatoria "${payload.title}" con ${this.selectedProducts.length} productos.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, crear',
        cancelButtonText: 'Cancelar'
      }).then(result => {
        if (!result.isConfirmed) return;

        this.loading = true;
        this.callService.create(payload).subscribe({
          next: () => {
            Swal.fire('Éxito', 'Convocatoria creada correctamente.', 'success');
            this.resetForm();
            this.goBack();
          },
          error: () => {
            Swal.fire('Error', 'No se pudo crear la convocatoria.', 'error');
          },
          complete: () => (this.loading = false)
        });
      });
    }
  }

  /** 🧠 Validar fechas + contador visual */
  validateDateWindow(): boolean {
    const open = new Date(this.form.get('open_at')?.value);
    const close = new Date(this.form.get('close_at')?.value);

    if (isNaN(open.getTime()) || isNaN(close.getTime())) {
      this.dateDiffDays = null;
      return false;
    }

    const diffDays = Math.floor((close.getTime() - open.getTime()) / (1000 * 60 * 60 * 24));
    this.dateDiffDays = diffDays;

    if (diffDays < 0) {
      Swal.fire('Atención', 'La fecha de cierre debe ser posterior a la de apertura.', 'warning');
      return false;
    }
    if (diffDays > 10) {
      Swal.fire('Advertencia', 'La fecha de cierre no puede superar los 10 días.', 'warning');
      return false;
    }
    return true;
  }

  /** ♻️ Reset visual */
  private resetForm(): void {
    this.form.reset({
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      is_active: true
    });
    this.selectedProducts = [];
    this.results = [];
    this.searchControl.setValue('');
  }
}





  /** 🔍 Buscador reactivo optimizado 
private setupSearch(): void 
{
  console.log ('Buscador iniciado:');

  this.searchControl.valueChanges
    .pipe(
      debounceTime(300),
      
      switchMap(term => {
        const cleanTerm = term?.toString().trim().toUpperCase() || '';
        if (cleanTerm.length < 2) {
          this.results = [];
          return of([]);
        }

        this.searching = true;
        this.searchControl.setValue(cleanTerm, { emitEvent: false });

        return this.callService.searchProducts(cleanTerm).pipe(
          catchError(() => {
            Swal.fire('Error', 'No se pudo buscar productos.', 'error');
            return of([]);
          }),
          finalize(() => {
            this.searching = false;
          })
        );
      })
    )
    .subscribe({
      next: (res: any) => {
        // Normaliza resultados
        const list = Array.isArray(res) ? res : res?.products || [];
        this.results = list.map((p: any) => ({
          product_id: p.product_id ?? p.id,
          title: p.title ?? p.product?.title ?? 'SIN NOMBRE',
          sku: p.sku ?? p.product?.sku ?? '—',
          stock: p.stock ?? 0,
          stock_global: p.stock_global ?? 0,
          unit: p.unit ?? p.unit_name ?? p.product?.unit_name ?? '—',
          unit_id: p.unit_id ?? p.product?.unit_id ?? null,
          invoice_number: p.invoice_number ?? null,
          entry_id: p.entry_id ?? null,
          quantity: 1
        }));
      }
    });
}
*/
  /** ➕ Agregar producto y limpiar resultados 
addProduct(p: any): void {
  if (!p) return;

  const exists = this.selectedProducts.some(sp => sp.product_id === p.product_id);
  if (exists) {
    Swal.fire('Atención', `"${p.title}" ya fue agregado.`, 'info');
    return;
  }

  // Agregar producto
  this.selectedProducts.push({ ...p, quantity: 1 });

  // 🔹 Limpiar y reenfocar
  this.results = [];
  this.searchControl.setValue('');
  this.cdr.detectChanges();

  // 🔹 Enfocar input después de un breve delay
  setTimeout(() => {
    const input = document.querySelector('input[formcontrolname="searchControl"]') as HTMLInputElement;
    if (input) input.focus();
  }, 200);
}
*/