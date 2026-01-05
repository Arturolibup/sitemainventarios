import { Component } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { CreateSignaComponent } from '../create-signa/create-signa.component';
import { EditSignaComponent } from '../edit-signa/edit-signa.component';
import { DeleteSignaComponent } from '../delete-signa/delete-signa.component';
import { ServiceSignaService } from '../../service/service-signa.service';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';


@Component({
  selector: 'app-list-signa',
  templateUrl: './list-signa.component.html',
  styleUrls: ['./list-signa.component.scss']
})
export class ListSignaComponent {

  search: string = '';
  SIGNATORIES: any = [];
  isLoading$: any;
  totalPages: number = 0;
  currentPage: number = 1;

   private searchSubject = new Subject<string>();

  constructor(
    public modalService: NgbModal,
    public signatoryService: ServiceSignaService,
    private toast: ToastrService,
    private router: Router
  ) {
    // Configurar búsqueda con debounce (espera 500ms después de escribir)
    this.searchSubject.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.listSignatories(1); // Reiniciar a página 1
    });
  }
  

  ngOnInit(): void {
    this.isLoading$ = this.signatoryService.isLoading$;
    this.listSignatories();
  }

  listSignatories(page = 1) {
    console.log('Cargando datos, página:', page, 'búsqueda:', this.search);
    
    this.signatoryService.listSigna(page, this.search).subscribe({
      next: (resp: any) => {
        console.log('Respuesta recibida:', resp);
        
        if (resp.success) {
          // Asegurar que siempre sea un array
          if (Array.isArray(resp.data)) {
            this.SIGNATORIES = resp.data;
          } else if (resp.data && typeof resp.data === 'object') {
            // Si es objeto con propiedad 'data' (paginación Laravel)
            if (resp.data.data && Array.isArray(resp.data.data)) {
              this.SIGNATORIES = resp.data.data;
              this.totalPages = resp.data.total || 0;
              this.currentPage = resp.data.current_page || page;
            } else {
              // Convertir objeto a array
              this.SIGNATORIES = Object.values(resp.data);
            }
          } else {
            this.SIGNATORIES = [];
          }
          
          // Actualizar paginación si viene en meta
          if (resp.meta) {
            this.totalPages = resp.meta.total || 0;
            this.currentPage = resp.meta.current_page || page;
          }
          
          console.log('Datos cargados:', this.SIGNATORIES.length, 'registros');
        } else {
          this.toast.warning('Advertencia', resp.message || 'No se pudieron obtener los datos');
          this.SIGNATORIES = [];
        }
      },
      error: (err) => {
        console.error('Error al cargar:', err);
        this.toast.error('Error', 'No se pudo cargar la lista de firmantes');
        this.SIGNATORIES = [];
      }
    });
  }

  // Búsqueda automática mientras escribes
  onSearchChange() {
    this.searchSubject.next(this.search);
  }

  // Búsqueda manual con botón
  searchSignatories() {
    this.listSignatories(1); // Siempre empezar en página 1
  }


  loadPage(page: any) {
    this.listSignatories(page);
  }

  // CREAR FIRMANTE
  createSignatory() {
    const modalRef = this.modalService.open(CreateSignaComponent, { 
      centered: true, 
      size: 'md',
      backdrop: 'static' 
    });

    modalRef.result.then((newSignatory) => {
      if (newSignatory) {
        this.SIGNATORIES.unshift(newSignatory);
        this.toast.success('Firmante creado correctamente');
      }
    }).catch(() => {});
  }

   // EDITAR FIRMANTE
  editSignatory(signatory: any) {
    const modalRef = this.modalService.open(EditSignaComponent, { 
      centered: true, 
      size: 'md',
      backdrop: 'static' 
    });
    modalRef.componentInstance.signatory = { ...signatory }; // Pasar copia

    modalRef.result.then((updated) => {
      if (updated) {
        const index = this.SIGNATORIES.findIndex((s: any) => s.id === updated.id);
        if (index !== -1) {
          this.SIGNATORIES[index] = updated;
          this.toast.success('Éxito', 'Firmante actualizado');
        }
      }
    }).catch(() => {});
  }

  // ELIMINAR FIRMANTE
  deleteSignatory(signatory: any) {
    const modalRef = this.modalService.open(DeleteSignaComponent, { 
      centered: true, 
      size: 'sm',
      backdrop: 'static' 
    });
    modalRef.componentInstance.signatory = signatory;

    modalRef.result.then((result) => {
      if (result === 'confirm') {
        this.signatoryService.deleteSignatory(signatory.id).subscribe({
          next: (resp: any) => {
            if (resp.success) {
              const index = this.SIGNATORIES.findIndex((s: any) => s.id === signatory.id);
              if (index !== -1) {
                this.SIGNATORIES.splice(index, 1);
                this.toast.success('Éxito', 'Firmante eliminado');
              }
            } else {
              this.toast.error('Error', resp.message || 'No se pudo eliminar');
            }
          },
          error: (err) => {
            this.toast.error('Error', 'No se pudo eliminar el firmante');
          }
        });
      }
    }).catch(() => {});
  }

  // REFRESCAR LISTA
  refresh() {
    this.search = '';
    this.currentPage = 1;
    this.listSignatories();
    this.toast.info('Refrescando', 'Lista actualizada');
  }

  back() {
    this.router.navigate(['/dashboard']); 
  }
}