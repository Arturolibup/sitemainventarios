import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ProductsService } from '../service/product.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';

interface ExitFilters {
    folio: string;
    area: string;
    subarea: string;
    exit_date: string;
    page?: string;
    per_page?:string;
    exit_status?: string;
}

interface ProductExit {
    id: number;
    reference: string;
    folio:string;
    area?: { id: number; name: string };
    subarea?: { id: number; name: string };
    exit_date: string;
    created_by?: any;
    created_by_name?: string;
    exit_status?: string;
    pending_expires_at?: string;
    received_by?: string;
    delivered_by?: string;
    authorized_by?: string;
    products: { 
        product_id: number; 
        quantity: number; 
        invoice_number: string | null; 
        entry_id: number | null;
        warehouse?: string;
        product: { id: number; title: string };
    }[];
}

@Component({
    selector: 'app-product-exit-list',
    templateUrl: './product-exit-list.component.html',
    styleUrls: ['./product-exit-list.component.scss']
})
export class ProductExitListComponent implements OnInit{
    exits: ProductExit[] = [];
    total: number = 0;
    perPage: number = 10;
    currentPage: number = 1;
    totalPages: number = 1;
    filters: ExitFilters = {
        folio: '',
        area: '',
        subarea: '',
        exit_date: '',
        exit_status: ''
    };
    isLoading: boolean = false;
    isLoading$: any;
    expiringSoonCount: number = 0;

    constructor(
        private service: ProductsService,
        private router: Router,
        private toast: ToastrService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        this.isLoading$ = this.service.isLoading$;
        this.loadExits(1);
    }

    loadExits(page: number = 1) {
        console.log('Cargando salidas con filtros:', this.filters);
        this.isLoading = true;
        this.cdr.detectChanges();
    
        this.filters['page'] = page.toString();
        this.filters['per_page']= this.perPage.toString();
        this.service.getExits(this.filters).subscribe(
            response => {
                console.log('Respuesta del backend (sin procesar):', response);
                if (!response || !response.data) {
                    console.error('Respuesta vacía o mal formada:', response);
                    this.exits = [];
                    this.total = 0;
                    this.totalPages = 1;
                    this.expiringSoonCount = 0;
                } else {
                    this.exits = response.data.map((exit: ProductExit) => {
                        const mappedExit = {
                            ...exit,
                            created_by_name: exit.created_by_name || (exit.created_by ? `Usuario ${exit.created_by}` : 'N/A'),
                            received_by: exit.received_by,
                            reference: exit.reference,
                            delivered_by: exit.delivered_by,
                            authorized_by: exit.authorized_by,
                            pending_expires_at: exit.pending_expires_at ? this.formatDateToMazatlan(exit.pending_expires_at) : null,
                            products: Array.isArray(exit.products) ? exit.products.map(product => ({
                                product_id: product.product_id,
                                quantity: product.quantity,
                                invoice_number: product.invoice_number || 'N/A',
                                entry_id: product.entry_id || null,
                                warehouse: product.warehouse || 'Central Aguamilpa',
                                product: {
                                    id: product.product ?.id,
                                    //entry_id:product.entry_id,
                                    title: product.product?.title || 'Producto no encontrado'
                                }
                            })) : []
                        };
                        console.log('Salida mapeada ID:', exit.id, 'Productos:', mappedExit.products, 'pending_expires_at:', mappedExit.pending_expires_at);
                        return mappedExit;
                    });
                    this.total = response.total;
                    this.perPage = response.per_page;
                    this.currentPage = response.current_page;
                    this.totalPages = Math.ceil(response.total / this.perPage);
    
                    this.expiringSoonCount = this.exits.reduce((count, exit) => {
                        const isExpiring = this.isExpiringSoon(exit);
                        console.log(`Salida ${exit.id}: pending_expires_at=${exit.pending_expires_at}, isPending=${this.isPending(exit)}, isExpiringSoon=${isExpiring}`);
                        return count + (isExpiring ? 1 : 0);
                    }, 0);
                    console.log('Total salidas próximas a expirar:', this.expiringSoonCount);
                }
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error => {
                console.error('Error al cargar salidas:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error.message || 'Error al cargar las salidas. Revisa la consola para más detalles.',
                    confirmButtonText: 'Entendido'
                });
                this.exits = [];
                this.total = 0;
                this.expiringSoonCount = 0;
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        );
    }

    // Función para formatear fechas de UTC a UTC-7 (Mazatlán)
    formatDateToMazatlan(utcDate: string): string {
        const date = new Date(utcDate + 'Z');
        if (isNaN(date.getTime())) {
            console.error('Fecha UTC inválida:', utcDate);
            return 'Fecha inválida';
        }

        const options: Intl.DateTimeFormatOptions = {
            timeZone: 'America/Mazatlan',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        const formatter = new Intl.DateTimeFormat('es-MX', options);
        const parts = formatter.formatToParts(date);
        const formattedDate = `${parts[4].value}/${parts[2].value}/${parts[0].value} ${parts[6].value}:${parts[8].value}`;
        console.log(`Fecha UTC: ${utcDate}, Fecha Mazatlán: ${formattedDate}`);
        return formattedDate;
    }
    
    isPending(exit: ProductExit): boolean {
        return exit.exit_status === 'pending';
    }

    isExpiringSoon(exit: ProductExit): boolean {
        if (!exit.pending_expires_at || !this.isPending(exit)) {
            return false;
        }
        const now = new Date();
        const expiresAt = new Date(exit.pending_expires_at.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));
        const diffHours = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
        return diffHours <= 24 && diffHours > 0;
    }


    applyFilters() {
        this.loadExits(1);
    }

    completeExit(id: number) {
        Swal.fire({
            title: '¿Completar salida?',
            text: 'La salida cambiará a estado Completada y se eliminará la fecha de expiración.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, completar',
            cancelButtonText: 'No',
            customClass: {
                confirmButton: 'btn btn-primary',
                cancelButton: 'btn btn-light'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                this.service.completeExit(id).subscribe({
                    next: () => {
                        Swal.fire({
                            icon: 'success',
                            title: 'Salida completada',
                            text: 'La salida ahora está marcada como Completada.',
                            timer: 1500,
                            showConfirmButton: false
                        });
                        this.loadExits(this.currentPage);
                    },
                    error: (error) => {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: 'Error al completar la salida: ' + (error.message || 'Intenta de nuevo')
                        });
                        console.error('Error en completeExit:', error);
                    }
                });
            }
        });
    }

    //estos estan pendientes de validad el dia 220425
    //ispending y isexpriensoo
    isPendin(exit: ProductExit): boolean {
        if (exit.exit_status !== 'pending' || !exit.pending_expires_at) {
            return false;
        }
        const expiresAt = new Date(exit.pending_expires_at);
        const now = new Date();
        return expiresAt > now;
    }

    isExpiringSoo(exit: ProductExit): boolean {
        if (!exit.pending_expires_at) return false;
        const expiresAt = new Date(exit.pending_expires_at);
        const now = new Date();
        const hoursLeft = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
        return hoursLeft <= 24 && hoursLeft > 0;
    }

    editExit(id: number) {
        console.log('Editando salida con ID:', id);
        this.router.navigate(['/product-entries/product-exits/edit', id]);
    }
    
    deleteExit(id: number) {
        Swal.fire({
            title: '¿Estás seguro?',
            text: '¿Deseas eliminar esta salida? Esta acción no se puede deshacer.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'No, cancelar',
            customClass: {
                confirmButton: 'btn btn-primary',
                cancelButton: 'btn btn-light'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                this.service.deleteExit(id).subscribe(
                    () => {
                        Swal.fire({
                            icon: 'success',
                            title: 'Eliminada',
                            text: 'Salida eliminada correctamente',
                            timer: 1500,
                            showConfirmButton: false
                        });
                        this.loadExits(this.currentPage);
                    },
                    error => {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: 'Error al eliminar la salida'
                        });
                        console.error(error);
                    }
                );
            }
        });
    }

    downloadExitPdf(id: number) {
        this.service.downloadExitPdf(id).subscribe(
            (blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `vale_salida_${id}.pdf`;
                link.click();
                window.URL.revokeObjectURL(url);
                this.toast.success('PDF descargado correctamente');
            },
            error => {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error al descargar el PDF'
                });
                console.error(error);
            }
        );
    }

    printPdf(id: number) {
        this.service.downloadExitPdf(id).subscribe(
            (blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                const printWindow = window.open(url);
                if (printWindow) {
                    printWindow.print();
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'No se pudo abrir la ventana de impresión'
                    });
                }
            },
            error => {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error al imprimir el PDF'
                });
                console.error(error);
            }
        );
    }

    clearFilters() {
        this.filters = {
            folio: '',
            area: '',
            subarea: '',
            exit_date: '',
            exit_status: ''
        };
        console.log('Filtros limpiados:', this.filters);
        this.loadExits(1);
    }

    /*
    showProductDetai(exit: ProductExit) {
        // Agrupar productos por product_id
        const groupedProducts = exit.products.reduce((acc: any[], product) => {
            const existingProduct = acc.find(p => p.product_id === product.product_id);
            if (existingProduct) {
                existingProduct.quantity += product.quantity;
                if (product.invoice_number && !existingProduct.invoices.includes(product.invoice_number)) {
                    existingProduct.invoices.push(product.invoice_number);
                }
            } else {
                acc.push({
                    product_id: product.product_id,
                    title: product.product.title,
                    quantity: product.quantity,
                    invoices: product.invoice_number ? [product.invoice_number] : [],
                    warehouse: product.warehouse || 'Central Aguamilpa',
                    entry_id:product.entry_id,
                });
            }
            return acc;
        }, []);
    
        console.log('Productos agrupados para salida ID:', exit.id, groupedProducts);
    
        const productDetails = groupedProducts
            .map(p => `
                <tr>
                    <td style="padding: 5px; border: 1px solid #ddd;">${p.title}</td>
                    <td style="padding: 5px; border: 1px solid #ddd;">${p.quantity}</td>
                    <td style="padding: 5px; border: 1px solid #ddd;">${p.invoices.join(', ') || 'N/A'}</td>
                    
                </tr>
            `)
            .join('');
    
        const [year, month, day] = exit.exit_date.split('-');
        const exitDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
        const formattedExitDate = exitDate.toLocaleDateString('es-MX', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric'
        });
    
        Swal.fire({
            title: `Detalles de la Salida ${exit.reference}`,
            html: `
                <div style="text-align: left; padding-right: 10px;">
                    <p><strong>Folio:</strong> ${exit.folio}</p>
                    <p><strong>Referencia:</strong> ${exit.reference}</p>
                    <p><strong>Área:</strong> ${exit.area?.name || 'N/A'}</p>
                    <p><strong>Subárea:</strong> ${exit.subarea?.name || 'N/A'}</p>
                    <p><strong>Fecha de Salida:</strong> ${formattedExitDate}</p>
                    <p><strong>Estado:</strong> ${this.isPending(exit) ? 'Pendiente' : 'Completada'}</p>
                    ${this.isPending(exit) ? `<p><strong>Expira el:</strong> ${new Date(exit.pending_expires_at + 'Z').toLocaleString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}</p>` : ''}
                    <p><strong>Creado por:</strong> ${exit.created_by_name}</p>
                    <p><strong>Entregado por:</strong> ${exit.delivered_by || 'N/A'}</p>
                    <p><strong>Recibido por:</strong> ${exit.received_by || 'N/A'}</p>
                    <p><strong>Autorizado por:</strong> ${exit.authorized_by || 'N/A'}</p>
                    <h5 style="margin-top: 15px;">Productos:</h5>
                    <div style="max-height: 400px; overflow-y: auto; border: 1px solid #ccc;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr>
                                    <th style="padding: 5px; border: 1px solid #ddd; background-color: #f8f9fa;">Producto</th>
                                    <th style="padding: 5px; border: 1px solid #ddd; background-color: #f8f9fa;">Cantidad</th>
                                    <th style="padding: 5px; border: 1px solid #ddd; background-color: #f8f9fa;">Factura</th>
                                    
                                </tr>
                            </thead>
                            <tbody>
                                ${productDetails || '<tr><td colspan="4" style="padding: 5px; text-align: center;">No hay productos</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            `,
            confirmButtonText: 'Cerrar',
            customClass: {
                confirmButton: 'btn btn-primary'
            },
            width: 'auto',
            didOpen: () => {
                const swalContainer = Swal.getPopup();
                if (swalContainer) {
                    swalContainer.style.maxWidth = '900px';
                }
            }
        });
    }
*/
    showProductDetails(exit: ProductExit) {
    // Agrupar productos por product_id
    const groupedProducts = exit.products.reduce((acc: any[], product) => {
        const existingProduct = acc.find(p => p.product_id === product.product_id);
        if (existingProduct) {
            existingProduct.quantity += product.quantity;
            if (product.invoice_number && !existingProduct.invoices.includes(product.invoice_number)) {
                existingProduct.invoices.push(product.invoice_number);
            }
        } else {
            acc.push({
                product_id: product.product_id,
                title: product.product.title,
                quantity: product.quantity,
                invoices: product.invoice_number ? [product.invoice_number] : [],
                warehouse: product.warehouse || 'Central Aguamilpa',
                entry_id: product.entry_id,
            });
        }
        return acc;
    }, []);

    console.log('Productos agrupados para salida ID:', exit.id, groupedProducts);

    const productDetails = groupedProducts
        .map(p => `
            <tr>
                <td style="width: 500px; padding: 5px; border: 1px solid #ddd; text-align: left;">${p.title || 'N/A'}</td>
                <td style="width: 100px; padding: 5px; border: 1px solid #ddd; text-align: center;">${p.quantity || 'N/A'}</td>
                <td style="width: 150px; padding: 5px; border: 1px solid #ddd; text-align: center;">${p.invoices.join(', ') || 'N/A'}</td>
            </tr>
        `)
        .join('');

    const [year, month, day] = exit.exit_date.split('-');
    const exitDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
    const formattedExitDate = exitDate.toLocaleDateString('es-MX', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric'
    });

    Swal.fire({
        title: `Detalles de la Salida ${exit.reference}`,
        html: `
            <div style="text-align: left; padding-right: 10px;">
                <p><strong>Folio:</strong> ${exit.folio || 'N/A'}</p>
                <p><strong>Referencia:</strong> ${exit.reference || 'N/A'}</p>
                <p><strong>Área:</strong> ${exit.area?.name || 'N/A'}</p>
                <p><strong>Subárea:</strong> ${exit.subarea?.name || 'N/A'}</p>
                <p><strong>Fecha de Salida:</strong> ${formattedExitDate || 'N/A'}</p>
                <p><strong>Estado:</strong> ${this.isPending(exit) ? 'Pendiente' : 'Completada'}</p>
                ${this.isPending(exit) ? `<p><strong>Expira el:</strong> ${new Date(exit.pending_expires_at + 'Z').toLocaleString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) || 'N/A'}</p>` : ''}
                <p><strong>Creado por:</strong> ${exit.created_by_name || 'N/A'}</p>
                <p><strong>Entregado por:</strong> ${exit.delivered_by || 'N/A'}</p>
                <p><strong>Recibido por:</strong> ${exit.received_by || 'N/A'}</p>
                <p><strong>Autorizado por:</strong> ${exit.authorized_by || 'N/A'}</p>
                <h5 style="margin-top: 15px;">Productos:</h5>
                <div class="table-responsive" style="max-height: 400px; overflow-y: auto; border: 1px solid #ccc;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th style="width: 500px; padding: 5px; border: 1px solid #ddd; background-color: #f8f9fa; text-align: left;">Producto</th>
                                <th style="width: 100px; padding: 5px; border: 1px solid #ddd; background-color: #f8f9fa; text-align: center;">Cantidad</th>
                                <th style="width: 150px; padding: 5px; border: 1px solid #ddd; background-color: #f8f9fa; text-align: center;">Factura</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${productDetails || '<tr><td colspan="3" style="padding: 5px; text-align: center; border: 1px solid #ddd;">No hay productos</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `,
        confirmButtonText: 'Cerrar',
        customClass: {
            confirmButton: 'btn btn-primary'
        },
        width: 'auto',
        didOpen: () => {
            const swalContainer = Swal.getPopup();
            if (swalContainer) {
                swalContainer.style.maxWidth = '900px'; // Ajuste a un ancho más controlado
                swalContainer.style.padding = '20px';
            }
        }
    });
}

    goToPurchaseDocuments(exit: ProductExit) {
        const entryId = exit.products && exit.products.length > 0 ? exit.products[0].entry_id : null;
        if (entryId) {
            this.router.navigate(['/product-entries/list-purchase-documents', entryId], {
                queryParams: { invoice: exit.products[0].invoice_number }
            });
        } else {
            this.toast.error('No se encontró una entrada asociada a esta salida', 'Error');
        }
    }

    onPerPageChange() {
        this.perPage =Number(this.perPage); //convertir a numero
        this.currentPage = 1; // Reseteamos a la primera página al cambiar el número de entradas
        this.loadExits(this.currentPage);
  }

}