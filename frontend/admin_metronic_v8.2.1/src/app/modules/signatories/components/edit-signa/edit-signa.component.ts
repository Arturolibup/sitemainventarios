
import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { ServiceSignaService } from '../../service/service-signa.service';

@Component({
  selector: 'app-edit-signa',
  templateUrl: './edit-signa.component.html',
  styleUrls: ['./edit-signa.component.scss']
})
export class EditSignaComponent implements OnInit {

  @Input() signatory: any; // Recibe el firmante a editar desde el componente padre

  isLoading = false;

  // Variables para el formulario
  departament: string = '';
  position: string = '';
  name: string = '';
  title: string = '';
  is_active: boolean = true;
  order: number = 1;

  constructor(
    public modal: NgbActiveModal,
    private service: ServiceSignaService,
    private toast: ToastrService
  ) {}

  toUpperCase(field: string) {
    if (field === 'departament') this.departament = this.departament.toUpperCase();
    if (field === 'position')    this.position = this.position.toUpperCase();
    if (field === 'name')        this.name = this.name.toUpperCase();
    if (field === 'title')       this.title = this.title.toUpperCase();
  }

  ngOnInit(): void {
    // Cargar datos del firmante recibido
    if (this.signatory) {
      this.departament = this.signatory.departament || '';
      this.position = this.signatory.position || '';
      this.name = this.signatory.name || '';
      this.title = this.signatory.title || '';
      this.is_active = this.signatory.is_active !== undefined ? this.signatory.is_active : true;
      this.order = this.signatory.order || 1;
    }
  }

  update() {
    if (!this.departament.trim() || !this.position.trim() || !this.name.trim()) {
      this.toast.warning('Faltan datos', 'Completa los campos obligatorios');
      return;
    }

    const data = {
      departament: this.departament.trim().toUpperCase(),
      position: this.position.trim().toUpperCase(),
      name: this.name.trim().toUpperCase(),
      title: this.title.trim().toUpperCase() || null,
      is_active: this.is_active,
      order: this.order
    };

    this.isLoading = true;

    this.service.editSignatory(this.signatory.id, data).subscribe({
      next: (resp: any) => {
        if (resp.success) {
          this.toast.success('Éxito', resp.message || 'Firmante actualizado correctamente');
          this.modal.close(resp.data); // Devuelve el firmante actualizado al padre
        } else {
          this.toast.error('Error', resp.message || 'No se pudo actualizar');
          this.isLoading = false;
        }
      },
      error: (err) => {
        console.error('Error al actualizar:', err);
        
        // Manejo específico de errores
        if (err.status === 422) {
          this.toast.error('Error de validación', err.error?.error || 'El departamento ya existe en otro registro');
        } else if (err.status === 404) {
          this.toast.error('No encontrado', 'El firmante no existe o fue eliminado');
        } else {
          this.toast.error('Error', err.error?.message || 'No se pudo actualizar');
        }
        
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  // Método para restablecer valores originales
  resetForm() {
    if (this.signatory) {
      this.departament = this.signatory.departament || '';
      this.position = this.signatory.position || '';
      this.name = this.signatory.name || '';
      this.title = this.signatory.title || '';
      this.is_active = this.signatory.is_active !== undefined ? this.signatory.is_active : true;
      this.order = this.signatory.order || 1;
    }
  }
}