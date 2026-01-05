import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ProductsService, SearchProduct, InvoiceSearchResponse, ProductByInvoiceResponse } from '../service/product.service';
import { ToastrService } from 'ngx-toastr';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
import Swal from 'sweetalert2';
import { NgForm } from '@angular/forms';
import { AuthService } from '../../auth/services/auth.service';
import { UserModel } from '../../auth';

type UserType = UserModel | undefined;
type InvoiceMode = 'multiple_invoices' | 'single_invoice'; // Fixed typo: InoviceMode -> InvoiceMode

interface SearchSubarea {
    id: number;
    name: string;
    area: { id: number; name: string };
}

interface ExitProduct {
    product_id: number;
    title: string;
    quantity: number;
    stock: number;
    stock_global: number;
    warehouse: string;
    invoice_number?: string;
    entry_id: number;
    unit: string;
    usedEntries?: { entry_id: number; quantity: number; invoice_number: string }[];
}

@Component({
    selector: 'app-product-exit-create',
    templateUrl: './product-exit-create.component.html',
    styleUrls: ['./product-exit-create.component.scss']
})
export class ProductExitCreateComponent implements OnInit {
    @ViewChild('productForm') productForm!: NgForm; // Add ViewChild to bind to the template form

    exitData: {
        area_id: number | null;
        area_name: string;
        subarea_id: number | null;
        subarea_name: string;
        reference: string;
        exit_date: string;
        received_by: string;
        delivered_by: string;
        authorized_by: string;
        products: ExitProduct[];
        created_by?: number;
        exit_status?: string;
        pending_expires_at?: string;
        is_pending?: boolean;
        invoice_mode: InvoiceMode; // Updated to use InvoiceMode
        single_invoice_number?: string;
    } = {
        area_id: null,
        area_name: '',
        subarea_id: null,
        subarea_name: '',
        reference: '',
        exit_date: new Date().toISOString().split('T')[0],
        received_by: '',
        delivered_by: '',
        authorized_by: '',
        products: [],
        created_by: undefined,
        exit_status: 'completed',
        pending_expires_at: '',
        is_pending: false,
        invoice_mode: 'multiple_invoices',
        single_invoice_number: ''
    };
    isEdit = false;
    exitId: number | null = null;
    searchProductQuery = '';
    searchProductResults: SearchProduct[] = [];
    searchSubareaQuery = '';
    searchSubareaResults: SearchSubarea[] = [];
    isLoading = false;
    minDateTime: string = new Date().toISOString().slice(0, 16);
    searchInvoiceQuery = '';
    searchInvoiceResults: string[] = [];
    private productSearchTerms = new Subject<string>();
    private subareaSearchTerms = new Subject<string>();
    private invoiceSearchTerms = new Subject<string>();

    constructor(
        private service: ProductsService,
        private router: Router,
        private route: ActivatedRoute,
        private toast: ToastrService,
        private cdr: ChangeDetectorRef,
        private authService: AuthService
    ) {}

    ngOnInit(): void {
        this.exitId = this.route.snapshot.params['id'];
        if (this.exitId) {
            this.isEdit = true;
            this.loadExitData(this.exitId);
        } else {
            const today = new Date();
            const mazatlanOffset = -7 * 60;
            const localDate = new Date(today.getTime() + (mazatlanOffset * 60 * 1000));
            this.exitData.exit_date = localDate.toISOString().split('T')[0];
            console.log('Fecha inicializada:', this.exitData.exit_date);
        }

        console.log('AuthService currentUser en ngOnInit:', this.authService.currentUserValue);

        this.service.getUser().subscribe({
            next: user => {
                console.log('User from getUser:', user);
                this.exitData.created_by = user.id;
                this.exitData.delivered_by = `${user.name || ''} ${user.surname || ''}`.trim() || 'Usuario Sistema';
                console.log('Delivered By asignado:', this.exitData.delivered_by);
                this.cdr.detectChanges();
            },
            error: error => {
                console.error('Error al obtener usuario:', error);
                this.exitData.delivered_by = 'Usuario Sistema';
                this.cdr.detectChanges();
            }
        });

        this.productSearchTerms.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(term => term.trim() ? this.service.searchExitProducts(term) : of([]))
        ).subscribe({
            next: response => {
                this.searchProductResults = response.products || [];
                // AÑADIDO: Asegurarse de que cada producto tenga stock_global definido
        this.searchProductResults.forEach(product => {
            if (product.stock_global === undefined || product.stock_global === null) {
                product.stock_global = product.stock || 0;
            }
            console.log(`Producto ${product.title}: stock=${product.stock}, stock_global=${product.stock_global}`);
        });
        this.cdr.detectChanges();
    },
    error: error => this.handleError(error, 'Error al buscar productos')
});
        this.subareaSearchTerms.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(term => term.trim() ? this.service.searchSubareas(term) : of([]))
        ).subscribe({
            next: response => {
                this.searchSubareaResults = response || [];
                this.cdr.detectChanges();
            },
            error: error => this.handleError(error, 'Error al buscar subáreas')
        });

        this.invoiceSearchTerms.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(term => term.trim() ? this.service.searchInvoices(term) : of([]))
        ).subscribe({
            next: (response: InvoiceSearchResponse) => {
                this.searchInvoiceResults = response.invoices || [];
                console.log('Resultados de búsqueda de facturas:', this.searchInvoiceResults);
                this.cdr.detectChanges();
            },
            error: error => this.handleError(error, 'Error al buscar facturas')
        });

        this.service.getUser().subscribe(user => {
            this.exitData.created_by = user.id;
        });
    }

    searchProduct(query: string) {
        this.searchProductQuery = query;
        this.productSearchTerms.next(query);
    }

    searchInvoice(query: string) {
        this.searchInvoiceQuery = query;
        this.invoiceSearchTerms.next(query);
    }

    selectInvoice(invoiceNumber: string) {
    this.exitData.single_invoice_number = invoiceNumber;
    this.searchInvoiceQuery = '';
    this.searchInvoiceResults = [];

    this.service.searchProductsByInvoice(invoiceNumber).subscribe({
        next: (response: ProductByInvoiceResponse) => {
            const products = (response.products || []) as SearchProduct[];
            if (products.length === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Sin productos',
                    text: `No se encontraron productos disponibles para la factura ${invoiceNumber}.`,
                    confirmButtonText: 'Entendido'
                });
            }
            this.exitData.products = products.map((product: SearchProduct) => ({
                product_id: product.product_id,
                title: product.title,
                quantity: 0,
                stock: product.stock,
                stock_global: product.stock_global,
                warehouse: 'Central Aguamilpa',
                invoice_number: product.invoice_number || 'N/A',
                entry_id: product.entry_id,
                unit: product.unit,
                usedEntries: [{ entry_id: product.entry_id, quantity: 0, invoice_number: product.invoice_number || 'N/A' }]
            }));
            console.log('Productos cargados para factura:', this.exitData.products);
            this.cdr.detectChanges();
        },
        error: (error: any) => this.handleError(error, 'Error al cargar productos de la factura')
    });
}

    updateUsedEntries(product: ExitProduct) {
        if (product.usedEntries && product.usedEntries.length > 0) {
            product.usedEntries[0].quantity = product.quantity;
        }
        this.cdr.detectChanges();
    }

    onInvoiceModeChange() {
        this.exitData.products = [];
        this.exitData.single_invoice_number = '';
        this.searchInvoiceQuery = '';
        this.searchInvoiceResults = [];
        this.cdr.detectChanges();
    }

    selectProduct(product: SearchProduct) {
    if (this.exitData.invoice_mode !== 'multiple_invoices') {
        Swal.fire({
            icon: 'warning',
            title: 'Acción no permitida',
            text: 'En modo "Una Sola Factura", los productos se cargan automáticamente.'
        });
        return;
    }


    const exists = this.exitData.products.some(p => p.product_id === product.product_id);
    if (exists) {
        Swal.fire({
            icon: 'warning',
            title: 'Producto duplicado',
            text: 'Este producto ya está agregado.'
        });
        return;
    }


    // Asegurar que usedEntries esté inicializado correctamente
    const initialUsedEntries = [{
        entry_id: product.entry_id,
        quantity: 1,
        invoice_number: product.invoice_number || 'N/A'
    }];
    
    console.log('Inicializando usedEntries para producto nuevo:', initialUsedEntries);

    this.exitData.products.push({
        product_id: product.product_id,
        title: product.title,
        quantity: 1,
        stock: product.stock_global, // Usar stock_global en multiple_invoices
        stock_global: product.stock_global,
        warehouse: 'Central Aguamilpa',
        invoice_number: product.invoice_number || 'N/A',
        entry_id: product.entry_id,
        unit: product.unit,
        usedEntries: initialUsedEntries
    });

    this.searchProductQuery = '';
    this.searchProductResults = [];
    this.onQuantityChange(this.exitData.products[this.exitData.products.length - 1], this.exitData.products.length - 1);
    this.cdr.detectChanges();
}

    onStatusChange() {
        this.exitData.is_pending = this.exitData.exit_status === 'pending';
        if (!this.exitData.is_pending) {
            this.exitData.pending_expires_at = '';
        }
        console.log('Estado cambiado:', this.exitData.exit_status, 'is_pending:', this.exitData.is_pending);
        this.cdr.detectChanges();
    }


    validateData(): boolean {
    console.log('Validando datos:', JSON.stringify(this.exitData));
    console.log('Delivered By en validacion:', this.exitData.delivered_by);
    const requiredFields = [
        { field: 'area_id', label: 'Área' },
        { field: 'subarea_id', label: 'Subárea' },
        { field: 'reference', label: 'Referencia' },
        { field: 'exit_date', label: 'Fecha de salida' },
        { field: 'exit_status', label: 'Estado' },
        { field: 'delivered_by', label: 'Entregado por' },
        { field: 'invoice_mode', label: 'Modo de Factura' }
    ];

    for (const { field, label } of requiredFields) {
        const value = this.exitData[field as keyof typeof this.exitData];
        if (!value || (typeof value === 'string' && value.trim() === '')) {
            Swal.fire({
                icon: 'warning',
                title: 'Campo faltante',
                text: `El campo "${label}" es obligatorio`,
                confirmButtonText: 'Entendido'
            });
            return false;
        }
    }

    if (this.exitData.invoice_mode === 'single_invoice') {
        if (!this.exitData.single_invoice_number || this.exitData.single_invoice_number.trim() === '') {
            Swal.fire({
                icon: 'warning',
                title: 'Campo faltante',
                text: 'El número de factura es obligatorio para salidas de una sola factura',
                confirmButtonText: 'Entendido'
            });
            return false;
        }
    }

    if (this.exitData.exit_status === 'pending') {
        if (!this.exitData.pending_expires_at) {
            Swal.fire({
                icon: 'warning',
                title: 'Campo faltante',
                text: 'La fecha de caducidad es obligatoria para salidas pendientes',
                confirmButtonText: 'Entendido'
            });
            return false;
        }

        const expiresAt = new Date(this.exitData.pending_expires_at);
        const now = new Date();
        const minFutureTime = new Date(now.getTime() + 5 * 60 * 1000);

        console.log('Fecha de caducidad:', expiresAt.toISOString());
        console.log('Hora actual:', now.toISOString());
        console.log('Mínima fecha futura:', minFutureTime.toISOString());

        if (isNaN(expiresAt.getTime())) {
            Swal.fire({
                icon: 'warning',
                title: 'Fecha inválida',
                text: 'La fecha de caducidad no tiene un formato válido. Por favor, selecciona una fecha y hora válidas.',
                confirmButtonText: 'Entendido'
            });
            return false;
        }

        if (expiresAt <= minFutureTime) {
            Swal.fire({
                icon: 'warning',
                title: 'Fecha de caducidad no válida',
                text: 'La fecha de caducidad debe ser al menos 5 minutos en el futuro. Por favor, selecciona una fecha posterior.',
                confirmButtonText: 'Entendido'
            });
            return false;
        }

        const year = expiresAt.getFullYear();
        const month = String(expiresAt.getMonth() + 1).padStart(2, '0');
        const day = String(expiresAt.getDate()).padStart(2, '0');
        const hours = String(expiresAt.getHours()).padStart(2, '0');
        const minutes = String(expiresAt.getMinutes()).padStart(2, '0');
        this.exitData.pending_expires_at = `${year}-${month}-${day}T${hours}:${minutes}`;
        console.log('Fecha de caducidad formateada:', this.exitData.pending_expires_at);
    }

    if (this.exitData.products.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin productos',
            text: 'Debe agregar al menos un producto',
            confirmButtonText: 'Entendido'
        });
        return false;
    }

    for (const [index, product] of this.exitData.products.entries()) {
        if (!product.product_id) {
            Swal.fire({
                icon: 'warning',
                title: 'Producto inválido',
                text: `Producto ${index + 1}: Debe seleccionar un producto válido`,
                confirmButtonText: 'Entendido'
            });
            return false;
        }

        if (this.exitData.invoice_mode === 'multiple_invoices') {
            if (!product.usedEntries || product.usedEntries.length === 0) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Entradas faltantes',
                    text: `Producto ${index + 1}: Debe especificar las entradas utilizadas`,
                    confirmButtonText: 'Entendido'
                });
                return false;
            }
            //Verificar que la suma de cantidades en usedEntries coincida con la cantidad total
            const totalUsedQuantity = product.usedEntries.reduce((sum, entry) => sum + entry.quantity, 0);
            if (totalUsedQuantity !== product.quantity) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Cantidad inconsistente',
                    text: `Producto ${index + 1}: La suma de cantidades en entradas (${totalUsedQuantity}) no coincide con la cantidad solicitada (${product.quantity})`,
                    confirmButtonText: 'Entendido'
                });
                return false;
            }

            if (product.quantity > product.stock_global) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Stock excedido',
                    text: `Producto ${index + 1}: La cantidad (${product.quantity}) excede el stock total disponible (${product.stock_global})`,
                    confirmButtonText: 'Entendido'
                });
                return false;
            }
        } else {
            if (product.invoice_number !== this.exitData.single_invoice_number) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Factura inválida',
                    text: `Producto ${index + 1}: El producto pertenece a una factura (${product.invoice_number}) que no coincide con la factura seleccionada (${this.exitData.single_invoice_number})`,
                    confirmButtonText: 'Entendido'
                });
                return false;
            }

            if (product.quantity > product.stock) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Stock excedido',
                    text: `Producto ${index + 1}: La cantidad (${product.quantity}) excede el stock disponible (${product.stock})`,
                    confirmButtonText: 'Entendido'
                });
                return false;
            }

            if (!product.entry_id) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Entrada inválida',
                    text: `Producto ${index + 1}: Debe tener una entrada asociada`,
                    confirmButtonText: 'Entendido'
                });
                return false;
            }
        }

        if (!product.warehouse) {
            Swal.fire({
                icon: 'warning',
                title: 'Almacén inválido',
                text: `Producto ${index + 1}: Debe especificar un almacén`,
                confirmButtonText: 'Entendido'
            });
            return false;
        }
    }

    return true;
}

    searchSubarea(query: string) {
        this.searchSubareaQuery = query;
        this.subareaSearchTerms.next(query);
    }

    selectSubarea(subarea: SearchSubarea) {
        console.log('Subárea seleccionada:', subarea);
        this.exitData.subarea_id = subarea.id;
        this.exitData.subarea_name = subarea.name;
        this.exitData.area_id = subarea.area.id;
        this.exitData.area_name = subarea.area.name;
        this.searchSubareaQuery = '';
        this.searchSubareaResults = [];
        this.cdr.detectChanges();
    }

    removeProduct(index: number) {
        this.exitData.products.splice(index, 1);
        this.cdr.detectChanges();
    }

    loadExitData(id: number) {
        this.isLoading = true;
        this.service.getExitById(id).subscribe({
            next: response => {
                this.exitData = {
                    area_id: response.area_id,
                    area_name: response.area?.name || '',
                    subarea_id: response.subarea_id,
                    subarea_name: response.subarea?.name || '',
                    reference: response.reference,
                    exit_date: response.exit_date,
                    received_by: response.received_by || '',
                    delivered_by: response.delivered_by || '',
                    authorized_by: response.authorized_by || '',
                    products: response.products.map((p: any) => ({
                        product_id: p.product_id,
                        title: p.product.title,
                        quantity: p.quantity,
                        stock: p.stock,
                        stock_global: p.stock_global || 0,
                        warehouse: p.warehouse || 'Central Aguamilpa',
                        invoice_number: p.invoice_number || 'N/A',
                        entry_id: p.entry_id,
                        unit: p.unit || 'pieza',
                        usedEntries: [{ entry_id: p.entry_id, quantity: p.quantity, invoice_number: p.invoice_number || 'N/A' }]
                    })),
                    created_by: response.created_by,
                    exit_status: response.exit_status,
                    pending_expires_at: response.pending_expires_at,
                    is_pending: response.exit_status === 'pending' && !!response.pending_expires_at,
                    invoice_mode: (response.invoice_mode || 'multiple_invoices') as InvoiceMode,
                    single_invoice_number: response.single_invoice_number || ''
                };
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: error => {
                this.handleError(error, 'Error al cargar la salida');
                this.isLoading = false;
            }
        });
    }

    saveExit(form: NgForm) {
    if (!form.valid) {
        Swal.fire({
            icon: 'warning',
            title: 'Formulario incompleto',
            text: 'Por favor, completa todos los campos requeridos'
        });
        return;
    }

    if (!this.validateData()) {
        return;
    }

    const data = {
        area_id: this.exitData.area_id,
        subarea_id: this.exitData.subarea_id,
        reference: this.exitData.reference.toUpperCase(),
        exit_date: this.exitData.exit_date,
        received_by: this.exitData.received_by || 'Nombre y Firma',
        delivered_by: this.exitData.delivered_by,
        authorized_by: this.exitData.authorized_by || 'Mtro. Eduardo Efrén Pacheco Andrade, Jefe de Recursos Materiales',
        created_by: this.exitData.created_by,
        exit_status: this.exitData.exit_status,
        pending_expires_at: this.exitData.exit_status === 'pending' ? this.exitData.pending_expires_at : null,
        invoice_mode: this.exitData.invoice_mode,
        single_invoice_number: this.exitData.invoice_mode === 'single_invoice' ? this.exitData.single_invoice_number : null,
        products: this.exitData.products
            .filter(product => product.quantity > 0)
            .map(product => ({
                product_id: product.product_id,
                quantity: product.quantity,
                stock: product.stock,
                stock_global: product.stock_global,
                warehouse: product.warehouse || 'Central Aguamilpa',
                invoice_number: product.invoice_number || 'N/A',
                entry_id: this.exitData.invoice_mode === 'single_invoice' ? product.entry_id : null,
                usedEntries: this.exitData.invoice_mode === 'multiple_invoices' ? product.usedEntries : [
                    { entry_id: product.entry_id, quantity: product.quantity, invoice_number: product.invoice_number || 'N/A' }
                ]
            }))
    };

    console.log('Datos enviados al backend:', JSON.stringify(data));
    this.isLoading = true;

    this.service.createExit(data).subscribe({
        next: (response) => {
            Swal.fire({
                icon: 'success',
                title: 'Salida registrada',
                text: `La salida con referencia ${this.exitData.reference} ha sido registrada correctamente.`,
                confirmButtonText: 'Aceptar'
            }).then(() => {
                this.router.navigate(['/product-entries/product-exits/list']);
            });
            this.isLoading = false;
        },
        error: (error) => {
            Swal.fire({
                icon: 'error',
                title: 'Error al registrar la salida',
                text: error.message || 'Ocurrió un error inesperado. Por favor, intenta de nuevo.',
                confirmButtonText: 'Entendido'
            });
            this.isLoading = false;
            this.router.navigate(['/product-entries/product-exits/list']);
        }
    });
}
    

    getUsedEntriesDisplay(product: ExitProduct): string {
    console.log('getUsedEntriesDisplay - producto:', product.title);
    console.log('getUsedEntriesDisplay - usedEntries:', product.usedEntries);
    
    if (product.usedEntries && Array.isArray(product.usedEntries) && product.usedEntries.length > 0) {
        // Filtrar solo entradas con cantidad > 0
        const validEntries = product.usedEntries.filter(entry => 
            entry && typeof entry === 'object' && entry.quantity > 0 && entry.invoice_number
        );
        
        console.log('getUsedEntriesDisplay - validEntries:', validEntries);
        
        if (validEntries.length > 0) {
            const result = validEntries
                .map(entry => `${entry.invoice_number} (${entry.quantity})`)
                .join(', ');
            
            console.log('getUsedEntriesDisplay - result:', result);
            return result;
        }
    }
    
    // Si no hay usedEntries válidos pero hay invoice_number
    if (product.invoice_number) {
        console.log('getUsedEntriesDisplay - usando invoice_number principal:', product.invoice_number);
        return `${product.invoice_number} (${product.quantity})`;
    }
    
    console.log('getUsedEntriesDisplay - retornando Pendiente');
    return 'Pendiente';
}

   
    resetForm() {
        this.exitData = {
            area_id: null,
            area_name: '',
            subarea_id: null,
            subarea_name: '',
            reference: '',
            exit_date: new Date().toISOString().split('T')[0],
            received_by: '',
            delivered_by: '',
            authorized_by: '',
            products: [],
            created_by: undefined,
            exit_status: 'completed',
            pending_expires_at: '',
            is_pending: false,
            invoice_mode: 'multiple_invoices',
            single_invoice_number: ''
        };
        this.searchProductQuery = '';
        this.searchProductResults = [];
        this.searchSubareaQuery = '';
        this.searchSubareaResults = [];
        this.cdr.detectChanges();
    }

    private navigateToList() {
        console.log('Redirigiendo a la lista de salidas');
        this.router.navigate(['/product-entries/product-exits/list']);
    }

    private handleError(error: any, defaultMessage: string) {
        const message = error.message || error.error?.message || defaultMessage;
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: message,
            confirmButtonText: 'Entendido'
        });
        console.error(defaultMessage, error);
    }

    cancel() {
        Swal.fire({
            title: '¿Estás seguro?',
            text: 'Los datos no guardados se perderán.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, cancelar',
            cancelButtonText: 'No',
            customClass: {
                confirmButton: 'btn btn-primary',
                cancelButton: 'btn btn-light'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                this.navigateToList();
            }
        });
    }


    // Modificación del método onQuantityChange
    onQuantityChange(product: ExitProduct, index: number) {
        if (this.exitData.invoice_mode === 'multiple_invoices') {
            // Validar que la cantidad no exceda el stock global
            if (product.quantity > product.stock_global) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Cantidad Excede Stock',
                    html: `La cantidad ingresada (${product.quantity}) excede el stock total disponible para <strong>${product.title}</strong>.<br>` +
                        `El stock total en el almacén es <strong>${product.stock_global}</strong>.<br>` +
                        `Por favor, ajusta la cantidad.`,
                    confirmButtonText: 'Entendido'
                }).then(() => {
                    product.quantity = product.stock_global;
                    product.usedEntries = [{
                        entry_id: product.entry_id,
                        quantity: product.quantity,
                        invoice_number: product.invoice_number || 'N/A'
                    }];
                    
                    this.cdr.detectChanges();
                });
                return;
            }

            // Obtener todas las entradas disponibles para el producto
            this.service.getProductEntries(product.product_id).subscribe({
                next: (response: { entries: { entry_id: number; invoice_number: string; available: number; created_at: string }[] }) => {
                    console.log('Entradas disponibles para', product.title, ':', response.entries);
                    
                    const entries = response.entries.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); // Ordenar por created_at (FIFO)
                    let remainingQuantity = product.quantity;
                    product.usedEntries = [];

                    // Asignar cantidad a las entradas más antiguas
                    for (const entry of entries) {
                        if (remainingQuantity <= 0) break;
                        const quantityToTake = Math.min(remainingQuantity, entry.available);
                        if (quantityToTake > 0) {
                            product.usedEntries.push({
                                entry_id: entry.entry_id,
                                quantity: quantityToTake,
                                invoice_number: entry.invoice_number || 'N/A'
                            });
                            remainingQuantity -= quantityToTake;
                        }
                    }

                    console.log('usedEntries asignados:', product.usedEntries);

                    // Si no se cubrió la cantidad, ajustar
                    if (remainingQuantity > 0) {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Stock Insuficiente',
                            html: `No hay suficiente stock en las entradas para <strong>${product.title}</strong>.<br>` +
                                `Solicitado: ${product.quantity}, Cubierto: ${product.quantity - remainingQuantity}.`,
                            confirmButtonText: 'Entendido'
                        }).then(() => {
                            product.quantity = product.quantity - remainingQuantity;
                            this.cdr.detectChanges();
                        });
                    }

                    this.cdr.detectChanges();
                },
                error: (error) => {
                    this.handleError(error, 'Error al obtener entradas de producto');
                    product.quantity = 0;
                    product.usedEntries = [];
                    this.cdr.detectChanges();
                }
            });
        } else {
            // Modo single_invoice: mantener lógica existente
            if (product.usedEntries && product.usedEntries.length > 0) {
                product.usedEntries[0].quantity = product.quantity;
            } else {
                // Si no hay usedEntries, crear uno
                product.usedEntries = [{
                    entry_id: product.entry_id,
                    quantity: product.quantity,
                    invoice_number: product.invoice_number || 'N/A'
                }];
            }

            if (product.quantity > product.stock) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Cantidad Excede Stock',
                    html: `La cantidad ingresada (${product.quantity}) excede el stock disponible para <strong>${product.title}</strong>.<br>` +
                        `El stock disponible de la factura es <strong>${product.stock}</strong>.<br>` +
                        `Por favor, ajusta la cantidad.`,
                    confirmButtonText: 'Entendido'
                }).then(() => {
                    product.quantity = product.stock;
                    if (product.usedEntries && product.usedEntries.length > 0) {
                        product.usedEntries[0].quantity = product.quantity;
                    }
                    this.cdr.detectChanges();
                });
            }

            this.cdr.detectChanges();
        }
    }

    isSaveDisabled(): boolean {
    // Check basic conditions
    if (this.exitData.products.length === 0 || !this.exitData.subarea_id || this.productForm?.invalid) {
        return true;
    }

    // Check if any product quantity exceeds stock
    return this.exitData.products.some(product => product.quantity > product.stock);
}
}