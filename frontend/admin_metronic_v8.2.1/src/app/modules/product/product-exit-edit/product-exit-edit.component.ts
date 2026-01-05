import { Component, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ProductsService, SearchProduct, InvoiceSearchResponse, ProductByInvoiceResponse } from '../service/product.service';
import { ToastrService } from 'ngx-toastr';
import { debounceTime, distinctUntilChanged, Subject, switchMap, of } from 'rxjs';
import Swal from 'sweetalert2';
import { NgForm } from '@angular/forms';
import { AuthService } from '../../auth/services/auth.service';
import { UserModel } from '../../auth';

type UserType = { id: number; name: string };
type InvoiceMode = 'multiple_invoices' | 'single_invoice';

interface SearchSubarea {
    id: number;
    name: string;
    area: { id: number; name: string };
}

interface ExitProduct {
    product_id: number;
    title: string;
    quantity: number;
    original_quantity: number;
    stock: number;
    stock_global: number;
    warehouse: string;
    invoice_number?: string;
    entry_id: number;
    usedEntries?: { entry_id: number; quantity: number; invoice_number: string }[];
    unit: string;
}

@Component({
    selector: 'app-product-exit-edit',
    templateUrl: './product-exit-edit.component.html',
    styleUrls: ['./product-exit-edit.component.scss']
})
export class ProductExitEditComponent implements OnInit {
    @ViewChild('productForm') productForm!: NgForm;

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
        created_by?: number | UserType;
        exit_status?: string;
        pending_expires_at?: string;
        is_pending?: boolean;
        invoice_mode: InvoiceMode;
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
    isEdit = true;
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
        if (!this.exitId) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se proporcionó un ID de salida válido.'
            }).then(() => this.router.navigate(['/product-entries/product-exits/list']));
            return;
        }

        const now = new Date();
        const mazatlanOffset = -7 * 60 * 60 * 1000;
        const localDate = new Date(now.getTime() + mazatlanOffset);
        this.minDateTime = localDate.toISOString().slice(0, 16);

        this.service.getUser().subscribe({
            next: user => {
                this.exitData.created_by = user.id;
                this.exitData.delivered_by = `${user.name || ''} ${user.surname || ''}`.trim() || 'Usuario Sistema';
                this.cdr.detectChanges();
            },
            error: error => {
                this.exitData.delivered_by = 'Usuario Sistema';
                Swal.fire({
                    icon: 'error',
                    title: 'Error de autenticación',
                    text: 'No se pudo obtener la información del usuario. Por favor, inicia sesión nuevamente.'
                }).then(() => this.router.navigate(['/auth/login']));
            }
        });

        this.productSearchTerms.pipe(
            debounceTime(300),
            distinctUntilChanged(),
            switchMap(term => term.trim() ? this.service.searchExitProducts(term) : of([]))
        ).subscribe({
            next: response => {
                this.searchProductResults = response.products || [];
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
                this.cdr.detectChanges();
            },
            error: error => this.handleError(error, 'Error al buscar facturas')
        });

        this.loadExitData(this.exitId);
    }

    loadExitData(id: number) {
        this.isLoading = true;
        this.service.getExitById(id).subscribe({
            next: response => {
                console.log('Respuesta del backend:', response);
                const mazatlanOffset = -7 * 60 * 60 * 1000;
                let formattedDate = response.exit_date || '';
                if (formattedDate && !isNaN(new Date(formattedDate).getTime())) {
                    formattedDate = new Date(formattedDate).toISOString().split('T')[0];
                } else {
                    const today = new Date();
                    const todayMazatlan = new Date(today.getTime() + mazatlanOffset);
                    formattedDate = todayMazatlan.toISOString().split('T')[0];
                    console.warn('Fecha de salida no proporcionada, usando fecha actual:', formattedDate);
                }

                let pendingExpiresAt = response.pending_expires_at || '';
                if (pendingExpiresAt && !isNaN(new Date(pendingExpiresAt).getTime())) {
                    const date = new Date(pendingExpiresAt);
                    pendingExpiresAt = new Date(date.getTime() + mazatlanOffset).toISOString().slice(0, 16);
                } else if (response.exit_status === 'pending') {
                    const now = new Date();
                    const futureDate = new Date(now.getTime() + 10 * 60 * 1000);
                    pendingExpiresAt = futureDate.toISOString().slice(0, 16);
                    console.warn('Fecha de caducidad no proporcionada para estado "pending", usando valor por defecto:', pendingExpiresAt);
                }

                const products = response.products.map((p: any) => ({
                    product_id: p.product_id,
                    title: p.product?.title || 'Producto desconocido',
                    quantity: p.quantity,
                    original_quantity: p.quantity,
                    stock: p.stock || 0,
                    stock_global: p.stock_global || 0,
                    warehouse: p.warehouse || 'Central Aguamilpa',
                    invoice_number: p.invoice_number || 'N/A',
                    entry_id: p.entry_id,
                    unit: p.unit || 'pieza',
                    usedEntries: p.usedEntries || (p.entry_id ? [{
                        entry_id: p.entry_id,
                        quantity: p.quantity,
                        invoice_number: p.invoice_number || 'N/A'
                    }] : [])
                }));

                this.exitData = {
                    area_id: response.area?.id || response.area_id || null,
                    area_name: response.area?.name || '',
                    subarea_id: response.subarea?.id || response.subarea_id || null,
                    subarea_name: response.subarea?.name || '',
                    reference: response.reference || '',
                    exit_date: formattedDate,
                    received_by: response.received_by || '',
                    delivered_by: response.delivered_by || '',
                    authorized_by: response.authorized_by || '',
                    products: products,
                    created_by: response.created_by?.id || response.created_by,
                    exit_status: response.exit_status || 'completed',
                    pending_expires_at: pendingExpiresAt,
                    is_pending: response.exit_status === 'pending' && !!pendingExpiresAt,
                    invoice_mode: response.invoice_mode || 'multiple_invoices',
                    single_invoice_number: response.single_invoice_number || ''
                };

                if (this.exitData.invoice_mode === 'single_invoice' && !this.exitData.single_invoice_number && this.exitData.products.length > 0) {
                    this.exitData.single_invoice_number = this.exitData.products[0].invoice_number || '';
                }

                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: error => {
                this.handleError(error, 'Error al cargar la salida');
                this.isLoading = false;
            }
        });
    }

    logFormState(form: NgForm) {
        const controlDetails = Object.keys(form.controls).map(key => {
            const control = form.controls[key];
            return {
                name: key,
                value: control.value,
                valid: control.valid,
                invalid: control.invalid,
                errors: control.errors,
                touched: control.touched,
                dirty: control.dirty
            };
        });

        console.log('Estado del formulario:', {
            valid: form.valid,
            invalid: form.invalid,
            errors: form.errors,
            controls: controlDetails
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
                    original_quantity: 0,
                    stock: product.stock,
                    stock_global: product.stock_global,
                    warehouse: 'Central Aguamilpa',
                    invoice_number: product.invoice_number || 'N/A',
                    entry_id: product.entry_id,
                    unit: product.unit,
                    usedEntries: [{ entry_id: product.entry_id, quantity: 0, invoice_number: product.invoice_number || 'N/A' }]
                }));
                this.cdr.detectChanges();
            },
            error: (error: any) => this.handleError(error, 'Error al cargar productos de la factura')
        });
    }

    onQuantityChange(product: ExitProduct, index: number) {
        if (this.exitData.invoice_mode === 'multiple_invoices') {
            if (product.quantity > product.stock_global) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Cantidad Excede Stock',
                    html: `La cantidad ingresada (${product.quantity}) excede el stock total disponible para <strong>${product.title}</strong>.<br>` +
                          `El stock total disponible es <strong>${product.stock_global}</strong>.<br>` +
                          `Por favor, ajusta la cantidad para que no exceda el stock disponible.`,
                    confirmButtonText: 'Entendido'
                }).then(() => {
                    product.quantity = product.stock_global;
                    if (product.usedEntries && product.usedEntries.length > 0) {
                        product.usedEntries[0].quantity = product.quantity;
                    }
                    this.cdr.detectChanges();
                });
                return;
            }

            this.service.getProductEntries(product.product_id).subscribe({
                next: (response: { entries: { entry_id: number; invoice_number: string; available: number; created_at: string }[] }) => {
                    const entries = response.entries.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                    let remainingQuantity = product.quantity;
                    product.usedEntries = [];

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
            } else {
                if (product.usedEntries && product.usedEntries.length > 0) {
                    product.usedEntries[0].quantity = product.quantity;
                } else {
                    product.usedEntries = [{
                        entry_id: product.entry_id,
                        quantity: product.quantity,
                        invoice_number: product.invoice_number || 'N/A'
                    }];
                }
                this.cdr.detectChanges();
            }
        }
    }

    isSaveDisabled(): boolean {
        if (this.exitData.products.length === 0 || !this.exitData.subarea_id || this.productForm?.invalid) {
            return true;
        }
        return this.exitData.products.some(product => 
            this.exitData.invoice_mode === 'multiple_invoices' ? 
            product.quantity > product.stock_global : 
            product.quantity > product.stock
        );
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

        const newProduct = {
            product_id: product.product_id,
            title: product.title,
            quantity: 1,
            original_quantity: 1,
            stock: product.stock_global || 0,
            stock_global: product.stock_global || 0,
            warehouse: 'Central Aguamilpa',
            invoice_number: product.invoice_number || 'N/A',
            entry_id: product.entry_id,
            unit: product.unit,
            usedEntries: [{ entry_id: product.entry_id, quantity: 1, invoice_number: product.invoice_number || 'N/A' }]
        };

        this.exitData.products.push(newProduct);
        this.searchProductQuery = '';
        this.searchProductResults = [];
        this.onQuantityChange(newProduct, this.exitData.products.length - 1);
        this.cdr.detectChanges();
    }

    searchSubarea(query: string) {
        this.searchSubareaQuery = query;
        this.subareaSearchTerms.next(query);
    }

    selectSubarea(subarea: SearchSubarea) {
        this.exitData.subarea_id = subarea.id;
        this.exitData.subarea_name = subarea.name;
        this.exitData.area_id = subarea.area.id;
        this.exitData.area_name = subarea.area.name;
        this.searchSubareaQuery = '';
        this.searchSubareaResults = [];
        this.cdr.detectChanges();
    }

    removeProduct(index: number) {
        Swal.fire({
            title: '¿Eliminar producto?',
            text: `¿Estás seguro de que deseas eliminar el producto ${this.exitData.products[index].title}?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'No',
            customClass: {
                confirmButton: 'btn btn-danger',
                cancelButton: 'btn btn-light'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                this.exitData.products.splice(index, 1);
                this.cdr.detectChanges();
                this.toast.success('Producto eliminado correctamente');
            }
        });
    }

    onStatusChange() {
        this.exitData.is_pending = this.exitData.exit_status === 'pending';
        if (!this.exitData.is_pending) {
            this.exitData.pending_expires_at = '';
        }
        this.cdr.detectChanges();
    }

    onInvoiceModeChange() {
        if (this.exitData.products.length > 0) {
            Swal.fire({
                title: '¿Cambiar modo de factura?',
                text: 'Cambiar el modo de factura eliminará los productos actuales. ¿Deseas continuar?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, cambiar',
                cancelButtonText: 'No',
                customClass: {
                    confirmButton: 'btn btn-primary',
                    cancelButton: 'btn btn-light'
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    this.exitData.products = [];
                    this.exitData.single_invoice_number = '';
                    this.searchInvoiceQuery = '';
                    this.searchInvoiceResults = [];
                    this.cdr.detectChanges();
                }
            });
        } else {
            this.exitData.products = [];
            this.exitData.single_invoice_number = '';
            this.searchInvoiceQuery = '';
            this.searchInvoiceResults = [];
            this.cdr.detectChanges();
        }
    }

    validateData(): boolean {
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

            if (this.exitData.invoice_mode === 'single_invoice') {
                if (product.invoice_number !== this.exitData.single_invoice_number) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Factura inválida',
                        text: `Producto ${index + 1}: El producto pertenece a una factura (${product.invoice_number}) que no coincide con la factura seleccionada (${this.exitData.single_invoice_number})`,
                        confirmButtonText: 'Entendido'
                    });
                    return false;
                }
            }

            if (product.quantity < 1) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Cantidad inválida',
                    text: `Producto ${index + 1}: La cantidad debe ser mayor a 0`,
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
                if (product.quantity > product.stock) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Stock excedido',
                        text: `Producto ${index + 1}: La cantidad (${product.quantity}) excede el stock disponible (${product.stock})`,
                        confirmButtonText: 'Entendido'
                    });
                    return false;
                }
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

        if (this.exitData.invoice_mode === 'single_invoice') {
            const hasValidProduct = this.exitData.products.some(product => product.quantity > 0);
            if (!hasValidProduct) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Sin productos válidos',
                    text: 'En modo "Una Sola Factura", al menos un producto debe tener una cantidad mayor a 0',
                    confirmButtonText: 'Entendido'
                });
                return false;
            }
        }

        return true;
    }

    saveEx(form: NgForm) {
        this.logFormState(form);
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

        let createdById: number;
        if (this.exitData.created_by && typeof this.exitData.created_by === 'object') {
            createdById = (this.exitData.created_by as UserType).id;
        } else {
            createdById = this.exitData.created_by as number;
        }

        const data = {
            area_id: this.exitData.area_id,
            subarea_id: this.exitData.subarea_id,
            reference: this.exitData.reference.toUpperCase(),
            exit_date: this.exitData.exit_date,
            received_by: this.exitData.received_by || 'Nombre y Firma',
            delivered_by: this.exitData.delivered_by,
            authorized_by: this.exitData.authorized_by || 'Mtro. Eduardo Efrén Pacheco Andrade, Jefe de Recursos Materiales',
            created_by: createdById,
            exit_status: this.exitData.exit_status,
            pending_expires_at: this.exitData.exit_status === 'pending' ? this.exitData.pending_expires_at : null,
            invoice_mode: this.exitData.invoice_mode,
            single_invoice_number: this.exitData.invoice_mode === 'single_invoice' ? this.exitData.single_invoice_number : null,
            products: this.exitData.products
                .filter(product => product.quantity > 0)
                .map(product => ({
                    product_id: product.product_id,
                    quantity: product.quantity,
                    entry_id: product.entry_id,
                    warehouse: product.warehouse || 'Central Aguamilpa',
                    invoice_number: product.invoice_number || 'N/A',
                    usedEntries: this.exitData.invoice_mode === 'multiple_invoices' ? product.usedEntries : undefined
                }))
        };

        console.log('Datos enviados al backend:', JSON.stringify(data));
        this.isLoading = true;

        this.service.updateExit(this.exitId!, data).subscribe({
            next: (response) => {
                Swal.fire({
                    icon: 'success',
                    title: 'Salida actualizada',
                    text: `La salida con referencia ${this.exitData.reference} ha sido actualizada correctamente.`,
                    confirmButtonText: 'Aceptar'
                }).then(() => {
                    this.router.navigate(['/product-entries/product-exits/list']);
                });
                this.isLoading = false;
            },
            error: (error) => {
                Swal.fire({
                    icon: 'error',
                    title: 'Error al actualizar la salida',
                    text: error.message || 'Ocurrió un error inesperado. Por favor, intenta de nuevo.',
                    confirmButtonText: 'Entendido'
                });
                this.isLoading = false;
            }
        });
    }

    saveExit(form: NgForm) {
        this.logFormState(form);
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

        // Mostrar modal de confirmación con SweetAlert2
        const productSummary = this.exitData.products
            .filter(p => p.quantity > 0)
            .map(p => `<li><strong>${p.title}</strong>: ${p.quantity} ${p.unit} (Factura: ${this.exitData.invoice_mode === 'multiple_invoices' ? this.getUsedEntriesDisplay(p) : p.invoice_number || 'N/A'})</li>`)
            .join('');
        Swal.fire({
            title: 'Confirmar Actualización',
            html: `<p>Estás a punto de actualizar la salida <strong>${this.exitData.reference}</strong> con los siguientes productos:</p><ul>${productSummary || '<li>No hay productos con cantidad mayor a 0</li>'}</ul>`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, actualizar',
            cancelButtonText: 'Cancelar',
            customClass: {
                confirmButton: 'btn btn-primary',
                cancelButton: 'btn btn-light'
            }
        }).then(result => {
            if (result.isConfirmed) {
                this.proceedWithSave(form);
            }
        });
    }

    private proceedWithSave(form: NgForm) {
        let createdById: number;
        if (this.exitData.created_by && typeof this.exitData.created_by === 'object') {
            createdById = (this.exitData.created_by as UserType).id;
        } else {
            createdById = this.exitData.created_by as number;
        }

        const data = {
            area_id: this.exitData.area_id,
            subarea_id: this.exitData.subarea_id,
            reference: this.exitData.reference.toUpperCase(),
            exit_date: this.exitData.exit_date,
            received_by: this.exitData.received_by || 'Nombre y Firma',
            delivered_by: this.exitData.delivered_by,
            authorized_by: this.exitData.authorized_by || 'Mtro. Eduardo Efrén Pacheco Andrade, Jefe de Recursos Materiales',
            created_by: createdById,
            exit_status: this.exitData.exit_status,
            pending_expires_at: this.exitData.exit_status === 'pending' ? this.exitData.pending_expires_at : null,
            invoice_mode: this.exitData.invoice_mode,
            single_invoice_number: this.exitData.invoice_mode === 'single_invoice' ? this.exitData.single_invoice_number : null,
            products: this.exitData.products
                .filter(product => product.quantity > 0)
                .map(product => ({
                    product_id: product.product_id,
                    quantity: product.quantity,
                    entry_id: product.entry_id,
                    warehouse: product.warehouse || 'Central Aguamilpa',
                    invoice_number: product.invoice_number || 'N/A',
                    usedEntries: this.exitData.invoice_mode === 'multiple_invoices' ? product.usedEntries : undefined
                }))
        };

        console.log('Datos enviados al backend:', JSON.stringify(data));
        this.isLoading = true;

        this.service.updateExit(this.exitId!, data).subscribe({
            next: (response) => {
                // Verificar stock bajo después de guardar
                const productIds = data.products.map((p: any) => p.product_id);
                if (productIds.length > 0) {
                    this.service.checkLowStock(productIds).subscribe({
                        next: (lowStockProducts: any[]) => {
                            lowStockProducts.forEach(product => {
                                if (product.stock <= product.umbral) {
                                    this.toast.warning(
                                        `El producto ${product.title} tiene un stock bajo (${product.stock} unidades, umbral: ${product.umbral}).`,
                                        'Stock Bajo'
                                    );
                                }
                            });
                        },
                        error: (error) => {
                            console.error('Error al verificar stock bajo:', error);
                        }
                    });
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Salida actualizada',
                    text: `La salida con referencia ${this.exitData.reference} ha sido actualizada correctamente.`,
                    confirmButtonText: 'Aceptar'
                }).then(() => {
                    this.router.navigate(['/product-entries/product-exits/list']);
                });
                this.isLoading = false;
            },
            error: (error) => {
                Swal.fire({
                    icon: 'error',
                    title: 'Error al actualizar la salida',
                    text: error.message || 'Ocurrió un error inesperado. Por favor, intenta de nuevo.',
                    confirmButtonText: 'Entendido'
                });
                this.isLoading = false;
            }
        });
    }
    getUsedEntriesDisplay(product: ExitProduct): string {
        if (product.usedEntries && product.usedEntries.length > 0) {
            const entries = product.usedEntries
                .filter(entry => entry.quantity > 0)
                .map(entry => `${entry.invoice_number} (${entry.quantity})`)
                .join(', ');
            return entries || 'Sin entradas asignadas';
        }
        return 'Pendiente';
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
                this.router.navigate(['/product-entries/product-exits/list']);
            }
        });
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

    formatStock(value: number): string {
        return value.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    
}