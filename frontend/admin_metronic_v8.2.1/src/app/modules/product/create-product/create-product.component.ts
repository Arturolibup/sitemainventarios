import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ProductsService } from '../service/product.service';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-create-product',
  templateUrl: './create-product.component.html',
  styleUrls: ['./create-product.component.scss']
})
export class CreateProductComponent implements OnInit {
  activeTab: string = 'general'; // Pestaña activa
  entryId: number | null = null; // ID de la entrada creada
  isLoading: boolean = true;

  // Datos Generales
    generalData: any = {
    provider_id: '', // ID del proveedor seleccionado
    providerSearch: '', // Campo de búsqueda temporal
    resource_origin: '',
    federal_program: '',
    invoice_number: '',
    order_number: '',
    process: '',
    entry_date: '',
    subtotal: '',
    iva: '',
    total: '',
    created_by: null, // Para auditoría: ID del usuario que crea
    entry_status: 'pending' // Para estadísticas: estado inicial (pending, completed)
  };
  
  providers: any[] = [];
  filteredProviders: any[] = [];
  productsSaved: boolean = false;


  invoiceExists: boolean = false;
  orderExists: boolean = false;

  
  

  // Productos
  products: any[] = [];
  filteredProducts: any[] = [];
  allProducts: any[] = []; // Para almacenar todos los productos cargados inicialmente
  productSearchQuery: string = '';
  selectedProduct: any = null;

  // Evidencias
  evidenceFiles: File[] = [];
  
  evidencePreviews: { file: File, url: string }[] = []; // Para vistas previas
  isLoading$: any;


  

  constructor(private service: ProductsService, 
    private router: Router, 
    private cdr: ChangeDetectorRef,
    public toast: ToastrService,) 
    {}

  ngOnInit() 
    {
    this.isLoading$ = this.service.isLoading$;
    this.loadInitialData();
    // Obtener usuario actual para auditoría
    this.service.getUser().subscribe(user => {
      this.generalData.created_by = user.id;
    });
     
    }
    
    isLoadingProcess() {
      this.service.isLoadingSubject.next(true);
      setTimeout(() => {
        this.service.isLoadingSubject.next(false);
      }, 5);
    }

  loadInitialData() {
    this.isLoading = true;
    this.service.getInitialData().subscribe(
      response => {
        this.providers = response.providers || [];
        this.allProducts = response.products || [];
        // Eliminamos la lógica de warehouses
        this.filteredProducts = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error => {
        console.error('Error al cargar datos iniciales:', error);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    );
  }

  setActiveTab(tab: string, event: Event) {
    event.preventDefault();
    if (this.canActivateTab(tab)) {
      this.activeTab = tab;
    } else {
      this.toast.warning(`Por favor, completa la pestaña ${this.activeTab} primero`);
    }
  }

  canActivateTab(tab: string): boolean {
    if (tab === 'products' && !this.entryId) return false;
    if (tab === 'evidences' && !this.productsSaved) return false;
    return true;
  }

  searchProviders(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    const query = inputElement.value.toLowerCase() || '';
    this.generalData.providerSearch = inputElement.value; // Mantener el valor actual
    this.filteredProviders = query ? this.providers.filter(provider =>
      provider.full_name.toLowerCase().includes(query)
    ) : [];
    this.cdr.detectChanges();
  }

  selectProviderFromList() {
    if (this.filteredProviders.length === 1) {
      this.selectProvider(this.filteredProviders[0]);
    }
  }

  selectProvider(provider: any) {
    this.generalData.provider_id = provider.id;
    this.generalData.providerSearch = provider.full_name; // Asignar el nombre del proveedor
    
    this.filteredProviders = []; // Limpiar la lista
    this.cdr.detectChanges(); // Forzar actualización de la vista
  }

  searchProducts(event: Event) {
    const query = (event.target as HTMLInputElement).value.toLowerCase() || '';
    this.productSearchQuery = (event.target as HTMLInputElement).value;
    if (query) {
      this.service.searchProducts(query).subscribe(
        (response: any) => {
          this.filteredProducts = response.map((product: any) => ({
            id: product.id,
            title: product.title,
            stock: product.stock || 0,
            partida: product.partida || 0
          }));
          this.cdr.detectChanges();
        },
        error => {
          this.toast.error('Error al buscar productos');
          this.filteredProducts = [];
          this.cdr.detectChanges();
        }
      );
    } else {
      this.filteredProducts = [];
      this.cdr.detectChanges();
    }
  }
  
  selectProductFromList() {
    if (this.filteredProducts.length === 1) {
      this.addSelectedProduct(this.filteredProducts[0]);
    }
  }
  
  addAnotherProduct() {
    // Propósito: Limpia la búsqueda y enfoca el input para agregar otro producto.
    this.productSearchQuery = '';
    this.filteredProducts = [];
    this.cdr.detectChanges(); // Forzamos la actualización del DOM

    // Usamos setTimeout para asegurar que el DOM esté listo
    setTimeout(() => {
        const searchInput = document.getElementById('product_search_input') as HTMLInputElement;
        if (searchInput) {
            searchInput.focus();
            const rect = searchInput.getBoundingClientRect();
            const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;
            if (!isVisible) {
                searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            console.error('Input de búsqueda no encontrado');
        }
    }, 0);
  }
  
  selectProduct(product: any) {
      this.addSelectedProduct(product);
      this.productSearchQuery = ''; // Limpiar el input después de agregar
      this.filteredProducts = [];
      this.cdr.detectChanges();

      // Devolver el foco al campo de búsqueda automáticamente
      const searchInput = document.getElementById('product_search_input') as HTMLInputElement;
      if (searchInput) {
          searchInput.focus();
      }
  }
  
  addSelectedProduct(product: any) {
    if (this.products.some(p => p.product.id === product.id)) {
      Swal.fire({
        icon: 'warning',
        title: 'Producto duplicado',
        text: 'Este producto ya ha sido agregado.',
        confirmButtonText: 'OK'
      });
      return;
    }
    this.products.push({
      product: product,
      quantity: 1,
      unit_price: '0.00',
      partida: 0,
      entry_id: this.entryId // Para rastreo en salidas
    });
    this.productSearchQuery = '';
    this.filteredProducts = [];
    this.cdr.detectChanges();
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: MouseEvent) {
    const inputElement = document.querySelector('input[name="product_search_query"]') as HTMLInputElement;
    if (inputElement && !inputElement.contains(event.target as Node)) {
      this.productSearchQuery = '';
      this.filteredProducts = [];
      this.cdr.detectChanges();
    }
  }

  removeProduct(index: number) {
    this.products.splice(index, 1);
    this.cdr.detectChanges();
  }
  
 

  onFileChange(event: any) {
    const files = event.target.files;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this.evidenceFiles.push(file);

      // Crear una URL de vista previa si es una imagen
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.evidencePreviews.push({
          file: file,
          url: e.target.result
        });
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

  removeEvidence(index: number) {
    this.evidenceFiles.splice(index, 1);
    this.evidencePreviews.splice(index, 1);
    this.cdr.detectChanges();
  }

  viewEvidence(evidenceId: number) {
    this.service.getEvidenceFile(evidenceId).subscribe(
      (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        window.open(url);
      },
      error => {
        console.error('Error al visualizar evidencia:', error);
        alert('No se pudo visualizar el archivo.');
      }
    );
  }

  // Validar entrada numérica para subtotal, iva, total
  validateNumberInput(event: any, field: string) {
    let value = event.target.value.replace(/[^0-9.]/g, '');
    this.generalData[field] = value === '' ? '' : value;
    this.cdr.detectChanges();
  }

  // Formatear con comas al perder foco
  formatCurrency(field: string) {
    if (!this.generalData[field] || this.generalData[field] === '') return;
    let numericValue = parseFloat(this.generalData[field].replace(/,/g, ''));
    if (isNaN(numericValue)) {
      this.generalData[field]= '';
    } else{

      this.generalData[field] = numericValue.toLocaleString('es-MX', 
        { minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        });
    }
    this.cdr.detectChanges();
  }

  validateNumberInputForProduct(index: number, event: any) {
    const inputElement = event.target as HTMLInputElement;
    if (!inputElement) return;
    let value = inputElement.value.replace(/[^0-9.]/g, '');
    this.products[index].unit_price = value === '' ? '' : value;
    this.cdr.detectChanges();
  }
  
  // Formatear con comas al perder foco para productos
  formatCurrencyForProduct(index: number) {
    if (!this.products[index].unit_price || this.products[index].unit_price === '') return;
    let numericValue = parseFloat(this.products[index].unit_price.toString().replace(/,/g, ''));
    if (isNaN(numericValue)) {
      this.products[index].unit_price = '';
    } else {
      this.products[index].unit_price = numericValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    this.cdr.detectChanges();
  }
  
  
  // Parsear valor numérico al guardar
  parseNumericValue(value: any): number {
    if (typeof value === 'string') {
      return parseFloat(value.replace(/,/g, '')) || 0;
    }
    return value || 0;
  }
  
  // Parsear cantidad
  parseQuantity(index: number, event: any) {
    const inputElement = event.target as HTMLInputElement;
    if (!inputElement) return;
    const rawValue = inputElement.value.replace(/[^0-9]/g, '');
    const numberValue = parseInt(rawValue, 10) || 1;
    this.products[index].quantity = numberValue < 1 ? 1 : numberValue;
    this.cdr.detectChanges();
  }
  // Parsear cantidad
  parsePartida(index: number, event: any) {
    const inputElement = event.target as HTMLInputElement;
    if (!inputElement) return;
    const rawValue = inputElement.value.replace(/[^0-9]/g, '');
    const numberValue = parseInt(rawValue, 10) || 1;
    this.products[index].partida = numberValue < 1 ? 1 : numberValue;
    this.cdr.detectChanges();
  }
  
  

  // Convertir strings a mayúsculas antes de guardar
  toUpperCaseStrings(data: any) {
    return {
      ...data,
      providerSearch: data.providerSearch ? data.providerSearch.toUpperCase() : '',
      resource_origin: data.resource_origin ? data.resource_origin.toUpperCase() : '',
      federal_program: data.federal_program ? data.federal_program.toUpperCase() : '',
      invoice_number: data.invoice_number ? data.invoice_number.toUpperCase() : '',
      order_number: data.order_number ? data.order_number.toUpperCase() : '',
      process: data.process ? data.process.toUpperCase() : '',
    };
  }

  // Validar campos obligatorios antes de guardar
  validateRequiredFields(data: any): boolean {
    const requiredFields = [
      'provider_id',
      'invoice_number',
      'order_number',
      'subtotal',
      'iva',
      'total'
    ];

    for (const field of requiredFields) {
      if (!data[field] || data[field] === '') {
        this.toast.info(`El campo ${field} es obligatorio.`);
        return false;
      }
    }

    const subtotal = this.parseNumericValue(data.subtotal);
    const iva = this.parseNumericValue(data.iva);
    const total = this.parseNumericValue(data.total);
    if (subtotal <= 0 || iva < 0 || total <= 0) {
      this.toast.info('Subtotal y Total deben ser mayores a 0, e IVA no puede ser negativo.');
      return false;
    }

    if (this.invoiceExists) {
      this.toast.info('El número de factura ya existe.');
      return false;
    }

    if (this.orderExists) {
        this.toast.info('El número de orden ya existe.');
        return false;
    }
      return true;
    }

    checkInvoiceNumber(event: any) {
      const invoiceNumber = event.target.value.trim();
      if (!invoiceNumber) {
        this.invoiceExists = false;
        this.cdr.detectChanges();
        return;
      }
      this.service.searchInvoices(invoiceNumber).subscribe({
        next: (response: any) => {
          this.invoiceExists = response.length > 0;
          if (this.invoiceExists) {
            this.toast.warning('El número de factura ya existe');
          }
          this.cdr.detectChanges();
        },
        error: () => {
          this.invoiceExists = false;
          this.cdr.detectChanges();
        }
      });
    }
  
    checkOrderNumber(event: any) {
      const orderNumber = event.target.value.trim();
      if (!orderNumber) {
        this.orderExists = false;
        this.cdr.detectChanges();
        return;
      }
      this.service.searchOrders(orderNumber).subscribe({
        next: (response: any) => {
          this.orderExists = response.length > 0;
          if (this.orderExists) {
            this.toast.warning('El número de orden ya existe');
          }
          this.cdr.detectChanges();
        },
        error: () => {
          this.orderExists = false;
          this.cdr.detectChanges();
        }
      });
    }

  saveGeneral() {
    console.log('Iniciando guardado de datos generales...');
    this.isLoading = true; //activar spinner desde el inicio

    const sanitizedData = this.toUpperCaseStrings(this.generalData);
    const parsedData = {
      ...sanitizedData,
      entry_date: this.generalData.entry_date,
      subtotal: this.parseNumericValue(sanitizedData.subtotal),
      iva: this.parseNumericValue(sanitizedData.iva),
      total: this.parseNumericValue(sanitizedData.total),
      created_by: this.generalData.created_by,
      entry_status: this.generalData.entry_status,
      partida:parseInt(sanitizedData.partida, 10)
      //invoice_number: this.generalData.invoice_number
    };
      
    
    
    //validar campos obligatorios
    if (!this.validateRequiredFields(parsedData)) {
      
      this.isLoading = false;
      return; // Salir sin hacer la petición
    }

    this.service.saveGeneral(parsedData).subscribe({
      next: (response: any) => {
        this.entryId = response.entry_id;
            if (!this.entryId) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'No se recibió el ID de la entrada. Contacta al administrador.'
                });
                this.isLoading = false; // Aseguramos que se desactive aquí
                return;
            }
            Swal.fire({
                icon: 'success',
                title: 'Datos guardados',
                text: 'Datos generales guardados correctamente.',
                timer: 1500,
                showConfirmButton: false
            }).then(() => {
                this.activeTab = 'products';
                this.isLoading = false; // Desactivamos isLoading tras éxito
                this.cdr.detectChanges();
            });
        },
        error: (error: any) => {
            const errorMessage = error.error?.message || 'Verifica los datos e intenta de nuevo';
            Swal.fire({
                icon: 'error',
                title: 'Error al guardar',
                text: errorMessage
            });
            this.isLoading = false; // Desactivamos isLoading en error
        },
        complete: () => {
            console.log('Guardado de datos generales completado');
            this.isLoading = false; // Aseguramos que se desactive al completar
        }
    });
  }
  
  saveProducts() {
    if (!this.entryId) {
      Swal.fire({
        icon: 'warning',
        title: 'Paso previo requerido',
        text: 'Por favor, guarda los datos generales primero.'
      });
      this.isLoading = false;
      return;
    }

    const productData = this.products.map(item => ({
      product_id: item.product.id,
      quantity: parseInt(item.quantity, 10),
      unit_price: this.parseNumericValue(item.unit_price),
      item_code: null,
      invoice_number:this.generalData.invoice_number,
      partida: item.partida,
      entry_id: this.entryId // Vincular productos a la entrada para salidas
    }));

    const invalidProducts = productData.filter(item =>
      item.quantity <= 0 || item.unit_price <= 0 || isNaN(item.quantity) || isNaN(item.unit_price)
    );
    if (invalidProducts.length > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Datos inválidos',
        text: 'Todos los productos deben tener una cantidad y un precio válidos.'
      });
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.service.saveProducts(this.entryId, { products: productData }).subscribe({
      next: () => {
        this.productsSaved = true;
        Swal.fire({
          icon: 'success',
          title: 'Productos guardados',
          text: 'Productos guardados correctamente.',
          timer: 1500,
          showConfirmButton: false
        }).then(() => {
          this.activeTab = 'evidences';
          this.isLoading = false;
          this.cdr.detectChanges();
        });
      },
      error: (error: any) => {
        const errorMessage = error.error?.message || 'Verifica los datos e intenta de nuevo';
        Swal.fire({
          icon: 'error',
          title: 'Error al guardar productos',
          text: errorMessage
        });
        this.isLoading = false;
      }
    });
  }
  
  saveEvidences() {
    if (!this.evidenceFiles.length) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin evidencias',
        text: 'Por favor, sube al menos una evidencia.'
      });
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    const formData = new FormData();
    this.evidenceFiles.forEach((file, index) => {
      formData.append(`evidences[${index}]`, file, file.name);
    });

    this.service.saveEvidences(this.entryId!, formData).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Entrada registrada',
          text: 'Entrada registrada correctamente. Generando PDF...',
          timer: 2000,
          showConfirmButton: false
        }).then(() => {
          this.generateEntryPdf();
        });
      },
      error: (error: any) => {
        Swal.fire({
          icon: 'error',
          title: 'Error al guardar evidencias',
          text: error.error?.message || 'Ocurrió un error al guardar las evidencias'
        });
        this.isLoading = false;
      }
    });
  }

  generateEntryPdf() {
    this.service.generateEntryPdf(this.entryId!).subscribe({
      next: (response: any) => {
        this.resetForm();
        Swal.fire({
          icon: 'success',
          title: 'PDF Generado',
          text: 'El PDF de la entrada ha sido generado y almacenado.',
          timer: 1500,
          showConfirmButton: false
        }).then(() => {
          this.router.navigate(['/product-entries/list']);
          this.isLoading = false;
        });
      },
      error: (error: any) => {
        Swal.fire({
          icon: 'error',
          title: 'Error al generar PDF',
          text: 'No se pudo generar el PDF de la entrada.'
        });
        this.isLoading = false;
      }
    });
  }
   
  
  continueToEvidences() {
    this.activeTab = 'evidences'; // Cambiar a la pestaña Evidencias
  }
 



  cancel() {
    Swal.fire({
      title: '¿Estás seguro?',
      text: 'Los datos no guardados se perderán y se eliminarán del sistema.',
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
        if (this.entryId) {
          this.isLoading = true;
          this.service.deleteEntry(this.entryId).subscribe({
            next: () => {
              this.toast.success('Operación cancelada. Datos eliminados.');
              this.resetForm();
              this.router.navigate(['/product-entries/list']);
            },
            error: () => {
              this.toast.error('Error al cancelar la operación');
              this.isLoading = false;
            },
            complete: () => {
              this.isLoading = false;
            }
          });
        } else {
          this.resetForm();
          this.router.navigate(['/product-entries/list']);
        }
      }
    });
  }

// Método para reiniciar el formulario
resetForm() {
    // Reiniciar variables de estado
    this.entryId = null;
    this.productsSaved = false;
    this.activeTab = 'general';

    // Limpiar evidencias
    this.evidenceFiles = [];
    this.evidencePreviews = [];

    // Limpiar productos
    this.products = [];
    this.productSearchQuery = '';
    this.filteredProducts = [];

    // Reiniciar datos generales
    this.generalData = {
        provider_id: '',
        providerSearch: '',
        resource_origin: '',
        federal_program: '',
        invoice_number: '',
        order_number: '',
        process: '',
        entry_date: '',
        subtotal: '',
        iva: '',
        total: '',
        created_by: this.generalData.created_by,
        entry_status: 'pending'
    };

    // Forzar detección de cambios
    this.cdr.detectChanges();

    console.log('Formulario reiniciado');
}

// Otros métodos como saveGeneral, saveProducts, saveEvidences...
}