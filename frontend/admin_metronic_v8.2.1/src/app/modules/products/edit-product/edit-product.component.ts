import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { ProductsService } from '../service/products.service';
import { ActivatedRoute, Router } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-edit-product',
  templateUrl: './edit-product.component.html',
  styleUrls: ['./edit-product.component.scss']
})
export class EditProductComponent implements OnInit {
  @ViewChild('imageInput', { static: false }) imageInput: ElementRef;


  //producto_imagen: any;
  //unit_warehouse: string = "";
  //categorie_warehouse: string = "";
  
  //price_wallets: string = "";
  product: any = { quantity_warehouse: 0 };
  formattedQuantity: string = '0';
  imagen_previzualiza: string = 'assets/media/svg/files/blank-image.svg';
  file_name: any;
  isLoading$: any;
  originalSku: string = ''; // ADDED: Store original SKU for validation

  CATEGORIES: any[] = [];
  UNITS: any[] = [];
  WAREHOUSES: any[] = [];

  PRODUCT_ID: string = '';
  //PRODUCT_SELECTED: any = null;
  marcas: any[] = [];
  tipos: any[] = [];
  modelYears: number[] = [];
  showAutomotrizFields: boolean = false;

  constructor(
    public toast: ToastrService,
    public productService: ProductsService,
    private cdr: ChangeDetectorRef,
    public activatedRoute: ActivatedRoute,
    public router: Router
  ) {}

  ngOnInit(): void {
    setTimeout(() => {
      const input = document.getElementById('priceGeneralInput') as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }, 300);
    
    this.isLoading$ = this.productService.isLoading$;
    this.activatedRoute.params.subscribe((resp: any) => {
      this.PRODUCT_ID = resp.id;
      this.loadOptions();
      this.loadProduct();
    });

    this.generateModelYears();

    this.productService.configAll().subscribe((resp: any) => {
      console.log('Config response:', resp);
      this.CATEGORIES = resp.categories || [];
      this.UNITS = resp.units || [];
    });
  }

  isLoadingProcess() {
    this.productService.isLoadingSubject.next(true);
    setTimeout(() => {
      this.productService.isLoadingSubject.next(false);
    }, 50);
  }

  loadProduct(): void {
    this.productService.showProduct(this.PRODUCT_ID).subscribe(
      (resp: any) => {
        //this.PRODUCT_SELECTED = resp;
        console.log('respuesta al listado de showproduct',resp);
        this.product = {

          id: resp.product.id,
          title: resp.product.title || '',
          description: resp.product.description || '',
          imagen: resp.product.imagen || '',
          price_general: resp.product.price_general || '0',
          sku: resp.product.sku || '',
          clave: resp.product.clave || '',
          umbral: resp.product.umbral || '0',
          umbral_unit_id: resp.product.umbral_unit?.id || '',
          specifications: resp.product.specifications || '',
          product_categorie_id: resp.product.product_categorie?.id || '',
          tiempo_de_entrega: resp.product.tiempo_de_entrega || 0,
          quantity_warehouse: resp.product.warehouses?.[0]?.quantity || 0,
          marca_id: resp.product.marca_id ? String(resp.product.marca_id) : '',
          tipo_id: resp.product.tipo_id ? String(resp.product.tipo_id) : '',
          modelo: resp.product.modelo || 0,
          numeroeco: resp.product.numeroeco || 0,
          placa: resp.product.placa || '',
          cilindro: resp.product.cilindro || 0,
          //unit_id: resp.product.unit_id = "",
          
          //unit_warehouse: resp.product.unit_warehouse = "",
          //categorie_warehouse: resp.product.categorie_warehouse = "",
          
          //price_wallets:resp.product.price_wallets = "",
          
        };

        this.originalSku = resp.product.sku ? resp.product.sku.trim().toUpperCase() : '';
        console.log('Loaded product SKU:', this.product.sku, 'Original SKU:', this.originalSku);

        this.formattedQuantity = this.getFormattedQuantity(this.product.quantity_warehouse);
        this.imagen_previzualiza = this.product.imagen || 'assets/media/svg/files/blank-image.svg';
        this.showAutomotrizFields = resp.product.product_categorie?.name === 'REFACCIONES AUTOMOTRICES';

        if (this.showAutomotrizFields && this.marcas.length === 0) {
          this.loadOptions();
        }
        this.cdr.detectChanges();
        
        if (this.product.marca_id) {
          this.onMarcaChange();
        } else {
          this.tipos = [];
        }

        this.formatPrice();
        this.cdr.detectChanges();
      },
      (error) => {
        console.error('Error loading product:', error);
        this.toast.error('No se pudo cargar el producto', 'Error');
      }
    );
  }

  onCategoriaChange() {
    const categoriaSeleccionada = this.CATEGORIES.find((categorie: any) => categorie.id === this.product.product_categorie_id);
    this.showAutomotrizFields = categoriaSeleccionada?.name === "REFACCIONES AUTOMOTRICES";
    if (!this.showAutomotrizFields) {
      this.product.marca_id = '';
      this.product.tipo_id = '';
      this.product.modelo = 0;
      this.product.numeroeco = 0;
      this.product.placa = '';
      this.product.cilindro = 0;
      this.tipos = [];
    } else if (this.marcas.length === 0) {
      this.loadOptions();
    }
    this.cdr.detectChanges();
  }

  processFile(event: any): void {
    if (event.target.files[0].type.indexOf('image') < 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'El archivo no es una imagen',
        confirmButtonText: 'Aceptar'
      });
      return;
    }
    this.file_name = event.target.files[0];
    let reader = new FileReader();
    reader.readAsDataURL(this.file_name);
    reader.onloadend = () => {
      this.imagen_previzualiza = reader.result as string;
      this.cdr.detectChanges();
    };
    this.isLoadingProcess();
  }

  removeImage(): void {
    this.imagen_previzualiza = 'assets/media/svg/files/blank-image.svg';
    this.file_name = null;
    this.product.imagen = null;
    this.cdr.detectChanges();
  }

  loadOptions() {
    this.productService.getProductOptions().subscribe(
      (response) => {
        this.marcas = response.marcas || [];
        this.cdr.detectChanges();
      },
      (error) => {
        console.error('Error loading options:', error);
        this.toast.error('No se pudieron cargar las opciones de marcas y tipos', 'Error');
      }
    );
  }

  onMarcaChange() {
    if (this.product.marca_id) {
      const marcaId = String(this.product.marca_id);
      const selectedMarca = this.marcas.find(marca => String(marca.id) === marcaId);
      this.tipos = selectedMarca?.tipos || [];
      if (!this.tipos.length && this.showAutomotrizFields) {
        this.toast.warning('No hay tipos disponibles para esta marca', 'Advertencia');
      }
    } else {
      this.tipos = [];
      this.product.tipo_id = '';
    }
    this.cdr.detectChanges();
  }

  generateModelYears() {
    const currentYear = new Date().getFullYear();
    this.modelYears = Array.from({ length: currentYear - 1959 }, (_, i) => 1960 + i);
  }

  generateClave(title: string) {
    if (!title) return;
    let prefix = title.replace(/\s+/g, '').substring(0, 3).toUpperCase();
    let randomNum = Math.floor(10000 + Math.random() * 900);
    this.product.clave = `${prefix}${randomNum}`;
  }

  formatPrice() {
    if (!this.product.price_general) return;
    let numericValue = parseFloat(this.product.price_general.toString().replace(/,/g, ''));
    if (isNaN(numericValue)) return;
    this.product.price_general = numericValue.toLocaleString('en-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    this.isLoadingProcess();
  }

  validateNumberInput(event: any) {
    let value = event.target.value.replace(/[^0-9.]/g, '');
    this.product.price_general = value;
  }

  validateQuantityInput(value: string) {
    let numericValue = value.replace(/[^0-9]/g, '');
    this.product.quantity_warehouse = numericValue ? parseInt(numericValue, 10) : 0;
    this.formattedQuantity = this.getFormattedQuantity(this.product.quantity_warehouse);
  }

  formatQuantity(event: any) {
    if (!this.product.quantity_warehouse && this.product.quantity_warehouse !== 0) return;
    let numericValue = parseInt(this.product.quantity_warehouse.toString().replace(/,/g, ''), 10);
    if (isNaN(numericValue)) return;
    this.product.quantity_warehouse = numericValue;
    this.formattedQuantity = this.getFormattedQuantity(this.product.quantity_warehouse);
  }

  getFormattedQuantity(value: number | undefined): string {
    if (value === undefined || value === null) return '0';
    return value.toLocaleString('en-MX', { minimumFractionDigits: 0 });
  }

  // MODIFIED: Aligned validation and SKU check with CreateProductComponent
  update(): void {
    if (!this.product.title) {
      Swal.fire({
        icon: 'error',
        title: 'Validación',
        text: 'El campo título está vacío',
        confirmButtonText: 'Aceptar'
      });
      return;
    }
    if (!this.product.description) {
      Swal.fire({
        icon: 'error',
        title: 'Validación',
        text: 'El campo descripción está vacío',
        confirmButtonText: 'Aceptar'
      });
      return;
    }
    if (!this.product.price_general) {
      Swal.fire({
        icon: 'error',
        title: 'Validación',
        text: 'El campo precio está vacío',
        confirmButtonText: 'Aceptar'
      });
      return;
    }
    if (!this.product.quantity_warehouse) {
      Swal.fire({
        icon: 'error',
        title: 'Validación',
        text: 'El campo cantidad está vacío',
        confirmButtonText: 'Aceptar'
      });
      return;
    }
    if (!this.product.umbral) {
      Swal.fire({
        icon: 'error',
        title: 'Validación',
        text: 'El campo umbral está vacío',
        confirmButtonText: 'Aceptar'
      });
      return;
    }
    if (!this.product.clave) {
      Swal.fire({
        icon: 'error',
        title: 'Validación',
        text: 'El campo clave está vacío',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    if (this.showAutomotrizFields) {
      if (!this.product.marca_id) {
        Swal.fire({
          icon: 'error',
          title: 'Validación',
          text: 'El campo marca está vacío',
          confirmButtonText: 'Aceptar'
        });
        return;
      }
      if (!this.product.tipo_id) {
        Swal.fire({
          icon: 'error',
          title: 'Validación',
          text: 'El campo tipo está vacío',
          confirmButtonText: 'Aceptar'
        });
        return;
      }
      if (!this.product.modelo) {
        Swal.fire({
          icon: 'error',
          title: 'Validación',
          text: 'El campo modelo está vacío',
          confirmButtonText: 'Aceptar'
        });
        return;
      }
      if (!this.product.numeroeco) {
        Swal.fire({
          icon: 'error',
          title: 'Validación',
          text: 'El campo número económico está vacío',
          confirmButtonText: 'Aceptar'
        });
        return;
      }
      if (!this.product.placa) {
        Swal.fire({
          icon: 'error',
          title: 'Validación',
          text: 'El campo placa está vacío',
          confirmButtonText: 'Aceptar'
        });
        return;
      }
      if (!this.product.cilindro) {
        Swal.fire({
          icon: 'error',
          title: 'Validación',
          text: 'El campo cilindraje está vacío',
          confirmButtonText: 'Aceptar'
        });
        return;
      }
    }

    let numericPrice: number;
    if (typeof this.product.price_general === 'string') {
      numericPrice = parseFloat(this.product.price_general.replace(/,/g, ''));
    } else if (typeof this.product.price_general === 'number') {
      numericPrice = this.product.price_general;
    } else {
      numericPrice = 0;
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'El precio ingresado no es válido',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    if (isNaN(numericPrice) || numericPrice < 0) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'El precio ingresado no es válido',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    // ADDED: Align unit and category selection with CreateProductComponent
    let UNIT_SELECTED = this.UNITS.find((unit: any) => unit.id == this.product.umbral_unit_id);
    let CATEGORIE_SELECTED = this.CATEGORIES.find((categorie: any) => categorie.id == this.product.product_categorie_id);

    this.product.umbral_unit_id = UNIT_SELECTED ? UNIT_SELECTED.id : null;
    this.product.product_categorie_id = CATEGORIE_SELECTED ? CATEGORIE_SELECTED.id : null;

    if (!this.product.umbral_unit_id) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Unidad de umbral no válida',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    // MODIFIED: Log SKU comparison for debugging
    console.log('Comparing SKUs:', {
      currentSku: this.product.sku.trim().toUpperCase(),
      originalSku: this.originalSku,
      isEqual: this.product.sku.trim().toUpperCase() === this.originalSku
    });

    // MODIFIED: Simplified SKU check to ensure unchanged SKUs skip validation
    if (this.product.sku.trim().toUpperCase() === this.originalSku) {
      this.proceedWithUpdate(numericPrice);
      return;
    }
    

    this.productService.checkProductExists(this.product.sku, '', this.product.id).subscribe({
      next: (response) => {
        if (response.exists) {
          Swal.fire({
            icon: 'error',
            title: 'Validación',
            text: `El SKU ${this.product.sku} ya está registrado en otro producto`,
            confirmButtonText: 'Aceptar'
          });
          return;
        }
        this.proceedWithUpdate(numericPrice);
      },
      error: (error) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al verificar el SKU: ' + (error.message || 'Desconocido'),
          confirmButtonText: 'Aceptar'
        });
      }
    });
  }

  // MODIFIED: Aligned FormData construction with CreateProductComponent
  proceedWithUpdate(numericPrice: number): void {
    // ADDED: Construct WAREHOUSES_PRODUCT similar to CreateProductComponent
    let UNIT_SELECTED = this.UNITS.find((unit: any) => unit.id == this.product.umbral_unit_id);
    const WAREHOUSES_PRODUCT = [{
      unit: UNIT_SELECTED,
      warehouse: { id: "Central Aguamilpa", name: "Central Aguamilpa" },
      quantity: this.product.quantity_warehouse,
      price_general: numericPrice,
    }];

    let formData = new FormData();
    formData.append('id', this.product.id);
    formData.append('title', this.product.title);
    formData.append('description', this.product.description);
    
    if (this.file_name) {
      formData.append('producto_imagen', this.file_name);
    }else if (!this.product.imagen) {
      formData.append('remove_image', '1');
    }
    formData.append('sku', this.product.sku || '');
    formData.append('price_general', numericPrice.toString());
    formData.append('specifications', this.product.specifications || '');
    formData.append('umbral', this.product.umbral || '0');
    formData.append('umbral_unit_id', this.product.umbral_unit_id);
    formData.append('tiempo_de_entrega', this.product.tiempo_de_entrega.toString());
    formData.append('clave', this.product.clave);
    formData.append('product_categorie_id', this.product.product_categorie_id);

    if (this.showAutomotrizFields){

    
    formData.append('marca_id', this.showAutomotrizFields && this.product.marca_id ? this.product.marca_id : '');
    formData.append('tipo_id', this.showAutomotrizFields && this.product.tipo_id ? this.product.tipo_id : '');
    formData.append('modelo', this.showAutomotrizFields ? this.product.modelo.toString() : '0');
    formData.append('numeroeco', this.showAutomotrizFields ? this.product.numeroeco.toString() : '0');
    formData.append('placa', this.showAutomotrizFields ? this.product.placa || '' : '');
    formData.append('cilindro', this.showAutomotrizFields ? this.product.cilindro.toString() : '0');
  }
    formData.append('quantity_warehouse', this.product.quantity_warehouse.toString());
    formData.append('WAREHOUSES_PRODUCT', JSON.stringify(WAREHOUSES_PRODUCT)); // ADDED: Include warehouse data

    // Log FormData for debugging
    for (let pair of (formData as any).entries()) {
      console.log(pair[0] + ': ' + pair[1]);
    }

    console.log('Datos enviados al backend:', {
      id: formData.get('id'),
      sku: formData.get('sku'),
      imagen: formData.get('producto_imagen') ? 'Present' : 'Not present',
      remove_image: formData.get('remove_image'),
      marca_id: formData.get('marca_id'),
      tipo_id: formData.get('tipo_id'),
      modelo: formData.get('modelo'),
      numeroeco: formData.get('numeroeco'),
      placa: formData.get('placa'),
      cilindro: formData.get('cilindro'),
      warehouses_product: formData.get('WAREHOUSES_PRODUCT')
    });

    this.productService.updateproduct(this.PRODUCT_ID, formData).subscribe({
      next: (resp: any) => {
        console.log('Update response:', resp);
        if (resp.message === 200) {
          Swal.fire({
            icon: 'success',
            title: 'Éxito',
            text: 'Producto actualizado correctamente',
            showCancelButton: true,
            confirmButtonText: 'Ir a la lista',
            cancelButtonText: 'Editar otro producto'
          }).then((result) => {
            if (result.isConfirmed) {
              this.router.navigate(['/productos/list'], { queryParams: { refresh: true } });
            } else if (result.dismiss === Swal.DismissReason.cancel) {
              this.router.navigate(['/productos/list'], { queryParams: { refresh: true } });
            }
          });

          if (this.product.quantity_warehouse <= parseInt(this.product.umbral)) {
            this.toast.warning(
              `El stock (${this.product.quantity_warehouse}) es menor o igual al umbral (${this.product.umbral})`,
              'Alerta de Bajo Stock'
            );
          }
        } else {
          Swal.fire({
            icon: 'warning',
            title: 'Validación',
            text: resp.message_text || 'Error desconocido',
            confirmButtonText: 'Aceptar'
          });
        }
      },
      error: (error) => {
        console.error('Error updating product:', error);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo actualizar el producto',
          confirmButtonText: 'Aceptar'
        });
      }
    });
  }

  actualizarProducto() {
    Swal.fire({
      title: '¿Estás seguro?',
      text: '¿Deseas actualizar este producto?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, actualizar',
      cancelButtonText: 'No, cancelar',
      buttonsStyling: true,
      customClass: {
        confirmButton: 'btn btn-primary',
        cancelButton: 'btn btn-light'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.update();
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/productos/list']);
  }
}