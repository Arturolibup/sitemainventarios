import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { RequisitionCallService } from '../../services/requisition-call.service';
import { NotificationService } from 'src/app/services/notification.service';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';
import { RequisitionService } from '../../services/requisition.service';
import { AuthService } from 'src/app/modules/auth/services/auth.service';

@Component({
  selector: 'app-requisition-call-list',
  templateUrl: './requisition-call-list.component.html',
  styleUrls: ['./requisition-call-list.component.scss']
})
export class RequisitionCallListComponent implements OnInit, OnDestroy {
  
  user: any = null;
  calls: any[] = [];
  filteredCalls: any[] = [];
  requisitions: any[] = [];
  loading = false;
  selectedCall: any = null;

  showForm = false;
  formData = {
    title: '',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    open_at: '',
    close_at: '',
    is_active: true,
    notes: ''
  };

  canManage = false;
  //isAdmin = false;

  constructor(
    private requisitionCallService: RequisitionCallService,
    private notificationService: NotificationService,
    private requisitionsService: RequisitionService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.user = this.authService.currentUserValue;
    const roles = this.user?.roles || [];
    this.canManage = roles.includes('Super-Admin') || roles.includes('Almacen');
  
    //this.loadMyRequisitions();
    this.loadCalls(); // Áreas solo ven lista
  
    this.setupNotifications();
  }

  /** 🔹 Cargar convocatorias */
  loadCalls(): void {
    this.loading = true;
    this.requisitionCallService.getAll().subscribe({
      next: (data) => {
        const paginated = data?.data || data;
        this.calls = Array.isArray(paginated) ? paginated : (paginated?.data || []);
        // AÑADIR INDICADOR DE BASE CREADA
        this.calls.forEach(call => {
          call.base_created = !!call.general_requisition_id;
        });
        this.filteredCalls = [...this.calls];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        Swal.fire('Error', 'No se pudieron cargar las convocatorias.', 'error');
      },
    });
  }

  manageProducts(call: any): void {
    this.router.navigate(['/requisitions/calls/create', call.id]);
  }

  edit(call: any): void {
    this.router.navigate(['/requisitions/calls/create', call.id]);
  }

  /** 🔹 Filtrar */
  onSearchInput(event: Event): void {
    const term = (event.target as HTMLInputElement)?.value.toLowerCase() ?? '';
    this.filteredCalls = this.calls.filter(c =>
      c.title?.toLowerCase().includes(term) ||
      c.year?.toString().includes(term) ||
      c.month?.toString().includes(term)
    );
  }

  /** 🔹 Mostrar/ocultar formulario */
  toggleForm(): void {
    this.router.navigate(['/requisitions/calls/create']);
  }

  /** 🔹 Guardar o actualizar convocatoria */
  saveOrUpdate(): void {
    if (!this.formData.title || !this.formData.open_at || !this.formData.close_at) {
      Swal.fire('Aviso', 'Completa todos los campos obligatorios.', 'info');
      return;
    }

    const isEdit = !!this.selectedCall;
    const action = isEdit ? 'actualizar' : 'crear';
    const confirmText = isEdit ? 'Sí, actualizar' : 'Sí, crear';

    Swal.fire({
      title: `¿${isEdit ? 'Actualizar' : 'Crear'} convocatoria?`,
      text: isEdit
        ? 'Se modificarán los datos de la convocatoria.'
        : 'Se abrirá una nueva convocatoria de requisiciones.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: 'Cancelar',
    }).then((res) => {
      if (!res.isConfirmed) return;

      this.loading = true;
      const observable = isEdit
        ? this.requisitionCallService.update(this.selectedCall.id, this.formData)
        : this.requisitionCallService.create(this.formData);

      observable.subscribe({
        next: (resp) => {
          Swal.fire('Éxito', resp.message, 'success');
          this.loadCalls();
          this.toggleForm();
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          Swal.fire('Error', `No se pudo ${action} la convocatoria.`, 'error');
        }
      });
    });
  }


  /** 🔹 Activar o cerrar convocatoria */
  toggleActive(call: any): void {
    const newStatus = !call.is_active;
    Swal.fire({
      title: `${newStatus ? '¿Activar' : '¿Cerrar'} convocatoria?`,
      text: newStatus
        ? 'Las áreas podrán verla y generar sus requisiciones.'
        : 'La convocatoria se cerrará y ya no se podrán generar requisiciones.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar',
    }).then((res) => {
      if (!res.isConfirmed) return;

      this.loading = true;
      this.requisitionCallService
        .update(call.id, { is_active: newStatus })
        .subscribe({
          next: (resp) => {
            Swal.fire('Éxito', resp.message, 'success');
            this.loadCalls();
            this.loading = false;
          },
          error: () => {
            this.loading = false;
            Swal.fire('Error', 'No se pudo actualizar el estado.', 'error');
          },
        });
    });
  }

 
 

createGeneralRequisition(call: any): void 
{
  if (this.loading) return;

  const user = this.authService.currentUserValue;
  if (!user) {
    Swal.fire('Error', 'Usuario no autenticado.', 'error');
    return;
  }

  Swal.fire({
    title: `¿Generar requisición base para "${call.title}"?`,
    text: 'Se creará una requisición base con todos los productos.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, generar',
  }).then(result => {
    if (!result.isConfirmed) return;

    const payload = {
      requisition_call_id: call.id,
      area_id: user.area_id ?? undefined,
      subarea_id: user.subarea_id ?? undefined
    };

    this.loading = true;
    this.cdr.detectChanges();

    this.requisitionsService.generateFromCall(payload).subscribe({
      next: (res) => {
        this.loading = false;
        const id = res?.data?.id;
        if (!id) {
          Swal.fire('Error', 'No se recibió ID.', 'error');
          return;
        }

        Swal.fire('Éxito', `Base creada (#${id})`, 'success');

        /*
        const newBase = { id,
          requisition_call_id: call.id,
          type: 'general' };
        
        // AÑADIR BASE MANUALMENTE
        //this.requisitions = [...this.requisitions, newBase];
        */
        // RECARGAR LLAMADAS
        this.loadCalls();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.message || 'Error';
        if (msg.includes('Ya existe')) {
          Swal.fire('Atención', 'Ya existe una base.', 'warning');
          this.loadCalls();
        } else {
          Swal.fire('Error', msg, 'error');
        }
      }
    });
  });
}

getStatusLabel(status: string): string {
  const labels: { [key: string]: string } = {
    draft: 'Borrador',
    sent: 'Enviada a Áreas',
    approved: 'Aprobada',
  };
  return labels[status] || 'Desconocido';
}

  /** 🔹 Ver requisición base existente */
  viewGeneralRequisition(call: any): void {
  if (!call.general_requisition_id) {
    Swal.fire('Aviso', 'Esta convocatoria aún no tiene requisición base.', 'info');
    return;
  }

  this.router.navigate(['/requisitions/requisitions/detail', call.general_requisition_id]);
}

  /** 🔹 Notificaciones */
  setupNotifications(): void {
    this.notificationService.joinRoom('requisition-calls');
    this.notificationService.listenForNotifications((notif) => {
      if (notif?.type === 'requisition-call' && notif?.action === 'created') {
        Swal.fire({
          toast: true,
          icon: 'info',
          title: `Nueva convocatoria creada: ${notif.title}`,
          position: 'top-end',
          showConfirmButton: false,
          timer: 4000,
        });
        this.loadCalls();
      }
    });
  }

  deleteCall(call: any): void {
  Swal.fire({
    title: `¿Eliminar convocatoria "${call.title}"?`,
    text: 'Esta acción no se puede deshacer.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  }).then(result => {
    if (!result.isConfirmed) return;

    this.loading = true;
    this.requisitionCallService.delete(call.id).subscribe({
      next: (res) => {
        this.loading = false;
        Swal.fire('Eliminada', res.message, 'success');
        //this.loadMyRequisitions(); // recargar la tabla
      },
      error: (err) => {
        this.loading = false;
        Swal.fire('Error', err?.error?.message || 'No se pudo eliminar la convocatoria.', 'error');
      }
    });
  });
}

/** CARGAR REQUISICIONES DEL USUARIO (para saber si ya hay base) 
private loadMyRequisitions(): void {
  if (!this.canManage) return;

  this.requisitionsService.getAll({ per_page: 100 }).subscribe({
    next: (res: any) => {
      this.requisitions = Array.isArray(res.data) ? res.data : (res || []);
      console.log('TODAS LAS BASES:',this.requisitions);
      this.loadCalls();
    },
    error: (err) => {
      console.error('Error al cargar requisiciones',err);
      this.requisitions = [];
      this.loadCalls();
    }
  });
}

 /** 🔹 Crear requisición base general 
createGeneralRequisition(call: any): void {
  if (this.loading) return;

  const user = this.authService.currentUserValue; // Usar authService en lugar de this.user
  if (!user) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Usuario no autenticado. Por favor, inicia sesión nuevamente.',
      confirmButtonText: 'Aceptar'
    });
    return;
  }

  Swal.fire({
    title: `¿Generar requisición base para "${call.title}"?`,
    text: 'Se creará una requisición base con todos los productos de esta convocatoria.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, generar',
    cancelButtonText: 'Cancelar',
  }).then(result => {
    if (!result.isConfirmed) return;

    const payload = {
      requisition_call_id: call.id,
      area_id: user.area_id ?? undefined,
      subarea_id: user.subarea_id ?? undefined
    };

    this.loading = true;
    this.cdr.detectChanges(); // Forzar actualización de UI

    this.requisitionsService.generateFromCall(payload).subscribe({
      next: (res) => {
        this.loading = false;
        const requisitionId = res?.data?.id;
        if (!requisitionId) {
          console.error('Respuesta inválida:', res);
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se recibió el ID de la requisición.',
            confirmButtonText: 'Aceptar'
          });
          this.router.navigate(['requisitions/calls']);
          this.loadCalls();
          return;
        }

        Swal.fire('Éxito', `Base creada (#${requisitionId})`, 'success');
        // AÑADIR MANUALMENTE LA BASE A this.requisitions
        this.requisitions.push({
          id: requisitionId,
          requisition_call_id: call.id,
          type: 'general'
        });

        // RECARGAR LLAMADAS PARA ACTUALIZAR base_created
        this.loadCalls();
          
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.message || 'No se pudo crear la requisición base.';
        this.router.navigate(['requisitions/calls']);
        this.loadMyRequisitions();

        if (msg.includes('Ya existe') || msg.includes('Ya tienes una requisición')) {
          Swal.fire({
            icon: 'warning',
            title: 'Atención',
            text: 'Ya existe una requisición base para esta convocatoria.',
            confirmButtonText: 'Aceptar'
          });
        } else if (msg.includes('no está activa') || msg.includes('fuera de fecha')) {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'La convocatoria no está activa o está fuera de fecha.',
            confirmButtonText: 'Aceptar'
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: msg,
            confirmButtonText: 'Aceptar'
          });
        }
      }
    });
  });
}
*/

/** VERIFICAR SI YA EXISTE BASE GENERAL 
private hasBaseForCall(callId: number): boolean {
  const hasBase = this.requisitions.some(r => {
    const match = r.requisition_call_id === callId && 
                  (r.type === 'general' || r.title?.includes('BASE'));
    console.log('CHECK:', r.id, r.requisition_call_id, r.type, r.title, match);
    return match;
  });
  console.log('BASE PARA CALL', callId, ':', hasBase);
  return hasBase;
}


private hasBaseForCall(callId: number): boolean {
  const hasBase = this.requisitions.some(r => 
    r.requisition_call_id === callId && r.type === 'general'
  );
  console.log('BASE PARA CALL', callId, ':', hasBase, this.requisitions);
  return hasBase;
}
*/

  ngOnDestroy(): void {
    this.notificationService.leaveRoom('requisition-calls');
  }
}
