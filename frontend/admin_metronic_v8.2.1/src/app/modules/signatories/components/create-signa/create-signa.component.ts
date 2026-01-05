import { Component } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { ServiceSignaService } from '../../service/service-signa.service';

@Component({
  selector: 'app-create-signa',
  templateUrl: './create-signa.component.html',
  styleUrls: ['./create-signa.component.scss']
})
export class CreateSignaComponent {

  isLoading = false;

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

  // BONUS: Método útil para convertir en mayúsculas mientras el usuario escribe (opcional pero recomendado)
  toUpperCase(field: string) {
    if (field === 'departament') this.departament = this.departament.toUpperCase();
    if (field === 'position')    this.position = this.position.toUpperCase();
    if (field === 'name')        this.name = this.name.toUpperCase();
    if (field === 'title')       this.title = this.title.toUpperCase();
  }

  save() {
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

    this.service.createSignatory(data).subscribe({
      next: (resp: any) => {
        this.toast.success('Éxito', 'Firmante creado correctamente');
        this.modal.close(resp);   // devuelve el nuevo firmante al padre
      },
      error: (err) => {
        this.toast.error('Error', err.error?.message || 'No se pudo crear');
        this.isLoading = false;
      }
    });
  }

}

 