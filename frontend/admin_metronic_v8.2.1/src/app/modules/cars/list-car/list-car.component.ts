import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import Swal from 'sweetalert2';

import { CreateCarComponent } from '../create-car/create-car.component';
import { EditCarComponent } from '../edit-car/edit-car.component';
import { DeleteCarComponent } from '../delete-car/delete-car.component';
import { Subject, Subscription, Observable, from } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { CarsService } from '../service/cars.service';


@Component({
  selector: 'app-list-car',
  templateUrl: './list-car.component.html',
  styleUrls: ['./list-car.component.scss']
})
export class ListCarComponent implements OnInit, OnDestroy {
  vehicles: any[] = [];
  isLoading$: Observable<boolean>;
  isLoading: false;
  totalPages: number = 0;
  currentPage: number = 1;
  perPage: number = 25;
  search: string = '';
  private searchSubject = new Subject<string>();
  private subscriptions: Subscription = new Subscription();

  constructor(
    private modalService: NgbModal,
    private carsService: CarsService,
    private cdr: ChangeDetectorRef
  ) {
    this.isLoading$ = this.carsService.isLoading$;
    
  }

  ngOnInit(): void {
    this.isLoading$ = this.carsService.isLoading$;
    this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.search = searchTerm;
      this.listVehicles(1);
    });

    this.listVehicles();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  listVehicles(page: number = 1) {
    const searchTerm = this.search || '';

    this.carsService.listVehicles(page, searchTerm, this.perPage).subscribe({
      next: (resp: any) => {
        this.vehicles = resp.vehicles || [];
        this.totalPages = Math.ceil(resp.total / this.perPage);
        this.currentPage = page;
        this.cdr.detectChanges();
        if (this.vehicles.length === 0 && searchTerm) {
          
          Swal.fire({
            icon: 'info',
            title: 'Sin resultados',
            text: 'No se encontraron vehículos con el criterio de búsqueda.',
            confirmButtonText: 'Aceptar',
            customClass: { confirmButton: 'btn btn-primary' }
          });
        }
      },
      error: (err: any) => {
        let message = 'Error al cargar los vehículos';
        if (err.status === 422 && err.error.errors) {
          message = Object.values(err.error.errors).reduce((acc: string[], val: any) => acc.concat(val), []).join('\n');
        } else if (err.error && err.error.message) {
          message = err.error.message;
        } else {
          message = 'Error desconocido en la petición.';
        }
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: message,
          confirmButtonText: 'Aceptar',
          customClass: { confirmButton: 'btn btn-danger' }
        });
        this.cdr.detectChanges();
      }
    });
  }

  searchVehicles() {
    this.searchSubject.next(this.search);
  }

  onSearchChange(searchTerm: string) {
    this.searchSubject.next(searchTerm);
  }

  loadPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.listVehicles(page);
    }
  }

  createVehicle() {
    this.cdr.detectChanges();

    const modalRef = this.modalService.open(CreateCarComponent, { centered: true, size: 'lg' });
    const sub = modalRef.componentInstance.vehicleC.subscribe({
      next: (vehicle: any) => {
        setTimeout(() =>{;
      this.listVehicles(this.currentPage);
        });
      Swal.fire({
        icon: 'success',
        title: 'Éxito',
        text: 'Vehículo creado correctamente',
        confirmButtonText: 'Aceptar',
        customClass: { confirmButton: 'btn btn-success' }
      });
      modalRef.close();
    },
  });
  }

  editVehicle(vehicleId: any) {
    if (!vehicleId || isNaN(vehicleId)) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'El vehículo es inválido.',
        confirmButtonText: 'Aceptar',
        customClass: { confirmButton: 'btn btn-danger' }
      });
      return;
    }

    const modalRef = this.modalService.open(EditCarComponent, { centered: true, size: 'lg' });
    modalRef.componentInstance.vehicleId = vehicleId;
    modalRef.componentInstance.onSave.subscribe((updatedVehicle: any) => {
      this.listVehicles(this.currentPage);
      Swal.fire({
        icon: 'success',
        title: 'Éxito',
        text: 'Vehículo actualizado correctamente',
        confirmButtonText: 'Aceptar',
        customClass: { confirmButton: 'btn btn-success' }
      });
      this.cdr.detectChanges();
    });
    // Manejar el cierre del modal (dismiss)
    from(modalRef.result).subscribe({
      next: () => {
        console.log('Modal cerrado con éxito');
      },
      error: (err) => {
        console.log('Modal cerrado sin guardar:', err);
      }
    });
  }

  

  deleteVehicle(vehicle: any) {
    Swal.fire({
      icon: 'warning',
      title: '¿Estás seguro?',
      text: `¿Deseas eliminar el vehículo ${vehicle.numero_eco}?`,
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      cancelButtonText: 'Cancelar',
      customClass: {
        confirmButton: 'btn btn-danger',
        cancelButton: 'btn btn-light'
      }
    }).then(result => {
      if (result.isConfirmed) {
        const modalRef = this.modalService.open(DeleteCarComponent, { centered: true, size: 'md' });
        modalRef.componentInstance.vehicle = vehicle;
        modalRef.componentInstance.vehicleD.subscribe((vehicleId: number) => {
          this.listVehicles(this.currentPage);
          Swal.fire({
            icon: 'success',
            title: 'Éxito',
            text: 'Vehículo eliminado correctamente',
            confirmButtonText: 'Aceptar',
            customClass: { confirmButton: 'btn btn-success' }
          });
          this.cdr.detectChanges();
        });
      }
    });
  }

  refreshVehicles() {
    this.search = '';
    this.searchSubject.next('');
  }
}