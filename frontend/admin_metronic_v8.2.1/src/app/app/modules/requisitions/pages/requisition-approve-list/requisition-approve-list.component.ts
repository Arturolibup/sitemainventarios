import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { ToastrService } from 'ngx-toastr';

import { RequisitionService } from '../../services/requisition.service';
import { NotificationService } from 'src/app/services/notification.service';
import { AuthService } from 'src/app/modules/auth';

@Component({
  selector: 'app-requisition-approve-list',
  templateUrl: './requisition-approve-list.component.html',
  styleUrls: ['./requisition-approve-list.component.scss']
})
export class RequisitionApproveListComponent implements OnInit, OnDestroy {
  loading = false;
  requisitions: any[] = [];
  total = 0;
  currentPage = 1;
  pageSize = 15;

  // Filtros
  selectedYear: number | null = null;
  selectedMonth: number | null = null;
  term = '';

  private notifHandler?: (data: any) => void;

  constructor(
    private requisitionService: RequisitionService,
    private notificationService: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadRequisitions();
    this.setupNotifications();
  }

  ngOnDestroy(): void {
    this.notificationService.leaveRoom('requisitions');
  }

  // Carga con todos los filtros y paginación
  loadRequisitions(): void {
    this.loading = true;

    const params: any = {
      per_page: this.pageSize,
      page: this.currentPage,
      status: 'sent' // Solo las enviadas
    };

    if (this.selectedYear) params.year = this.selectedYear;
    if (this.selectedMonth) params.month = this.selectedMonth;
    if (this.term.trim()) params.search = this.term.trim();

    this.requisitionService.getAll(params).subscribe({
      next: (res: any) => {
        this.requisitions = res.data || [];
        this.total = res.total || 0;
        this.currentPage = res.current_page || 1;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        Swal.fire('Error', 'No se pudieron cargar las requisiciones.', 'error');
      }
    });
  }

  trackById(index: number, item: any): any {
    return item.id;
  }
  
  // Cambio de página
  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadRequisitions();
  }

  // Búsqueda en tiempo real
  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement)?.value ?? '';
    this.term = value;
    this.currentPage = 1; // Volver a página 1 al buscar
    this.loadRequisitions();
  }

  // Filtros de año/mes
  onYearChange(): void {
    this.currentPage = 1;
    this.loadRequisitions();
  }

  onMonthChange(): void {
    this.currentPage = 1;
    this.loadRequisitions();
  }

  // Limpiar filtros
  clearFilters(): void {
    this.selectedYear = null;
    this.selectedMonth = null;
    this.term = '';
    this.currentPage = 1;
    this.loadRequisitions();
  }

  goApprove(req: any): void {
    if (req?.status !== 'sent') {
      Swal.fire('Aviso', 'Solo se pueden aprobar requisiciones en estatus ENVIADA.', 'info');
      return;
    }
    this.router.navigate(['/requisitions/approve', req.id]);
  }

  // Tus métodos de PDF (sin cambios)
  printDraft(id: number): void {
    this.requisitionService.getPrintDraftPdf(id).subscribe({
      next: (res: any) => {
        if (!res.success || !res.pdf) {
          Swal.fire('Error', res.error || 'No se pudo generar el PDF');
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
        const printWindow = window.open(blobUrl, '_blank');
        if (printWindow) {
          printWindow.onload = () => setTimeout(() => printWindow.print(), 500);
        }
      },
      error: () => Swal.fire('Error', 'No se pudo cargar el PDF', 'error')
    });
  }

  uploadPdf(id: number, existingPdfPath?: string): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;

      const upload = () => {
        const form = new FormData();
        form.append('file', file);
        this.requisitionService.uploadExitPdf(id, form).subscribe({
          next: () => {
            this.toastr.success('Vale firmado subido correctamente');
            this.loadRequisitions();
          },
          error: (err) => this.toastr.error(err.error?.message || 'Error al subir PDF')
        });
      };

      if (existingPdfPath) {
        Swal.fire({
          title: '¿Reemplazar vale firmado?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: 'Sí, reemplazar'
        }).then(result => result.isConfirmed && upload());
      } else {
        upload();
      }
    };
    input.click();
  }

  setupNotifications(): void {
    this.notificationService.joinRoom('requisitions');
    this.notifHandler = (notif: any) => {
      if (notif?.type === 'requisition' && (notif?.action === 'sent' || notif?.action === 'approved')) {
        this.loadRequisitions();
        if (notif.action === 'sent') {
          Swal.fire({
            toast: true,
            icon: 'info',
            title: `Nueva requisición #${notif.requisition_id}`,
            position: 'top-end',
            timer: 3000,
            showConfirmButton: false
          });
        }
      }
    };
    this.notificationService.listenForNotifications(this.notifHandler);
  }

  months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
  ];
}





/*
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { ToastrService } from 'ngx-toastr';

import { RequisitionService } from '../../services/requisition.service';
import { NotificationService } from 'src/app/services/notification.service';
import { AuthService } from 'src/app/modules/auth';

@Component({
  selector: 'app-requisition-approve-list',
  templateUrl: './requisition-approve-list.component.html',
  styleUrls: ['./requisition-approve-list.component.scss']
})
export class RequisitionApproveListComponent implements OnInit, OnDestroy {
  loading = false;
  requisitions: any[] = [];
  filtered: any[] = [];
  total = 0;
  currentPage = 1;
  pageSize = 15;
  // filtros
  selectedYear: number | null = null;
  selectedMonth: number | null = null;
  term = '';

  private notifHandler?: (data: any) => void;

  constructor(
    private requisitionService: RequisitionService,
    private notificationService: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private toastr: ToastrService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    //this.selectedYear = new Date().getFullYear();
    //this.selectedMonth = new Date().getMonth() + 1;
    this.load();
    this.setupNotifications();
    // FORZAR DETECCIÓN DESPUÉS DE CARGAR
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 100);
  }
      

  ngOnDestroy(): void {
    if (this.notifHandler) {
      // No hay unsubscribe porque socket.io usa callbacks; removemos escuchas por seguridad
      this.notificationService.leaveRoom('requisitions');
    }
  }

  onPageChange(page: number): void {
  this.currentPage = page;
  const params: any = { per_page: this.pageSize, page: this.currentPage };
  if (this.selectedYear) params.year = this.selectedYear;
  if (this.selectedMonth) params.month = this.selectedMonth;

  this.requisitionService.getAll(params).subscribe({
    next: (res: any) => {
      this.requisitions = res.data || [];
      this.filtered = [...this.requisitions];
      this.total = res.total || 0;
      this.currentPage = res.current_page || 1;
      this.loading = false;
      this.cdr.detectChanges();
    },
    error: () => {
      this.cdr.detectChanges();
    }
  });
}

  
  load(): void {
  this.loading = true;
  const params: any = { per_page: 15 };
  if (this.selectedYear) params.year = this.selectedYear;
  if (this.selectedMonth) params.month = this.selectedMonth;

  this.requisitionService.getAll(params).subscribe({
    next: (res: any) => {
      console.log('RES API:', res);
      console.log('PAGINADO CORREGIDO',res);

      this.requisitions = res.data || [];
      this.filtered = [...this.requisitions];
      this.total = res.total || 0;
      this.currentPage = res.current_page || 1;

      if (this.term) this.applySearch(this.term);
      this.loading = false;
      this.cdr.detectChanges();
    },
    error: () => {
      Swal.fire('Error', 'No se pudieron cargar las requisiciones a aprobar.', 'error');
    },
    complete: () => (this.loading = false)
  });
}

 

  
  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.term = value;
    this.applySearch(value);
  }

  private applySearch(term: string): void {
    const lower = term.toLowerCase();
    if (!lower) {
      this.filtered = [...this.requisitions];
      return;
    }
    this.filtered = this.requisitions.filter((r: any) =>
      r.id?.toString().includes(lower) ||
      (r.area?.name || '').toLowerCase().includes(lower) ||
      (r.subarea?.name || '').toLowerCase().includes(lower) ||
      (r.status || '').toLowerCase().includes(lower)
    );
  }

  
  clearFilters(): void {
    this.selectedYear = null;
    this.selectedMonth = null;
    this.term = '';
    this.currentPage = 1;
    this.load();
    this.cdr.detectChanges();
  }

  
  goApprove(req: any): void {
    if (req?.status !== 'sent') {
      Swal.fire('Aviso', 'Solo se pueden aprobar requisiciones en estatus ENVIADA.', 'info');
      return;
    }
    this.router.navigate(['/requisitions/approve', req.id]);
  }

  months = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' }
];

 
  setupNotifications(): void {
    this.notificationService.joinRoom('requisitions');
    this.notifHandler = (notif: any) => {
      // Si alguien envía una requisición, refrescamos
      if (notif?.type === 'requisition' && notif?.action === 'sent') {
        Swal.fire({
          toast: true,
          icon: 'info',
          title: `Nueva requisición enviada #${notif.requisition_id}`,
          position: 'top-end',
          showConfirmButton: false,
          timer: 3500
        });
        this.load();
      }
      // Si una requisición fue aprobada, refrescamos también
      if (notif?.type === 'requisition' && notif?.action === 'approved') {
        this.load();
      }
    };
    this.notificationService.listenForNotifications(this.notifHandler);
  }


uploadPdf(id: number, existingPdfPath?: string): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/pdf';

  input.onchange = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    const upload = () => {
      const form = new FormData();
      form.append('file', file);

      this.requisitionService.uploadExitPdf(id, form).subscribe({
        next: () => {
          this.toastr.success('Vale firmado subido correctamente');
          this.load();
        },
        error: (err) => this.toastr.error(err.error?.message || 'Error al subir PDF')
      });
    };

    if (existingPdfPath) {
      Swal.fire({
        title: '¿Reemplazar vale firmado?',
        text: 'Ya existe un PDF. ¿Deseas reemplazarlo?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, reemplazar',
        cancelButtonText: 'Cancelar'
      }).then(result => {
        if (result.isConfirmed) upload();
      });
    } else {
      upload();
    }
  };
  input.click();
}
  
//vers i funciona directo
printDraft(id: number): void {
  this.requisitionService.getPrintDraftPdf(id).subscribe({
    next: (res: any) => {
      if (!res.success || !res || !res.pdf) {
        Swal.fire('Error', res.error || 'No se pudo generar el PDF');
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

      // ABRIR EN VENTANA
      const printWindow = window.open(blobUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 500);
        };
      }
    },
    error: (err) => {
      console.error('Error al obtener el PDF:',err);
      Swal.fire('Error', 'No se pudo cargar el PDF', 'error');
    }
  });
}
}

*/