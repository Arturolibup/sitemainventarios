import { Component, Input, Output, EventEmitter } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import Swal from 'sweetalert2';
import { CarsService } from '../service/cars.service';

@Component({
  selector: 'app-delete-car',
  templateUrl: './delete-car.component.html',
  styleUrls: ['./delete-car.component.scss']
})
export class DeleteCarComponent {
  @Input() vehicle: any;
  @Output() vehicleD: EventEmitter<number> = new EventEmitter();
  isLoading: boolean = false;

  constructor(
    public modal: NgbActiveModal,
    private carsService: CarsService
  ) {}

  confirmDelete() {
    this.isLoading = true;
    this.carsService.deleteVehicle(this.vehicle.id).subscribe({
      next: (resp: any) => {
        this.isLoading = false;
        Swal.fire({
          icon: 'success',
          title: 'Éxito',
          text: resp.message || 'Vehículo eliminado con éxito',
          confirmButtonText: 'Aceptar',
          customClass: { confirmButton: 'btn btn-success' }
        });
        this.vehicleD.emit(this.vehicle.id);
        this.modal.close();
      },
      error: (err: any) => {
        this.isLoading = false;
        let message = 'Error al eliminar el vehículo';
        if (err.status === 422 && err.error.errors) {
          message = Object.values(err.error.errors).reduce((acc: string[], val: any) => acc.concat(val), []).join('\n');
        } else if (err.error && err.error.message) {
          message = err.error.message;
        } else {
          message = 'Error desconocido al eliminar el vehículo';
        }
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: message,
          confirmButtonText: 'Aceptar',
          customClass: { confirmButton: 'btn btn-danger' }
        });
      }
    });
  }
}