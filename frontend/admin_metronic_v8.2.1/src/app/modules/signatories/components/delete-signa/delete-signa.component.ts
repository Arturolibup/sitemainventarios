import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { ServiceSignaService } from '../../service/service-signa.service';

@Component({
  selector: 'app-delete-signa',
  templateUrl: './delete-signa.component.html',
  styleUrls: ['./delete-signa.component.scss']
})
export class DeleteSignaComponent implements OnInit {

  @Input() signatory: any; // Recibe el firmante a eliminar

  isLoading = false;
  confirmText: string = '';
  showUsageWarning = false;
  usageDetails: any = null;
  showDeactivateOption = false;

  constructor(
    public modal: NgbActiveModal,
    private service: ServiceSignaService,
    private toast: ToastrService
  ) {}

  ngOnInit(): void {
    // Inicializar texto de confirmación
    this.confirmText = '';
    this.showUsageWarning = false;
  }

  delete() {
    if (!this.isConfirmationValid()) {
      this.toast.warning('Validación', 'Debes escribir "ELIMINAR" para confirmar');
      return;
    }

    this.isLoading = true;

    this.service.deleteSignatory(this.signatory.id).subscribe({
      next: (resp: any) => {
        if (resp.success) {
          if (resp.action === 'deleted') {
            this.toast.success('Éxito', 'Firmante eliminado permanentemente');
            this.modal.close({ action: 'deleted', data: this.signatory });
          } else if (resp.action === 'deactivated') {
            this.toast.success('Éxito', 'Firmante desactivado');
            this.modal.close({ action: 'deactivated', data: resp.data });
          }
        } else {
          this.toast.error('Error', resp.message || 'No se pudo completar la acción');
          this.isLoading = false;
        }
      },
      error: (err: any) => {
        console.error('Error:', err);
        
        // Manejo especial para firmantes en uso
        if (err.isUsageError) {
          this.handleUsageError(err);
          return;
        }
        
        // Manejo de otros errores
        if (err.status === 404) {
          this.toast.error('No encontrado', 'El firmante no existe');
        } else if (err.status === 403) {
          this.toast.error('Prohibido', 'No tienes permisos');
        } else {
          this.toast.error('Error', err.error?.message || 'No se pudo completar');
        }
        
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  // Manejar error de uso
  handleUsageError(err: any) {
    this.showUsageWarning = true;
    this.usageDetails = err.usageDetails;
    this.showDeactivateOption = true;
    this.isLoading = false;
    
    // Mostrar mensaje informativo
    this.toast.warning('Firmante en uso', 
      'No se puede eliminar porque está siendo utilizado. Considere desactivarlo.');
  }

  // Método para desactivar en lugar de eliminar
  deactivateInstead() {
    this.isLoading = true;
    
    this.service.deactivateSignatory(this.signatory.id).subscribe({
      next: (resp: any) => {
        if (resp.success) {
          this.toast.success('Éxito', 'Firmante desactivado correctamente');
          this.modal.close({ action: 'deactivated', data: resp.data });
        } else {
          this.toast.error('Error', resp.message || 'No se pudo desactivar');
          this.isLoading = false;
        }
      },
      error: (err) => {
        console.error('Error al desactivar:', err);
        this.toast.error('Error', 'No se pudo desactivar el firmante');
        this.isLoading = false;
      }
    });
  }

  isConfirmationValid(): boolean {
    return this.confirmText.trim().toUpperCase() === 'ELIMINAR';
  }

  getConfirmationStatus(): string {
    if (!this.confirmText) return 'empty';
    return this.isConfirmationValid() ? 'valid' : 'invalid';
  }


  // Obtener información del firmante para mostrar
  getSignatoryInfo(): string {
    if (!this.signatory) return '';
    return `${this.signatory.name} (${this.signatory.departament})`;
  }
}