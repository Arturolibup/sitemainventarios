import { Component, OnInit, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { ProductsService } from '../service/products.service';
import Swal from 'sweetalert2';
import { Router } from '@angular/router';

@Component({
  selector: 'app-create-product',
  templateUrl: './create-product.component.html',
  styleUrls: ['./create-product.component.scss']
})
export class CreateProductComponent implements OnInit {
  @ViewChild('imageInput', { static: false }) imageInput: ElementRef;
  unit_id: string = "";
  marca_id: string = "";
  tipo_id: string = "";
  modelo: number = 0;
  numeroeco: number = 0;
  cilindro: number = 0;
  placa: string = "";
  showAutomotrizFields: boolean = false; // Controla la visibilidad de los campos

  title: string = "";
  description: string = "";
  producto_imagen: any;
  price_general: string = "";
  sku: string = "";
  clave: string = "";

  umbral: string = "";
  umbral_unit_id: string = "";
  specifications: string = "";
  product_categorie_id: string = ""; //categoria del producto
  tiempo_de_entrega: number = 0;
  imagen_previzualiza: any = 'assets/media/svg/files/blank-image.svg';
  isLoading$: any;

  
  marcas: any[] = [];
  tipos: any[] = [];
  modelYears: number[] = [];
  
  unit_warehouse: string = "";
  categorie_warehouse: string = "";
  quantity_warehouse: number = 0;
  price_wallets: string = "";
  formattedQuantity: string = '0';
  
  WAREHOUSES_PRODUCT: any[] = [];
  CATEGORIES: any[] = [];
  UNITS: any[] = [];
  WAREHOUSES: any[] = [];
  
  constructor(
    public toast: ToastrService,
    public productService: ProductsService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {
  }
  
  ngOnInit(): void {
    this.isLoading$ = this.productService.isLoading$;
    
    
    this.loadOptions();
    this.generateModelYears();
    this.productService.configAll().subscribe((resp: any) => {
      console.log('Config response:', resp);
      this.CATEGORIES = resp.categories || [];
      this.UNITS = resp.units || [];
      this.onCategoriaChange();
      console.log("categoria cargada:", this.CATEGORIES);
    });
  }

  //simulamos cargas 
  isLoadingProcess() {
    this.productService.isLoadingSubject.next(true);
    setTimeout(() => {
      this.productService.isLoadingSubject.next(false);
    }, 5);
  }
  //gaurdar imagen
  processFile($event: any) {
    if ($event.target.files[0].type.indexOf("image") < 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'El archivo no es una imagen',
        confirmButtonText: 'Aceptar'
      });
      return;
    }
    this.producto_imagen = $event.target.files[0];
    let reader = new FileReader();
    reader.readAsDataURL(this.producto_imagen);
    reader.onloadend = () => {
      this.imagen_previzualiza = reader.result;
      this.isLoadingProcess ();
      this.cdr.detectChanges();
    };
  }

  onCategoriaChange() {
    const categoriaSeleccionada = this.CATEGORIES.find((categorie: any) => categorie.id == this.product_categorie_id);
    this.showAutomotrizFields = categoriaSeleccionada?.name === "REFACCIONES AUTOMOTRICES";
    if (!this.showAutomotrizFields) {
      this.marca_id = "";
      this.tipo_id = "";
      this.modelo = 0;
      this.numeroeco = 0;
      this.cilindro = 0;
      this.placa = "";
      this.tipos = [];
    } else {
      this.loadOptions(); // Asegurar que las marcas estén cargadas
    }
    this.cdr.detectChanges();
  }

  
  

  loadOptions() {
    this.productService.getProductOptions().subscribe(
      response => {
        console.log('Product options response:', response);
        this.marcas = response.marcas || [];
        this.isLoading$ = false;
        this.cdr.detectChanges();
      },
      error => {
        console.error('Error loading options:', error);
        this.isLoading$ = false;
        this.cdr.detectChanges();
      }
    );
  }

  generateModelYears() {
    const currentYear = new Date().getFullYear();
    this.modelYears = Array.from({ length: currentYear - 1959 }, (_, i) => 1960 + i);
  }

  onMarcaChange() {
    console.log('marca_id antes de conversión:', this.marca_id);
    if (this.marca_id) {
      const marcaIdNumber = Number(this.marca_id);
      console.log('marca_id convertido:', marcaIdNumber);
      const selectedMarca = this.marcas.find(marca => marca.id === marcaIdNumber);
      console.log('selectedMarca:', selectedMarca);
      this.tipos = selectedMarca ? selectedMarca.tipos : [];
      console.log('tipos asignados:', this.tipos);
      this.tipo_id = ''; // Resetear tipo al cambiar marca
      console.log('tipos después de asignación:', this.tipos); // Verificar antes de detectChanges
      this.cdr.detectChanges();
      console.log('tipos después de detectChanges:', this.tipos); // Verificar después
    } else {
      this.tipos = [];
      this.tipo_id = '';
      this.cdr.detectChanges();
    }
  }

  generateClave(title: string) {
    if (!title) return;
    let prefix = title.replace(/\s+/g, '').substring(0, 3).toUpperCase();
    let randomNum = Math.floor(10000 + Math.random() * 900);
    this.clave = `${prefix}${randomNum}`;
  }


  formatPrice() {
    if (!this.price_general) return;
    let numericValue = parseFloat(this.price_general.replace(/,/g, ''));
    if (isNaN(numericValue)) return;
    this.price_general = numericValue.toLocaleString('en-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
  }

  validateNumberInput(event: any) {
    let value = event.target.value.replace(/[^0-9.]/g, '');
    this.price_general = value;
  }

  
  validateQuantityInput(value: string) {
    let numericValue = value.replace(/[^0-9]/g, '');
    this.quantity_warehouse = numericValue ? parseInt(numericValue, 10) : 0;
    this.formattedQuantity = this.getFormattedQuantity(this.quantity_warehouse);
  }
  
  formatQuantity(event: any) {
    if (!this.quantity_warehouse && this.quantity_warehouse !== 0) return;
    let numericValue = parseInt(this.quantity_warehouse.toString().replace(/,/g, ''), 10);
    if (isNaN(numericValue)) return;
    this.quantity_warehouse = numericValue;
    this.formattedQuantity = this.getFormattedQuantity(this.quantity_warehouse);
  }
  
  getFormattedQuantity(value: number | undefined): string {
    if (value === undefined || value === null) return '0';
    return value.toLocaleString('en-MX', { minimumFractionDigits: 0 });
  }
  
  /*validateQuantityInput(event: any) {
    let value = event.target.value.replace(/[^0-9]/g, '');
    this.quantity_warehouse = value ? parseInt(value, 10) : 0;
  }
  /
  formatQuantity(event: any) {
    if (!this.quantity_warehouse) return;
    let numericValue = parseInt(this.quantity_warehouse.toString().replace(/,/g, ''), 10);
    if (isNaN(numericValue)) return;
    this.quantity_warehouse = numericValue;
    event.target.value = numericValue.toLocaleString('en-MX', { minimumFractionDigits: 0 });
  }*/

  store() {
    if (!this.title) {
      Swal.fire({
        icon: 'error',
        title: 'Validación',
        text: 'El campo título está vacío',
        confirmButtonText: 'Aceptar'
      });
      return;
    }
    if (!this.description) {
      Swal.fire({
        icon: 'error',
        title: 'Validación',
        text: 'El campo descripción está vacío',
        confirmButtonText: 'Aceptar'
      });
      return;
    }
    if (!this.price_general) {
      Swal.fire({
        icon: 'error',
        title: 'Validación',
        text: 'El campo precio está vacío',
        confirmButtonText: 'Aceptar'
      });
      return;
    }
    if (!this.quantity_warehouse) {
      Swal.fire({
        icon: 'error',
        title: 'Validación',
        text: 'El campo cantidad está vacío',
        confirmButtonText: 'Aceptar'
      });
      return;
    }
    if (!this.umbral) {
      Swal.fire({
        icon: 'error',
        title: 'Validación',
        text: 'El campo umbral está vacío',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    let numericPrice = parseFloat(this.price_general.replace(/,/g, ''));
    if (isNaN(numericPrice)) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'El precio ingresado no es válido',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    let UNIT_SELECTED = this.UNITS.find((unit: any) => unit.id == this.unit_warehouse);
    let CATEGORIE_SELECTED = this.CATEGORIES.find((categorie: any) => categorie.id == this.product_categorie_id);

    this.umbral_unit_id = UNIT_SELECTED ? UNIT_SELECTED.id : null;
    this.product_categorie_id = CATEGORIE_SELECTED ? CATEGORIE_SELECTED.id : null;

    if (!this.umbral_unit_id) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Unidad de umbral no válida',
        confirmButtonText: 'Aceptar'
      });
      return;
    }

    // Verificar si el producto ya existe por SKU y título
    this.productService.checkProductExists(this.sku, '').subscribe({
      next: (response) => {
        if (response.exists) {
          Swal.fire({
            icon: 'warning',
            title: 'Validación',
            text: `El producto con # ${this.sku} ya está registrado. Se actualizará el producto existente.`,
            confirmButtonText: 'Aceptar'
          });
        }

        this.WAREHOUSES_PRODUCT = [{
          unit: UNIT_SELECTED,
          warehouse: { id: "Central Aguamilpa", name: "Central Aguamilpa" }, // Almacén fijo
          quantity: this.quantity_warehouse,
          price_general: numericPrice,
        }];

        let formData = new FormData();
        formData.append("title", this.title);
        formData.append("product_categorie_id", this.product_categorie_id);
        formData.append("producto_imagen", this.producto_imagen);
        formData.append("sku", this.sku);
        formData.append("price_general", numericPrice.toString());
        formData.append("description", this.description);
        formData.append("specifications", this.specifications);
        formData.append("umbral", this.umbral);
        formData.append("umbral_unit_id", this.umbral_unit_id);
        formData.append("tiempo_de_entrega", this.tiempo_de_entrega.toString());
        formData.append("clave", this.clave);
        formData.append("marca_id", this.marca_id);
        formData.append("tipo_id", this.tipo_id);
        formData.append("modelo", this.modelo.toString());
        formData.append("numeroeco", this.numeroeco.toString());
        formData.append("placa", this.placa);
        formData.append("cilindro", this.cilindro + "");
        if (this.showAutomotrizFields) {
          formData.append("marca_id", this.marca_id);
          formData.append("tipo_id", this.tipo_id);
          formData.append("modelo", this.modelo.toString());
          formData.append("numeroeco", this.numeroeco.toString());
          formData.append("placa", this.placa);
          formData.append("cilindro", this.cilindro.toString());
        } else {
          formData.append("marca_id", "");
          formData.append("tipo_id", "");
          formData.append("modelo", "0");
          formData.append("numeroeco", "0");
          formData.append("placa", "");
          formData.append("cilindro", "0");
        }
        formData.append("WAREHOUSES_PRODUCT", JSON.stringify(this.WAREHOUSES_PRODUCT));

        this.productService.registerproduct(formData).subscribe({
          next: (resp: any) => {
            if (resp.message == 200) {
              Swal.fire({
                icon: 'success',
                title: 'Éxito',
                text: 'Producto registrado correctamente',
                showCancelButton: true,
                confirmButtonText: 'Ir a la lista',
                cancelButtonText: 'Registrar otro producto'
              }).then((result) => {
                if (result.isConfirmed) {
                  // Redirigir a la lista de productos
                  this.router.navigate(['/productos/list']);
                } else if (result.dismiss === Swal.DismissReason.cancel) {
                  // Limpiar el formulario para registrar otro producto
                  this.Limpiarform();
                  this.showAutomotrizFields = false;
                }
              });

              // Verificar bajo stock
              if (this.quantity_warehouse <= parseInt(this.umbral)) {
                this.toast.warning("El stock inicial es menor o igual al umbral)",
                  "Alerta de Bajo Stock"
                  );
              }
            } else {
              Swal.fire({
                icon: 'warning',
                title: 'Validación',
                text: resp.message_text || "Error desconocido",
                confirmButtonText: 'Aceptar'
              });
            }
          },
          error: (error) => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: error.message || 'Error al registrar el producto',
              confirmButtonText: 'Aceptar'
            });
          }
        });
      },
      error: (error) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Error al verificar el producto: ' + (error.message || 'Desconocido'),
          confirmButtonText: 'Aceptar'
        });
      }
    });
  }

  Limpiarform() {
    this.title = "";
    this.description = "";
    this.producto_imagen = null;
    this.price_general = "";
    this.sku = "";
    this.clave = "";
    this.umbral = "";
    this.umbral_unit_id = "";
    this.specifications = "";
    this.product_categorie_id = "";
    this.tiempo_de_entrega = 0;
    this.imagen_previzualiza = 'assets/media/svg/files/blank-image.svg';
    this.WAREHOUSES_PRODUCT = [];
    this.unit_warehouse = "";
    this.categorie_warehouse = "";
    this.quantity_warehouse = 0;
    this.marca_id = "";
    this.modelYears= [];
    this.tipos = [];
    this.marcas =[];
    this.tipo_id = "";
    this.numeroeco = 0;
    this.placa = "";
    this.modelo = 0;
    this.generateModelYears();
    this.cilindro = 0;
    if (this.imageInput) {
      this.imageInput.nativeElement.value = '';
    }
    this.cdr.detectChanges();
  }

  
}