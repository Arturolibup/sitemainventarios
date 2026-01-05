import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ProductsService } from '../service/product.service';
import { ToastrService } from 'ngx-toastr';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Subject } from 'rxjs';
import Swal from 'sweetalert2';
import { Router, ActivatedRoute } from '@angular/router';


// Interfaz para tipar las entradas
interface ProductEntry {
    id: number;
    invoice_number: string;
    provider?: { id: number; full_name: string };
    entry_date: string;
    process: string;
    order_number: string;
    hasDocuments?: boolean;
    created_by?: number;
    created_by_name?: string;
    entry_status?: string;
    [key: string]: any;
}

// Interfaz para los filtros de entradas
interface EntryFilters {
    process?:string;
    invoice_number?: string;
    order_number?: string;
    date_from?: string;
    date_to?: string;
    provider_name?: string;
    page?: number;
    per_page?: number;
    has_documents?: boolean;
    entry_status?: string;
}


@Component({
    selector: 'app-list-product',
    templateUrl: './list-product.component.html',
    // styleUrls: ['./list-product.component.scss'] // No usamos SCSS como pediste
})

export class ListProductComponent implements OnInit {
    entries: any[] = [];
    currentPage: number = 1;
    totalPages: number = 1;
    isLoading: boolean = false;
    perPage: number = 10;
    style: any;
    has_documents: boolean;

    isLoading$: any;
    // Campos de búsqueda específicos

    // Interfaz para los filtros
    processSearch: string = '';
    invoiceSearch: string = '';
    orderSearch: string = '';
    dateSearch: string = '';
    dateFromSearch: string = ''; // Nuevo campo para "desde"
    dateToSearch: string = '';   // Nuevo campo para "hasta"
    providerSearch: string = '';
    documentStatusFilter: string = 'all';

    // Subjects para debounce de búsqueda
    private processSubject =new Subject<string>();
    private invoiceSubject = new Subject<string>();
    private orderSubject = new Subject<string>();
    private dateSubject = new Subject<string>();
    private providerSubject = new Subject<string>();

    constructor(
        private service: ProductsService,
        private router: Router,
        private route: ActivatedRoute,
        private cdr: ChangeDetectorRef,
        public toast: ToastrService
    ) {}

    ngOnInit() {
      this.loadEntries();
      this.isLoading$ = this.service.isLoading$;
      this.service.isLoading$.subscribe(loading => {
        console.log('isLoading cambiado a:', loading); // Log para ver cambios
        this.isLoading = loading;
    });

    
            // Configurar debounce para cada campo de búsqueda
        this.invoiceSubject.pipe(debounceTime(300), distinctUntilChanged())
            .subscribe(() => this.loadEntries());
        this.orderSubject.pipe(debounceTime(300), distinctUntilChanged())
            .subscribe(() => this.loadEntries());
        this.dateSubject.pipe(debounceTime(300), distinctUntilChanged())
            .subscribe(() => this.loadEntries());
        this.providerSubject.pipe(debounceTime(300), distinctUntilChanged())
            .subscribe(() => this.loadEntries());
        this.processSubject.pipe(debounceTime(300), distinctUntilChanged())
            .subscribe(() => this.loadEntries());
    }

    isLoadingProcess() {
      this.service.isLoadingSubject.next(true);
      setTimeout(() => {
        this.service.isLoadingSubject.next(false);
      }, 5);
    }

    // Cargar entradas con filtros y paginación
    loadEntries(page: number = 1) {
        // Propósito: Carga las entradas con filtros y paginación.
        this.currentPage = page;
        const filters: EntryFilters = {
            process: this.processSearch,
            invoice_number: this.invoiceSearch,
            order_number: this.orderSearch,
            date_from: this.dateFromSearch,
            date_to: this.dateToSearch,
            provider_name: this.providerSearch,
            page: this.currentPage,
            per_page: this.perPage,
            has_documents: this.documentStatusFilter === 'withDocuments' ? true :
                           this.documentStatusFilter === 'withoutDocuments' ? false : undefined,
            // Modificación: Solo incluir entry_status si es válido
            entry_status: undefined 
        };

        console.log('Filtros aplicados:', filters);

        this.service.getEntries(filters).subscribe({
            next: (response: any) => {
                console.log('Entradas recibidas:', response.data);
                // Corrección: Tipamos 'entry' con la interfaz ProductEntry
                this.entries = response.data.map((entry: ProductEntry) => ({
                    ...entry,
                    created_by_name: entry.created_by ? `Usuario ${entry.created_by}` : 'N/A' // Auditoría
                }));
                this.totalPages = Math.ceil(response.total / response.per_page);
                if (this.entries.length === 0 && page === 1) {
                    Swal.fire({
                        icon: 'info',
                        title: 'Sin resultados',
                        text: 'No se encontraron entradas con esos criterios.',
                        timer: 1500,
                        showConfirmButton: false
                    });
                }
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: () => {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error al cargar las entradas.'
                });
                this.isLoading = false;
            }
        });
    }

    
    onPerPageChange() {
      this.currentPage = 1; // Reseteamos a la primera página al cambiar el número de entradas
      this.loadEntries();
  }

    // Métodos para disparar las búsquedas
    onInvoiceSearch(event: Event) {
        this.invoiceSearch = (event.target as HTMLInputElement).value;
        this.invoiceSubject.next(this.invoiceSearch);
    }
    onProcess(event: Event) {
        this.processSearch = (event.target as HTMLInputElement).value;
        this.processSubject.next(this.processSearch);
    }

    onOrderSearch(event: Event) {
        this.orderSearch = (event.target as HTMLInputElement).value;
        this.orderSubject.next(this.orderSearch);
    }

    onDateFromSearch() {
        // Validar que la fecha de inicio no sea mayor que la fecha de término
        if (this.dateFromSearch && this.dateToSearch) {
            const startDate = new Date(this.dateFromSearch);
            const endDate = new Date(this.dateToSearch);
            if (startDate > endDate) {
                this.toast.warning('La fecha de inicio no puede ser mayor que la fecha de término');
                this.dateFromSearch = '';
                this.loadEntries();
                return;
            }
        }
        this.loadEntries();
    }

    onDateToSearch() {
        // Validar que la fecha de término no sea menor que la fecha de inicio
        if (this.dateFromSearch && this.dateToSearch) {
            const startDate = new Date(this.dateFromSearch);
            const endDate = new Date(this.dateToSearch);
            if (startDate > endDate) {
                this.toast.warning('La fecha de término no puede ser menor que la fecha de inicio');
                this.dateToSearch = '';
                this.loadEntries();
                return;
            }
        }
        this.loadEntries();
    }

    onDateSearch(event: Event) {
        this.dateSearch = (event.target as HTMLInputElement).value;
        this.dateSubject.next(this.dateSearch);
    }

    onProviderSearch(event: Event) {
        this.providerSearch = (event.target as HTMLInputElement).value;
        this.providerSubject.next(this.providerSearch);
    }


    onDocumentStatusFilterChange() {
        this.currentPage = 1; // Resetear la página al cambiar el filtro
        this.loadEntries();
    }

    clearFilters() {

        this.processSearch='';
        this.invoiceSearch = '';
        this.orderSearch = '';
        this.dateFromSearch = '';
        this.dateToSearch = '';
        this.providerSearch = '';
        this.documentStatusFilter = 'all'; // Resetear el filtro de documentación
        this.currentPage = 1;
        this.loadEntries();
    }

  hasActiveFilters(): boolean {
    return !!(
        this.processSearch ||
        this.invoiceSearch ||
        this.orderSearch ||
        this.dateSearch ||
        this.dateFromSearch ||
        this.dateToSearch ||
        this.providerSearch ||
        this.documentStatusFilter !== 'all'
        );
    }

    // Paginación
    getPages(): number[] {
        return Array.from({ length: this.totalPages }, (_, i) => i + 1);
    }

    // Métodos para acciones
    //solo para ver que id recoge y manda a ver los documentos
    editEntry(entryId: number) {
        this.toast.info('Redirigiendo a editar entrada', 'Info');
        // La redirección se maneja con routerLink en el HTML
    }

    deleteEntry(entryId: number) {
        // Propósito: Elimina una entrada con confirmación.
        Swal.fire({
            title: '¿Estás seguro?',
            text: '¿Deseas eliminar esta entrada? Esta acción no se puede deshacer.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'No',
            customClass: {
                confirmButton: 'btn btn-primary',
                cancelButton: 'btn btn-light'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                this.service.deleteEntry(entryId).subscribe({
                    next: () => {
                        Swal.fire({
                            icon: 'success',
                            title: 'Eliminada',
                            text: 'Entrada eliminada correctamente.',
                            timer: 1500,
                            showConfirmButton: false
                        });
                        this.loadEntries(this.currentPage);
                    },
                    error: () => {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: 'Error al eliminar la entrada.'
                        });
                    }
                });
            }
        });
    }

    /*/ Nuevo método para descargar el PDF
    downloadPdf(entryId: number) {
        this.service.generateEntryPdf(entryId).subscribe({
            next: (blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `entrada_${entryId}.pdf`;
                link.click();
                window.URL.revokeObjectURL(url);
                this.toast.success('PDF descargado correctamente');
            },
            error: (error) => {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error al descargar el PDF: ' + (error.error?.message || 'Desconocido')
                });
                console.error(error);
            }
        });
    }

    downloadPdf(entryId: number) {
    this.service.getPurchaseDocuments(entryId).subscribe({
        next: (response: any) => {
            console.log('Respuesta de getPurchaseDocuments para entryId:', entryId, response);
            if (!response || !response.data || !Array.isArray(response.data)) {
                console.error('Respuesta inválida o sin datos:', response);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'No se encontraron documentos para esta entrada o la respuesta del servidor es inválida.'
                });
                return;
            }
            const documents = response.data.filter((doc: any) => doc.is_auto_pdf === true);
            if (documents.length === 0) {
                console.warn('No se encontraron documentos con is_auto_pdf = true para entryId:', entryId);
                Swal.fire({
                    icon: 'warning',
                    title: 'Sin documento',
                    text: 'No se encontró un PDF generado para esta entrada.'
                });
                return;
            }
            const document = documents[0]; // Usar el más reciente
            console.log('Documento seleccionado para descargar:', document);
            this.service.getPurchaseDocumentFile(document.id).subscribe({
                next: (blob: Blob) => {
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = document.original_name;
                    link.click();
                    window.URL.revokeObjectURL(url);
                    this.toast.success('PDF descargado correctamente');
                },
                error: (error) => {
                    console.error('Error al descargar PDF para documentId:', document.id, error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: error.error?.message || 'Error al descargar el PDF'
                    });
                }
            });
        },
        error: (error) => {
            console.error('Error al obtener documentos para entryId:', entryId, error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.error?.message || 'Error al obtener documentos del servidor'
            });
        }
    });
    }*/

    downloadPdf(entryId: number) {
    this.service.getPurchaseDocuments(entryId).subscribe({
        next: (response: any) => {
            console.log('Respuesta de getPurchaseDocuments para entryId:', entryId, response);
            if (!response || !response.data || !Array.isArray(response.data)) {
                console.error('Respuesta inválida o sin datos:', response);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'No se encontraron documentos para esta entrada o la respuesta del servidor es inválida.'
                });
                return;
            }
            const documents = response.data.filter((doc: any) => doc.is_auto_pdf === true);
            if (documents.length === 0) {
                console.warn('No se encontraron documentos con is_auto_pdf = true para entryId:', entryId);
                this.service.generateEntryPdf(entryId).subscribe({
                    next: (blob: Blob) => {
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `entrada_${entryId}.pdf`;
                        link.click();
                        window.URL.revokeObjectURL(url);
                        this.toast.success('PDF generado y descargado correctamente');
                    },
                    error: (error) => {
                        console.error('Error al generar PDF para entryId:', entryId, error);
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: error.error?.message || 'Error al generar el PDF'
                        });
                    }
                });
                return;
            }
            const doc = documents[0]; // Renamed to avoid shadowing
            console.log('Documento seleccionado para descargar:', doc);
            this.service.getPurchaseDocumentFile(doc.id).subscribe({
                next: (blob: Blob) => {
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = doc.original_name;
                    link.click();
                    window.URL.revokeObjectURL(url);
                    this.toast.success('PDF descargado correctamente');
                },
                error: (error) => {
                    console.error('Error al descargar PDF para documentId:', doc.id, error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: error.error?.message || 'Error al descargar el PDF'
                    });
                }
            });
        },
        error: (error) => {
            console.error('Error al obtener documentos para entryId:', entryId, error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.error?.message || 'Error al obtener documentos del servidor'
            });
        }
    });
}
}
   

