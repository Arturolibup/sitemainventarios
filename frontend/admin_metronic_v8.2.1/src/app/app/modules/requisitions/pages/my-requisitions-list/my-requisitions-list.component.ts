import { Component, OnInit, OnDestroy, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { RequisitionService } from '../../services/requisition.service';
import { NotificationService } from 'src/app/services/notification.service';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/modules/auth/services/auth.service';

@Component({
  selector: 'app-my-requisitions-list',
  templateUrl: './my-requisitions-list.component.html',
  styleUrls: ['./my-requisitions-list.component.scss']
})
export class MyRequisitionsListComponent implements OnInit, OnDestroy {
@ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  requisitions: any[] = [];
  filteredRequisitions: any[] = [];
  activeCalls: any[] = []; // 🔹 Nuevas convocatorias activas
  filteredActiveCalls: any[] = [];

  selectedYear: number | null = null;
  selectedMonth: number | null = null;
  loading = false;
  user: any; // Usuario logueado
  private destroy$ = new Subject<void>();
  total: any;

  constructor(
    private requisitionService: RequisitionService,
    private notificationService: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private authService: AuthService
  ) {}


  ngOnInit(): void {
    this.user = this.authService.currentUserValue;
    console.log('🧑 Usuario logueado:', this.user); 
    this.loadActiveCalls();
    this.loadRequisitions();
    this.filteredActiveCalls = [...this.activeCalls];
    
}



loadRequisitions(): void {
  this.loading = true;
  const params: any = {};
  if (this.selectedYear) params.year = this.selectedYear;
  if (this.selectedMonth) params.month = this.selectedMonth;

  console.log('Cargando requisiciones con params:', params);
  console.log('ENVIANDO PARAMS AL BACKEND:', params);

  this.requisitionService.getMine(params)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res: any) => {
        const dataArray = Array.isArray(res) ? res : (res?.data || []);
        this.requisitions = dataArray;
        this.filteredRequisitions = [...this.requisitions];
        this.filterByTerm('');
        this.total = res?.total || this.requisitions.length;

        console.log('Requisiciones cargadas:', this.requisitions);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error en getMine:', err);
        this.requisitions = [];
        this.filteredRequisitions = [];
        Swal.fire('Error', 'No se pudieron cargar tus requisiciones.', 'error');
      },
      complete: () => {
        this.loading = false;
        this.cdr.detectChanges(); // ← FORZAR DETECCIÓN
      }
    });
}

  /** 🔹 Cargar convocatorias abiertas */
  loadActiveCalls(): void {
    this.requisitionService.getActiveCalls()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: any[]) => {
          this.activeCalls = (data || [])
          .sort((a, b)=> {
            const dateA = new Date(a.updated_at || a.created_at);
            const dateB = new Date(b.updated_at || b.created_at);
            return dateB.getTime() - dateA.getTime();   
           });
           this.filteredActiveCalls = [...this.activeCalls];
           console.log('Convocatorias activas ordenadas:', this.activeCalls.map (c=> c.id));
           },
        complete: () => this.cdr.detectChanges(),
        error: () => Swal.fire('Error', 'No se pudieron cargar las convocatorias activas.', 'error')
      });
  }

  


/** Participar en convocatoria */
participate(call: any): void {
  if (this.hasParticipated(call)) {
    Swal.fire('Info', 'Ya tienes una requisición para esta convocatoria.', 'info');
    return;
  }

  Swal.fire({
    title: `¿Participar en "${call.title}"?`,
    icon: 'question',
    showCancelButton: true
  }).then(result => {
    if (!result.isConfirmed) return;

    this.requisitionService.participateInCall(call.id).subscribe({
      next: (res) => {
        this.loadRequisitions(); // actualiza botón
        
        this.router.navigate(['/requisitions/create', res.data.id]);
      },
      error: (err) => {
      this.loading = false;
      console.error('❌ Error detectado:', err);

      const backendMsg = err?.error?.message || 'Error desconocido';
      Swal.fire({
        icon: 'error',
        title: 'Error al participar',
        text: backendMsg, // ← Muestra el mensaje real
        confirmButtonText: 'OK'
      });
    }
  });
  });
}

/** Verificar si convocatoria tiene base general */
hasBaseGeneral(call: any): boolean {
  return call.has_base === true || call.general_requisition_id !== null;
}

/** Verificar si el área ya participó en esta convocatoria */
hasParticipated(call: any): boolean {
  const participated = this.requisitions.some(r => 
    r.requisition_call_id === call.id && 
    r.type === 'normal'
  );
  console.log(`Participó en ${call.id}?`, participated, // LOG
  this.requisitions.length);
  return participated;
}
  /** 🔹 Escuchar notificaciones en tiempo real */
  setupNotifications(): void {
    this.notificationService.joinRoom('requisitions');
    this.notificationService.listenForNotifications((notif) => {
      if (notif?.type === 'requisition' && notif?.action === 'approved') {
        Swal.fire({
          icon: 'success',
          title: 'Requisición aprobada',
          text: `Tu requisición #${notif.requisition_id} ha sido aprobada.`,
          timer: 3500,
          toast: true,
          position: 'top-end',
          showConfirmButton: false
        });
        this.loadRequisitions();
      }
    });
  }

  /** 🔹 Filtro de búsqueda UNIFICADO (convocatorias + requisiciones) */
filterByTerm(term: string): void {
  const lower = term.toLowerCase().trim();

  // 1. FILTRAR CONVOCATORIAS
  if (!lower) {
    this.filteredActiveCalls = [...this.activeCalls];
  } else {
    this.filteredActiveCalls = this.activeCalls.filter(c =>
      c.id.toString().includes(lower) ||
      (c.title || '').toLowerCase().includes(lower) ||
      `${c.month}/${c.year}`.includes(lower)
    );
  }

  // 2. FILTRAR REQUISICIONES
  if (!lower) {
    this.filteredRequisitions = [...this.requisitions];
  } else {
    this.filteredRequisitions = this.requisitions.filter(r =>
      r.id.toString().includes(lower) ||
      (r.status || '').toLowerCase().includes(lower) ||
      (r.area?.name || '').toLowerCase().includes(lower) ||
      (r.call?.title || '').toLowerCase().includes(lower)
    );
  }
}

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement)?.value ?? '';
    this.filterByTerm(value);
  }

  

  
  /** 🔹 Editar requisición en borrador */
  editRequisition(req: any): void {
    if (req.status !== 'draft') {
      Swal.fire('Aviso', 'Solo puedes editar requisiciones en borrador.', 'info');
      return;
    }
    this.router.navigate(['/requisitions/create', req.id]);
  }

  /** 🔹 Enviar requisición al almacén */
  sendRequisition(req: any): void {
    if (req.status !== 'draft') {
      Swal.fire('Aviso', 'Solo puedes enviar requisiciones en borrador.', 'info');
      return;
    }

    Swal.fire({
      title: `¿Enviar requisición #${req.id}?`,
      text: 'Una vez enviada no podrás editarla.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, enviar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.loading = true;
        this.requisitionService.sendRequisition(req.id)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (res) => {
              Swal.fire('Enviada', res.message || 'Requisición enviada correctamente.', 'success');
              this.loadRequisitions();
              
              this.loading = false;
            },
            error: () => {
              Swal.fire('Error', 'No se pudo enviar la requisición.', 'error');
              this.loading = false;
            }
          });
      }
    });
  }

  /** Ver detalle + salida si existe */
viewDetail(req: any): void {
  let html = `
    <div class="text-start">
      <b>Área:</b> ${req.area?.name || '-'}<br>
      <b>Subárea:</b> ${req.subarea?.name || '-'}<br>
      <b>Estatus:</b> ${req.status || '-'}<br>
      <b>Solicitada:</b> ${req.requested_at || '-'}<br>
      <b>Aprobada:</b> ${req.approved_at || '-'}
  `;

  if (req.exit_status === 'completed' && req.exit_pdf_url) {
    html += `
    <hr>
      <b>Salida generada:</b> <span class="badge bg-success">${req.exit_folio}</span><br>
      <button onclick="window.open('${req.exit_pdf_url}', '_blank')" 
          class="btn btn-sm btn-primary mt-2">
        Ver PDF de salida
      </button>`;
  }

  html += `</div>`;

  Swal.fire({
    title: `Requisición #${req.id}`,
    html,
    confirmButtonText: 'Cerrar',
    customClass: { popup: 'swal-wide' },
    allowOutsideClick: false
  });
}

/** Abrir PDF de salida */
viewExitPdf(url: string): void {
  if (url) {
    window.open(url, '_blank');
  }
}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.notificationService.leaveRoom('requisitions');
  }

  /** Eliminar requisición (solo borrador sin salida) */
deleteRequisition(req: any): void {
  Swal.fire({
    title: `¿Eliminar requisición #${req.id}?`,
    text: 'Esta acción no se puede deshacer.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  }).then(result => {
    if (!result.isConfirmed) return;

    this.loading = true;
    this.requisitionService.delete(req.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          Swal.fire('Eliminada', 'Requisición borrada correctamente.', 'success');
          this.loadRequisitions();
         
        },
        error: (err) => {
          this.loading = false;
          Swal.fire('Error', err.error?.message || 'No se pudo eliminar.', 'error');
        }
      });
  });
}

clearSearch(): void {
  if (this.searchInput) {
    this.searchInput.nativeElement.value = '';
    this.filterByTerm('');
  }
}

printDraft(id: number): void {
  this.requisitionService.getPrintDraftPdf(id).subscribe({
    next: (res: any) => {
      if (!res.success) {
        Swal.fire('Error', res.error || 'No se pudo generar el PDF', 'error');
        return;
      }

      const byteCharacters = atob(res.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });

      const blobUrl = URL.createObjectURL(blob);

      // ABRIR EN NUEVA PESTAÑA Y DISPARAR IMPRESIÓN
      const printWindow = window.open(blobUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 500);
        };
      }
    },
    error: () => {
      Swal.fire('Error', 'No se pudo cargar el PDF', 'error');
    }
  });
}

}



/*
loadMyRequisitions(): void {
  this.loadRequisitions();
  this.loading = true;
  this.requisitionService.getMyRequisitions().subscribe({
    next: (data: any[]) => {
      console.log('Mis requisiciones cargadas:', data); // ← VERIFICA AQUÍ
      this.requisitions = Array.isArray(data) ? data : [];
      this.filteredRequisitions = [...this.requisitions];
      this.cdr.detectChanges();
      this.loading = false;
    },
    error: (err) => {
      console.error('Error al cargar mis requisiciones:', err);
      this.requisitions = [];
      this.filteredRequisitions = [];
      this.loading = false;
      this.cdr.detectChanges();
      Swal.fire('Error', 'No se pudieron cargar tus requisiciones.', 'error');
    }
  });
}


  
loadRequisitions(): void {
  this.loading = true;
  const params: any = {};
  if (this.selectedYear) params.year = this.selectedYear;
  if (this.selectedMonth) params.month = this.selectedMonth;

  console.log('cargando requisiciones con params:', params);

  this.requisitionService.getMine(params)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res: any) => {
        // res = { success: true, data: [...] }
        const dataArray = res?.data || res || [];
        this.requisitions = Array.isArray(dataArray) ? dataArray : [];
        this.filteredRequisitions = [...this.requisitions];
        this.total = res?.total || this.requisitions.length;
        console.log('Requisiciones cargadas:', this.requisitions);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error en getMine:', err);
        this.requisitions = [];
        this.filteredRequisitions = [];
        Swal.fire('Error', 'No se pudieron cargar tus requisiciones.', 'error');
      },
      complete: () => this.loading = false
    });
}
*/