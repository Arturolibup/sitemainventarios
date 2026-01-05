import { Component } from '@angular/core';
import { ChangeDetectorRef, HostListener, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ProductsService } from '../service/product.service';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-edit-product',
  templateUrl: './edit-product.component.html',
  styleUrls: ['./edit-product.component.scss']
})
export class EditProductComponent implements OnInit {
    activeTab: string = 'general';
    entryId: number | null = null;
    isLoading: boolean = true;
  
    // Datos Generales
    generalData: any = {
    provider_id: '',
    providerSearch: '',
    resource_origin: '',
    federal_program: '',
    invoice_number: '',
    order_number: '',
    process: '',
    partida: null,
    entry_date: '',
    subtotal: '',
    iva: '',
    total: '',
    updated_by: null,
    entry_status: 'pending'
  };
  
  providers: any[] = [];
  filteredProviders: any[] = [];
  productsSaved: boolean = false;
  invoiceExists: boolean = false;
  orderExists: boolean = false;
  
    // Productos
    products: any[] = [];
    filteredProducts: any[] = [];
    allProducts: any[] = [];
    productSearchQuery: string = '';
    selectedProduct: any = null;
  
    // Evidencias
    evidenceFiles: File[] = [];
    evidencePreviews: { file: File, url: string }[] = [];
    existingEvidences: any[] = [];
    isLoading$: any;
  
    constructor(
      private service: ProductsService,
      private router: Router,
      private route: ActivatedRoute,
      private cdr: ChangeDetectorRef,
      public toast: ToastrService
    ) {}
  
    ngOnInit() {
      // Propósito: Inicializa el componente cargando datos iniciales y de la entrada.
      this.isLoading$ = this.service.isLoading$;
      this.entryId = +this.route.snapshot.paramMap.get('id')!;
      this.loadInitialData();
      this.loadEntryData();
      // Modificación: Obtener usuario actual para auditoría
      this.service.getUser().subscribe(user => {
          this.generalData.updated_by = user.id; // Auditoría: usuario que edita
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

          const entryDate = response.entry_date ? new Date(response.entry_date) : new Date();
          const mazatlanOffset = -7 * 60; // UTC-7 en minutos
          const localDate = new Date(entryDate.getTime() + (mazatlanOffset * 60 * 1000));
          const formattedDate = localDate.toISOString().split('T')[0];

          this.providers = response.providers || [];
          this.allProducts = response.products || [];
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
  
    loadEntryData() {
      // Propósito: Carga los datos de una entrada específica para edición.
      if (!this.entryId) {
          Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'No se proporcionó un ID de entrada válido.'
          }).then(() => this.router.navigate(['/product-entries/list']));
          return;
      }
      

      this.isLoading = true;
      this.service.getEntryById(this.entryId).subscribe(
          (response: any) => {
              // Modificación: Incluir entry_status y auditoría
              this.generalData = {
                  provider_id: response.provider_id,
                  providerSearch: response.provider?.full_name || '',
                  resource_origin: response.resource_origin || '',
                  federal_program: response.federal_program || '',
                  invoice_number: response.invoice_number || '',
                  order_number: response.order_number || '',
                  process: response.process || '',
                  partida: response.partida || null,
                  entry_date: response.entry_date || '',
                  subtotal: response.subtotal ? response.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
                  iva: response.iva ? response.iva.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
                  total: response.total ? response.total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '',
                  created_by: response.created_by, // Auditoría
                  updated_by: this.generalData.updated_by, // Auditoría
                  entry_status: response.entry_status // Estadísticas
              };
  
              this.products = response.products.map((item: any) => ({
                  product: {
                      id: item.product_id,
                      title: item.product?.title || 'Producto desconocido',
                      stock: item.product?.stock || 0
                  },
                  quantity: item.quantity,
                  unit_price: item.unit_price ? item.unit_price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00',
                  partida: item.partida || null,
                  item_code: item.item_code || null
              }));
              this.productsSaved = this.products.length > 0;
              this.existingEvidences = response.evidences || [];
              this.isLoading = false;
              this.cdr.detectChanges();
          },
          error => {
              Swal.fire({
                  icon: 'error',
                  title: 'Error',
                  text: 'Error al cargar los datos de la entrada.'
              }).then(() => this.router.navigate(['/product-entries/list']));
              this.isLoading = false;
          }
      );
  }

    setActiveTab(tab: string, event: Event) {
      event.preventDefault();
      this.activeTab = tab;
    }
  
    searchProviders(event: Event) {
      const inputElement = event.target as HTMLInputElement;
      const query = inputElement.value.toLowerCase() || '';
      this.generalData.providerSearch = inputElement.value;
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
      this.generalData.providerSearch = provider.full_name;
      this.filteredProviders = [];
      this.cdr.detectChanges();
    }
  
    searchProducts(event: Event) {
      const inputElement = event.target as HTMLInputElement;
      const query = inputElement.value.toLowerCase() || '';
      this.productSearchQuery = inputElement.value;
  
      if (query) {
        this.service.searchProducts(query).subscribe(
          (response: any) => {
            this.filteredProducts = response.map((product: any) => ({
              id: product.id,
              title: product.title,
              stock: product.stock || 0,
              partida: product.partida || null
            }));
            this.cdr.detectChanges();
          },
          (error) => {
            console.error('Error al buscar productos:', error);
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
  
    selectProduct(product: any) {
      this.addSelectedProduct(product);
      this.productSearchQuery = '';
      this.filteredProducts = [];
      this.cdr.detectChanges();
    }
  
    addSelectedProduct(product: any) {
      const exists = this.products.some(p => p.product.id === product.id);
      if (!exists) {
        this.products.push({
          product: product,
          quantity: 1,
          unit_price: '0.00',
          partida: product.partida || null,
          item_code: null
        });
      } else {
        this.toast.warning('Este producto ya ha sido agregado.');
      }
      this.productSearchQuery = '';
      this.filteredProducts = [];
      this.cdr.detectChanges();
    }
  
    addSelectedProductButton() {
      if (this.filteredProducts.length === 1) {
        this.addSelectedProduct(this.filteredProducts[0]);
        this.productSearchQuery = '';
        this.filteredProducts = [];
        this.cdr.detectChanges();
      } else if (this.productSearchQuery && this.filteredProducts.length > 0) {
        this.addSelectedProduct(this.filteredProducts[0]);
        this.productSearchQuery = '';
        this.filteredProducts = [];
        this.cdr.detectChanges();
      }
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
          this.toast.error('No se pudo visualizar el archivo.');
        }
      );
    }
  
    deleteEvidence(evidenceId: number, index: number) {
    Swal.fire({
      title: '¿Estás seguro?',
      text: '¿Deseas eliminar esta evidencia?',
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
        this.service.deleteEvidence(evidenceId).subscribe({
          next: () => {
            this.existingEvidences.splice(index, 1);
            Swal.fire({
              icon: 'success',
              title: 'Eliminada',
              text: 'Evidencia eliminada correctamente.',
              timer: 1500,
              showConfirmButton: false
            });
            this.cdr.detectChanges();
            this.router.navigate(['/product-entries/list']);
          },
          error: (error) => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Error al eliminar la evidencia.'
            });
          }
        });
      }
    });
  }
          
  
    validateNumberInput(event: any, field: string) {
      let value = event.target.value.replace(/[^0-9.]/g, '');
      this.generalData[field] = value === '' ? '' : value;
      this.cdr.detectChanges();
    }
  
    formatCurrency(field: string) {
      if (!this.generalData[field] || this.generalData[field] === '') return;
      let numericValue = parseFloat(this.generalData[field].replace(/,/g, ''));
      if (isNaN(numericValue)) {
        this.generalData[field] = '';
      } else {
        this.generalData[field] = numericValue.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  
    parseNumericValue(value: any): number {
      if (typeof value === 'string') {
        return parseFloat(value.replace(/,/g, '')) || 0;
      }
      return value || 0;
    }
  
    parseQuantity(index: number, event: any) {
      const inputElement = event.target as HTMLInputElement;
      if (!inputElement) return;
      const rawValue = inputElement.value.replace(/[^0-9]/g, '');
      const numberValue = parseInt(rawValue, 10) || 1;
      this.products[index].quantity = numberValue < 1 ? 1 : numberValue;
      this.cdr.detectChanges();
    }
  
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
  
      return true;
    }
  
    /*
    updateGeneral() {
    // Propósito: Actualiza los datos generales de la entrada.
    this.isLoading = true;
    const sanitizedData = this.toUpperCaseStrings(this.generalData);
    const parsedData = {
        ...sanitizedData,
        provider_id: sanitizedData.provider_id,
        entry_date: this.generalData.entry_date,
        subtotal: this.parseNumericValue(sanitizedData.subtotal),
        iva: this.parseNumericValue(sanitizedData.iva),
        total: this.parseNumericValue(sanitizedData.total),
        partida: sanitizedData.partida ? parseInt(sanitizedData.partida, 10) : null,
        updated_by: this.generalData.updated_by, // Auditoría
        entry_status: this.generalData.entry_status // Estadísticas
    };

    if (!this.validateRequiredFields(parsedData)) {
        this.isLoading = false;
        return;
    }
    console.log('Enviando datos para actualizar:', parsedData);
    this.service.updateEntry(this.entryId!, parsedData).subscribe({
        next: () => {
            Swal.fire({
                icon: 'success',
                title: 'Datos actualizados',
                text: 'Datos generales actualizados correctamente.',
                timer: 1500,
                showConfirmButton: false
            }).then(() => {
                this.activeTab = 'products';
                this.isLoading = false;
                this.router.navigate(['/product-entries/list']);
            });
        },
        error: (error: any) => {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.error?.message || 'Error al actualizar los datos generales'
            });
            this.isLoading = false;
            this.router.navigate(['/product-entries/list']);
        }
    });
}
  
updateProducts() {
  // Propósito: Actualiza los productos de la entrada.
  if (!this.entryId) {
      Swal.fire({
          icon: 'warning',
          title: 'Error',
          text: 'No se encontró el ID de la entrada.'
      });
      this.isLoading = false;
      return;
  }

  const productData = this.products.map(item => ({
      product_id: item.product.id,
      quantity: parseInt(item.quantity, 10),
      unit_price: this.parseNumericValue(item.unit_price),
      item_code: null,
      partida: item.partida || null,// Rastreo granular
      invoice_number: this.generalData.invoice_number
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
  this.service.updateProducts(this.entryId, { products: productData }).subscribe({
      next: () => {
          this.productsSaved = true;
          Swal.fire({
              icon: 'success',
              title: 'Productos actualizados',
              text: 'Productos actualizados correctamente.',
              timer: 1500,
              showConfirmButton: false
          }).then(() => {
              this.activeTab = 'evidences';
              this.isLoading = false;
              this.router.navigate(['/product-entries/list']);
          });
      },
      error: (error: any) => {
          Swal.fire({
              icon: 'error',
              title: 'Error',
              text: error.error?.message || 'Error al actualizar los productos'
          });
          this.isLoading = false;
          this.router.navigate(['/product-entries/list']);
      }
  });
}
  
   

updateEvidences() {
  // Propósito: Actualiza las evidencias de la entrada.
  this.isLoading = true;
  const formData = new FormData();
  this.evidenceFiles.forEach((file, index) => {
      formData.append(`evidences[${index}]`, file);
  });

  this.service.updateEvidences(this.entryId || 1, formData).subscribe({
      next: () => {
          Swal.fire({
              icon: 'success',
              title: 'Evidencias actualizadas',
              text: 'Entrada actualizada correctamente.',
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
              title: 'Error',
              text: error.error?.message || 'Error al actualizar las evidencias'
          });
          this.isLoading = false;
      }
  });
}
  */
 updateGeneral() {
    this.isLoading = true;
    const sanitizedData = this.toUpperCaseStrings(this.generalData);
    const parsedData = {
      ...sanitizedData,
      provider_id: sanitizedData.provider_id,
      entry_date: sanitizedData.entry_date,
      subtotal: this.parseNumericValue(sanitizedData.subtotal),
      iva: this.parseNumericValue(sanitizedData.iva),
      total: this.parseNumericValue(sanitizedData.total),
      partida: sanitizedData.partida ? parseInt(sanitizedData.partida, 10) : null,
      updated_by: this.generalData.updated_by,
      entry_status: sanitizedData.entry_status || 'pending'
    };

    if (!this.validateRequiredFields(parsedData)) {
      this.isLoading = false;
      return;
    }

    console.log('Enviando datos para actualizar:', parsedData);

    this.service.updateEntry(this.entryId!, parsedData).subscribe({
      next: () => {
        // Generate new PDF after updating general data
        this.generateEntryPdf();
        this.loadEntryData();
      },
      error: (error: any) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.error?.message || 'Error al actualizar los datos generales'
        });
        this.isLoading = false;
      }
    });
  }

  updateProducts() {
    if (!this.entryId) {
      Swal.fire({
        icon: 'warning',
        title: 'Error',
        text: 'No se encontró el ID de la entrada.'
      });
      this.isLoading = false;
      this.router.navigate(['/product-entries/list']);
      return;
    }

    const productData = this.products.map(item => ({
      product_id: item.product.id,
      quantity: parseInt(item.quantity, 10),
      unit_price: this.parseNumericValue(item.unit_price),
      item_code: item.item_code || null,
      partida: item.partida || null,
      invoice_number: this.generalData.invoice_number
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
    this.service.updateProducts(this.entryId, { products: productData }).subscribe({
      next: () => {
        this.productsSaved = true;
        // Generate new PDF after updating products
        this.generateEntryPdf();
        this.loadEntryData();
      },
      error: (error: any) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.error?.message || 'Error al actualizar los productos'
        });
        this.isLoading = false;
        this.router.navigate(['/product-entries/list']);
      }
    });
  }

  updateEvidences() {
    this.isLoading = true;
    const formData = new FormData();
    this.evidenceFiles.forEach((file, index) => {
      formData.append(`evidences[${index}]`, file);
    });

    this.service.updateEvidences(this.entryId!, formData).subscribe({
      next: () => {
        // Generate new PDF after updating evidences
        this.generateEntryPdf(true); // Navigate to list after evidences
      },
      error: (error: any) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.error?.message || 'Error al actualizar las evidencias'
        });
        this.isLoading = false;
      }
    });
  }

  generateEntryPdf(navigateToList: boolean = false) {
    this.isLoading = true;
    this.service.generateEntryPdf(this.entryId!).subscribe({
      next: (response: any) => {
        Swal.fire({
          icon: 'success',
          title: 'PDF Actualizado',
          text: 'El PDF de la entrada ha sido actualizado correctamente.',
          timer: 1500,
          showConfirmButton: false
        }).then(() => {
          if (navigateToList) {
            this.router.navigate(['/product-entries/list']);
          } else {
            this.activeTab = navigateToList ? 'evidences' : this.activeTab;
            this.isLoading = false;
            this.cdr.detectChanges();
          }
        });
      },
      error: (error: any) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: error.error?.message || 'No se pudo generar el PDF de la entrada.'
        });
        this.isLoading = false;
        this.router.navigate(['/product-entries/list']);
      }
    });
  }
cancel() {
  // Propósito: Cancela la edición y redirige a la lista.
  Swal.fire({
      title: '¿Estás seguro?',
      text: 'Los cambios no guardados se perderán.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, Regresar',
      cancelButtonText: 'No',
      customClass: {
          confirmButton: 'btn btn-primary',
          cancelButton: 'btn btn-light'
      }
  }).then((result) => {
      if (result.isConfirmed) {
          this.router.navigate(['/product-entries/list']);
      }
  });
}


  
logDateChange(event: Event) {
  const input = event.target as HTMLInputElement;
  console.log('Fecha seleccionada en el input:', input.value);
}

}
