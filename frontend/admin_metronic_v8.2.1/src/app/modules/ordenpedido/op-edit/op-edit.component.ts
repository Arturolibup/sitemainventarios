import { Component, OnInit, OnDestroy, AfterViewInit, numberAttribute, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormArray, AbstractControl, ValidatorFn, ValidationErrors,FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../auth/services/auth.service';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable, of, Subject, retry, Subscription, forkJoin, BehaviorSubject } from 'rxjs';
import { debounceTime, switchMap, catchError, map, takeUntil, distinctUntilChanged, take } from 'rxjs/operators';
import { OpserviceService } from '../service/opservice.service';
import { Decimal } from 'decimal.js';
import Swal from 'sweetalert2';
import { OrderProduct } from '../../../models/interfaces';
import { ProductsService } from '../../products/service/products.service';
import { ThisReceiver } from '@angular/compiler';
import { URL_SERVICIOS } from 'src/app/config/config';

// Interfaz para authData
interface AuthData {
  firstname?: string;
  lastname?: string;
}



@Component({
  selector: 'app-op-edit',
  templateUrl: './op-edit.component.html',
  styleUrls: ['./op-edit.component.scss']
})
export class OpEditComponent implements OnInit, OnDestroy {

  
  @ViewChild('productSearchInput') productSearchInput!: ElementRef;
  
    canaddProduct = true;
    
    isFoliosfValid = true;
    isOrderNumberValid = true;
    //isValidationMode = false; // Indica si está en modo validación final (Área 1, segunda vuelta)
    private foliosfSubject = new Subject<string>();
    private orderNumberSubject = new Subject<string>();
  
    orderForm: FormGroup;
    
    newProductForm: FormGroup;
    mode: string = 'create_sf';
    orderId: number | null = null;
    id:number | null= null;
    user: any;
    providers: any[] = [];
    areas: any[] = [];
    subareas: any[] = [];
    units: any[] = [];
    products: any[] = [];
    marcas: any[] = [];
    tipos: {[key:string]: any[]}={};
    years: number[] = [];
    productCategories: any[] = [];
    orderProducts: OrderProduct[] = [];
    isGlobalLoading = false;
    isLoading = false;
    notifications: any[] = [];
    vehicles: any[] = [];
    currentUser: any; // Almacenar usuario actual
    private userSub: Subscription;// atraer usuario
    private destroy$ = new Subject<void>();
    pdfUrl: string | null = null; // **AÑADIDO**: Variable para almacenar la URL del PDF generado
  
    isUnitPriceFocused: boolean[] = [];
    unitPriceRaw: string[] = [];
  
    //vehículos
    showVehiculoModal: number | null = null;
    vehiculoSearchQuery: string = '';
    filteredVehiculos: any[] = [];
    allVehiculos: any[] = [];
    private vehiculosSearchSubjetc = new BehaviorSubject<string>('');
  
  
    //subareas
    showSubareaModal = false;
    subareaSearchQuery: string = '';
    filteredSubareas: any[] = [];
    allSubareas: any[] = [];
    private subareaSearchSubject = new Subject<string>();
    private subareaSearchSub?:Subscription;
    private subareaSelectionInProgress=false;
    subareaPage = 1;
  
    //proveedores
    showProviderModal = false;
    providerSearchQuery: string = '';
    filteredProviders: any[] = [];
    allProviders: any[] = [];
    private providerSearchSubject = new BehaviorSubject<string>('');
    private providerSearchSub?:Subscription;
    private providerSelectionInProgress = false;
    providerPage = 1;
    
  //para creacion de productos
    showCreateProductModal:boolean=false;
    showProductModal: number | null = null;
    
  
  
    productSearchQueries: string[] = [];
    filteredProducts: any[][] = [];
    allProducts: any[][] = [];
    productPages: number[] = [];
    showAddProductForm = false;
    productCreatedMessage: string = '';
    private productSearchSubject = new Subject<{ query: string, index: number }>();
  
  
    itemsPerPage = 10;
  
    isAutoCalculation = true;
    showAutomotrizFields = false;
  
    financialDisplays: { [key: string]: string } = {
      concept_total: '0.00',
      iva: '0.00',
      isr_retention: '0.00',
      total: '0.00'
    };
    ivaEditing: string = '';       // texto libre que ve el usuario mientras escribe IVA
    isrEditing: string = '';       // texto libre que ve el usuario mientras escribe ISR
    isIvaFocused: boolean = false; // true mientras el usuario está escribiendo IVA
    isIsrFocused: boolean = false; // true mientras el usuario está escribiendo ISR
  
    formatTypes = [
      { value: 'FERRETERIA', label: 'Ferretería' },
      { value: 'REFACCIONES', label: 'Refacciones' },
      { value: 'PRODUCTOS', label: 'Productos' }
    ];
  
    constructor(
      private fb: FormBuilder,
      private authService: AuthService,
      public auth: AuthService,
      private orderService: OpserviceService,
      private router: Router,
      private route: ActivatedRoute,
      private productService:ProductsService,
      private cdr: ChangeDetectorRef
    ) {
      const currentYear = new Date().getFullYear();
      this.years = Array.from({ length: currentYear - 2000 + 1 }, (_, i) => 2000 + i);
  
      // **MODIFICADO**: Agregado validador condicional para foliosf en create_sf
      this.orderForm = this.fb.group({
        order_number: [{ value: '', disabled: true }],
        foliosf: [''], // No se agrega validador aquí, se maneja dinámicamente en ngOnInit
        date: ['', Validators.required],
        date_limited: ['', Validators.required],
        format_type: ['PRODUCTOS', Validators.required],
        process: ['', Validators.required],
        provider_id: ['', Validators.required],
        provider_name: [''],
        oficio: [''],
        no_beneficiarios: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
        requester_area_id: ['', Validators.required],
        requester_area_name: [''],
        requester_subarea_id: [''],
        requester_subarea_name: [''],
        ur: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
        delivery_place: ['', Validators.required],
        concept_total: [0, [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
        iva: [0, [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
        isr_retention: [0, [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
        total: [0, [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
        subsidio_estatal: [{ value: false, disabled: true }],
        ingresos_propios: [{ value: false, disabled: true }],
        federal: [{ value: false, disabled: true }],
        mixto: [{ value: false, disabled: true }],
        general_observations: [''],
        products: this.fb.array([], Validators.required)
      }, 
      { validators: this.dateRangeValidator });
      
      // Suscribirse a currentUser$
      this.userSub = this.authService.currentUser$.subscribe(user => {
        this.currentUser = user;
      });
    
      // **SIN CAMBIOS**: newProductForm permanece igual
      this.newProductForm = this.fb.group({
        title: ['', Validators.required],
        description: ['', Validators.required],
        ur_progressive: ['', Validators.required],
        grupo: ['', Validators.required], // varchar(20)
        subgrupo: ['', Validators.required], // varchar(60)
        oficio: ['', Validators.required], // varchar(20)
        quantity: [0, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
        unit_price: [0, [Validators.required, Validators.min(0)]],
        partida: [''],
        specifications: [''],
        brand: [''],
        price_general: [0, [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
        product_categorie_id: ['', Validators.required],
        umbral_unit_id: ['', Validators.required],
        marca_id: [''],
        marca_nombre:[''],
        tipo_id: [''],
        tipo_nombre:[''],
        modelo: [0],
        cilindro: [0],
        numeroeco: [''],
        no_economico:[''],
        placa: [''],
        subsidio_estatal: [false],
        ingresos_propios: [false],
        federal: [false],
        mixto: [false]
      });
    }
  
    
    ngOnInit(): void {
  
        
      this.authService.getUserByToken().pipe(takeUntil(this.destroy$)).subscribe({
        
        next: (user) => {
          if (user) {
            this.user = user;
            console.log('Usuario desde getUserByToken:', user);
            const authDataRaw = localStorage.getItem('authData');
            let authData: AuthData = {};
            try {
              authData = authDataRaw ? JSON.parse(authDataRaw) : {};
            } catch (e) {
              console.error('Error parsing authData from localStorage:', e);
            }
            this.user = {
              ...user,
              name: user.name || authData.firstname || '',
              surname: user.surname || authData.lastname || ''
            };
            //cargar notificaciones iniciales si no hay orderId
            if (!this.orderId){
              this.loadNotifications(null);
            }
          } else {
            this.authService.logout();
            this.router.navigate(['/auth/login']);
          }
        },
        error: () => {
          this.authService.logout();
          this.router.navigate(['/auth/login']);
        }
      });
  
  
     
      if (!this.verifyPermissions()) return;
      
  
      console.log('Usuario después del fix: verifyPermissions');
      console.log('Permisos:', this.authService.currentUserValue?.permissions);
      console.log('Id:', this.authService.currentUserValue?.id);
      console.log('Roles:', this.authService.currentUserValue?.roles);
      console.log('Tiene opcreate = create_sf?', this.authService.hasPermission('orders.create_sf'));
      console.log('Tiene assign_partidas = validate_sf?', this.authService.hasPermission('orders.assign_partidas'));
      console.log('Tiene opedit = update?', this.authService.hasPermission('orders.update'));
      console.log('Tiene opcreate, anexar OP= add_order_numbera?', this.authService.hasPermission('orders.add_order_number'));
      console.log('Tiene recibir productos, = receive?', this.authService.hasPermission('orders.receive'));
      console.log('Tiene listar productos, = list?', this.authService.hasPermission('orders.list'));
      console.log('Tiene view productos, = view?', this.authService.hasPermission('orders.view'));
  
    //if (!this.checkPermissions()) {
      //this.showError('No tienes permisos...');
    //}
  
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.mode = params['mode'] || 'create_sf';
      console.log('Modo establecido:', this.mode);
      console.log('order_number disabled:', this.orderForm.get('order_number')?.disabled);
      console.log('Tiene opcreate anexar OP?', this.authService.hasPermission('orders.add_order_number'));
      console.log('✅ Modo activo en OpCreateComponent:', this.mode);
      console.log('Tiene opedit?', this.authService.hasPermission('orders.update'));
  
      this.orderId = this.route.snapshot.params['id'] ? +this.route.snapshot.params['id'] : null;
  
      // Limpiar todos los validadores del formulario
      //this.orderForm.clearValidators();
      //this.orderForm.setValidators([]);
      // Reforzar validador global de fechas
      this.orderForm.setValidators(this.dateRangeValidator);
      this.orderForm.updateValueAndValidity({ emitEvent: false });
  
      this.applyModePermissions();
      if (this.orderId) {
        this.loadUnits();
        this.loadNotifications(this.orderId);
        this.loadOrderData();
        setTimeout(() => this.cdr.detectChanges(), 100);
        
      }
    });
  
      //iniciar cargas
      this.initSubareaSearchStream();
      this.initProviderSearchStream();
      this.loadProviders();
      this.loadAreas();
      this.loadUnits();
      this.loadMarcas();
      this.loadVehiculos();
      this.loadProductCategories();
      this.adjustAllTextareas();  
  
      this.isUnitPriceFocused = [];
      this.unitPriceRaw = [];
  
      // Configurar validación en tiempo real para foliosf
      this.foliosfSubject.pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap(foliosf => this.orderService.checkUnique('foliosf', foliosf))
      ).subscribe({
        next: (isUnique) => {
          this.isFoliosfValid = isUnique;
          if (!isUnique) {
            Swal.fire({
              icon: 'error',
              title: 'Folio no válido',
              text: 'El folio SF ya está en uso. Por favor, ingresa un folio diferente.',
              confirmButtonText: 'OK'
            });
          }
        },
        error: () => {
          this.isFoliosfValid = false;
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo verificar el folio SF. Inténtalo de nuevo.',
            confirmButtonText: 'OK'
          });
        }
      });
  
      // Configurar validación en tiempo real para order_number
      this.orderNumberSubject.pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap(orderNumber => this.orderService.checkUnique('order_number', orderNumber))
      ).subscribe({
        next: (isUnique) => {
          this.isOrderNumberValid = isUnique;
          if (!isUnique) {
            Swal.fire({
              icon: 'error',
              title: 'Número de orden no válido',
              text: 'El número de orden ya está en uso. Por favor, ingresa un número diferente.',
              confirmButtonText: 'OK'
            });
          }
        },
        error: () => {
          this.isOrderNumberValid = false;
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo verificar el número de orden. Inténtalo de nuevo.',
            confirmButtonText: 'OK'
          });
        }
      });
  
      
  
      //busqueda de subareas hacia la api
      this.subareaSearchSubject.pipe(
        debounceTime(300), 
        distinctUntilChanged(),
        switchMap(query => 
          this.orderService.searchSubareas(query, this.subareaPage, this.itemsPerPage).pipe(
            catchError(() => of({ subareas: [], total: 0 }))
          )
        ),
        takeUntil(this.destroy$)
      ).subscribe(response => {
        this.allSubareas = response.subareas || [];
        this.filteredSubareas = [...this.allSubareas]; // lo que viene del backend
      });
  
      // busqueda de productos de api
      this.productSearchSubject.pipe(
        debounceTime(300),
        switchMap(({ query, index }) => this.orderService.searchProducts(query, this.productPages[index], this.itemsPerPage).pipe(
          catchError(() => of({ products: { data: [] }, total: 0 })),
          map(response => ({ index, products: response.products.data }))
        )),
        takeUntil(this.destroy$)
      ).subscribe(({ index, products }) => {
        this.allProducts[index] = products || [];
        this.filterProducts(this.productSearchQueries[index], index);
      });
  
      /// subscripcion busqueda vehiculos api
      this.vehiculosSearchSubjetc.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(query => {
          if (!query || query.length <= 2) {
            return of({ vehiculos: this.allVehiculos, total: this.allVehiculos.length });
          }
          return this.orderService.searchVehiculos(query).pipe(
            catchError(() => of({ vehiculos: [], total: 0 }))
          );
        }),
        takeUntil(this.destroy$)
      ).subscribe(response => {
        this.allVehiculos = response.vehiculos || [];
        this.filteredVehiculos = [...this.allVehiculos];
      });
  
       //suscripciones a cambios en el formulario
      this.orderForm.get('format_type')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(formatType => {
        this.updateProductValidators(formatType);
      });
  
  
  
      this.orderForm.get('total')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(value => {
        if (this.mode !== 'validate_sf') {
        this.financialDisplays['total'] = this.formatCurrency(value);
        }
      });
  
      
      this.productsFormArray.valueChanges.pipe(
        debounceTime(50),
        takeUntil(this.destroy$)).subscribe(() => {
        if (this.mode !== 'validate_sf') {
        this.calculateProductAmounts();
        }
      });
      
  
      if (!this.ignoreDraftOnce){
        const savedForm = localStorage.getItem('orderFormDraft');
        if (savedForm) {
        this.orderForm.patchValue(JSON.parse(savedForm));
        }
      }else {
        this.ignoreDraftOnce = false; 
      }
  
      this.orderForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(value => {
        localStorage.setItem('orderFormDraft', JSON.stringify(value));
      });
    
    this.orderForm.valueChanges
    .pipe(takeUntil(this.destroy$))
    .subscribe(() => {
      if (this.mode === 'validate_sf') {
        this.productsFormArray.controls.forEach(control => {
          if (!control.get('unit_price')?.disabled) {
            control.get('unit_price')?.disable({ emitEvent: false });
          }
        });
      }
    });
    }  
  
   
    
    showError(message: string) {
      Swal.fire({
        title: '¡Error!',
        text: message,
        icon: 'error',
        background: '#fff3cd',
        customClass: {
          popup: 'post-it-notification',
        },
        showConfirmButton: true,
      }).then(() => {
        this.router.navigate(['/ordenpedido/oplist']);
      });
      this.applyModePermissions();
    }
  

  
    ngAfterViewInit(): void {
       // Evitar resetear todo si estamos editando una orden ya cargada
        if (!this.orderId) {
          this.orderForm.patchValue({ format_type: 'PRODUCTOS' }, { emitEvent: false });
        }
      }
  
    ngOnDestroy(): void {
      this.subareaSearchSub?.unsubscribe();
      this.providerSearchSub?.unsubscribe();
      this.destroy$.next();
      this.destroy$.complete();
    }
  
    private setGlobalLoading(loading: boolean): void {
      // **SIN CAMBIOS**
      this.isGlobalLoading = loading;
      this.isLoading = loading;
    }
  
  
    // Cargar notificaciones desde el backend
    loadNotifications(orderId: number | null) {
      if (!orderId) {
        this.notifications = []; // Limpiar notificaciones si no hay orderId
        return;
      }
  
      this.orderService.getNotifications(orderId).subscribe({
        next: (response) => {
          this.notifications = response.notifications.filter((n: any) => !n.is_read);
        },
        error: (err) => this.showNotification('error', err.message),
      });
    }
  
    
    dismissNotification(notificationId: number): void {
      this.orderService.markNotificationAsRead(notificationId).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.notifications = this.notifications.filter(n => n.id !== notificationId);
          this.showNotification('success', 'Notificación cerrada exitosamente.');
        },
        error: (err) => this.showNotification('error', 'No se pudo cerrar la notificación: ' + err.message),
      });
    }
  
  
    private loadOrderData(): void {
    // Carga de datos de la orden
    if (!this.orderId) return;
    this.setGlobalLoading(true);
  
    this.orderService.getOrderById(this.orderId!).pipe(
      retry(2),
      catchError(() => {
        Swal.fire('Error', 'No se pudo cargar la orden. Intenta de nuevo.', 'error');
        this.router.navigate(['/ordenpedido/oplist']);
        return of(null);
      }),
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        try {
          if (!data) {
            this.setGlobalLoading(false);
            return;
          }
  
          // Parchear datos principales del formulario (sin emitir eventos)
          this.orderForm.patchValue({
            order_number: data.order_number ?? null,
            foliosf: data.foliosf ?? '',
            date: data.date ? new Date(data.date).toISOString().split('T')[0] : '',
            date_limited: data.date_limited ? new Date(data.date_limited).toISOString().split('T')[0] : '',
            no_beneficiarios: data.no_beneficiarios ?? '',
            elaboro: data.createdBy?.name || '',
            format_type: data.format_type ?? 'PRODUCTOS',
            process: data.process ?? '',
            provider_id: data.provider_id ?? '',
            provider_name: data.provider?.full_name || '',
            requester_area_id: data.requester_area_id || data.requesterSubarea?.area?.id || '',
            requester_area_name: data.requester_area_name || data.requesterArea?.name || data.requesterSubarea?.area?.name || '',
            requester_subarea_id: data.requester_subarea_id ?? '',
            requester_subarea_name: data.requester_subarea_name || data.requesterSubarea?.name || '',
            ur: data.ur ?? data.requesterArea?.urs ?? '',
            delivery_place: data.delivery_place ?? '',
            concept_total: data.concept_total ?? 0,
            iva: data.iva ?? 0,
            isr_retention: data.isr_retention ?? 0,
            total: data.total ?? 0,
            subsidio_estatal: !!data.subsidio_estatal,
            ingresos_propios: !!data.ingresos_propios,
            federal: !!data.federal,
            mixto: !!data.mixto,
            general_observations: data.general_observations || ''
          }, { emitEvent: false });
  
          // Displays financieros (presentación)
          this.financialDisplays = {
            concept_total: this.formatCurrency(Number(data.concept_total ?? 0)),
            iva: this.formatCurrency(Number(data.iva ?? 0)),
            isr_retention: this.formatCurrency(Number(data.isr_retention ?? 0)),
            total: this.formatCurrency(Number(data.total ?? 0))
          };
  
          if (!this.isIvaFocused) this.ivaEditing = this.financialDisplays['iva'];
          if (!this.isIsrFocused) this.isrEditing = this.financialDisplays['isr_retention'];
  
          // Limpia productos actuales
          this.productsFormArray.clear();
  
          // Helper para label de unidad desde payload
          const unitNameFromPayload = (p: any) => {
            return p?.unit?.nombre || p?.unit?.name || p?.unit_nombre || '';
          };
  
          // Función que itera productos y parchea controls
          const populateProducts = () => {
            (data.products ?? []).forEach((product: any, index: number) => {
              this.addProduct();
              const productForm = this.productsFormArray.at(index) as FormGroup;
  
              // Normalizar unit_id: si viene como string numérico => Number
              const rawUnitId = product.unit_id ?? '';
              const normalizedUnitId = (rawUnitId !== '' && !isNaN(Number(rawUnitId))) ? Number(rawUnitId) : (rawUnitId === null || rawUnitId === undefined ? '' : rawUnitId);
  
              // Fallback de nombre de unidad desde payload si existe
              const fallbackUnitNombre = unitNameFromPayload(product);
  
              // Patch principal del renglón (sin emitir)
              productForm.patchValue({
                id: product.id ?? null,
                progresivo: product.progresivo ?? '',
                ur_progressive: product.ur_progressive ?? '',
                quantity: product.quantity ?? 1,
                unit_id: normalizedUnitId !== '' ? normalizedUnitId : '',
                unit_nombre: fallbackUnitNombre,
                description: product.description ?? '',
                brand: product.brand ?? '',
                marca_id: product.marca_id ?? '',
                marca_nombre: product.marca?.nombre || '',
                tipo_id: product.tipo_id ?? '',
                tipo_nombre: product.tipo?.nombre || '',
                placa: product.placa ?? '',
                modelo: product.modelo ?? '',
                cilindro: product.cilindro ?? '',
                oficio: product.oficio ?? '',
                grupo: product.grupo ?? '',
                subgrupo: product.subgrupo ?? '',
                unit_price: product.unit_price ?? 0,
                amount: (Number(product.quantity ?? 0) * Number(product.unit_price ?? 0)),
                partida: product.partida ?? 'S.P',
                observations: product.observations ?? '',
                received_quantity: product.received_quantity ?? 0,
                is_delivered: !!product.is_delivered,
                selectedProduct: product.product_id ? { id: product.product_id } : null,
                product_id: product.product_id ?? product.id ?? null,     // ← NUEVO
                }, { emitEvent: false });
  
              // Formato para input visible
              this.unitPriceRaw[index] = this.formatCurrency(Number(product.unit_price ?? 0));
              this.isUnitPriceFocused[index] = false;
  
              // Suscripciones por control (marca interna previene multisubscribe)
              this.subscribeProductControlChanges(productForm, index);
  
              // Si ya tenemos lista de units, intentar re-parchear con etiqueta definitiva
              if (this.units && this.units.length > 0 && normalizedUnitId !== '' && normalizedUnitId !== null && normalizedUnitId !== undefined) {
                const unidad = this.units.find(u => String(u.id) === String(normalizedUnitId));
                if (unidad) {
                  productForm.patchValue({
                    unit_id: unidad.id,
                    unit_nombre: unidad.nombre ?? unidad.name ?? ''
                  }, { emitEvent: false });
                } else if (fallbackUnitNombre) {
                  // si unidad no existe en lista local, dejar el fallback nombre
                  productForm.patchValue({ unit_nombre: fallbackUnitNombre }, { emitEvent: false });
                }
              }
            });
  
            // Ajustes finales después de poblar todos los renglones
            this.applyModePermissions();
            this.adjustAllTextareas();
            this.setGlobalLoading(false);
            this.applyModePermissions();;
            this.loadNotifications(this.orderId!);
            setTimeout(() => this.cdr.detectChanges(), 100);
            this.pdfUrl = `/api/orders/${this.orderId}/pdf`;
          }; // fin populateProducts
  
          // Si no hay units cargadas, cargarlas primero para evitar que el select pierda selección visual
          if (!this.units || this.units.length === 0) {
            this.orderService.getUnits().pipe(take(1)).subscribe({
              next: (resp: any) => {
                try {
                  const loadedUnits = Array.isArray(resp) ? resp : (resp?.units || resp?.data || []);
                  this.units = loadedUnits || [];
                } catch (e) {
                  console.warn('[loadOrderData] normalizing units error:', e);
                  this.units = [];
                }
                
                console.log('>>> units after load:', this.units);
                this.productsFormArray.controls.forEach((c, i) => {
                  console.log(`product[${i}] form unit_id:`, c.get('unit_id')?.value, 'unit_nombre:', c.get('unit_nombre')?.value);
                });
                
                
                // ahora sí poblar productos con units disponibles
                populateProducts();
              },
              error: (err) => {
                console.warn('No se pudieron cargar unidades fallback:', err);
                // continuar igual (usando fallbackUnitNombre desde payload)
                populateProducts();
              }
            });
          } else {
            // units ya estaban cargadas
            populateProducts();
          }
        } catch (e) {
          console.error('[loadOrderData] error processing data:', e);
          this.setGlobalLoading(false);
        }
      },
      error: () => {
        this.setGlobalLoading(false);
      }
    });
  }
  
  
  
 
    private updateProductValidators(formatType: string): void {
      
      this.showAutomotrizFields = formatType === 'REFACCIONES';// **SIN CAMBIOS**
      this.productsFormArray.controls.forEach(control => {
        if (formatType === 'REFACCIONES') {
          control.get('marca_id')?.setValidators(Validators.required);
          control.get('tipo_id')?.setValidators(Validators.required);
          control.get('placa')?.setValidators(Validators.required);
          control.get('modelo')?.setValidators(Validators.required);
          control.get('cilindro')?.setValidators(Validators.required);
        } else {
          control.get('marca_id')?.clearValidators();
          control.get('tipo_id')?.clearValidators();
          control.get('placa')?.clearValidators();
          control.get('modelo')?.clearValidators();
          control.get('cilindro')?.clearValidators();
        }
        control.get('marca_id')?.updateValueAndValidity({ emitEvent: false });
        control.get('tipo_id')?.updateValueAndValidity({ emitEvent: false });
        control.get('placa')?.updateValueAndValidity({ emitEvent: false });
        control.get('modelo')?.updateValueAndValidity({ emitEvent: false });
        
      });
    }
  
    get productsFormArray(): FormArray {
      // **SIN CAMBIOS**
      return this.orderForm.get('products') as FormArray;
    }
  
  
  
    addProduct(): void {
      // **MODIFICADO**: Ajustado para asegurar que partida esté habilitada/deshabilitada según el modo
      const formatType = this.orderForm.get('format_type')?.value ?? '';
  
      const productForm = this.fb.group({
        product_id: [null,Validators.required],
        unit_nombre:[''],
        id: [null],
        progresivo: ['', Validators.required],
        ur_progressive: ['', Validators.required],
        quantity: [1, [Validators.required, Validators.min(1)]],
        unit_id: ['', Validators.required],
        description: ['', Validators.required],
        brand: [''], //marcar del producto
  
        
        marca_id: [formatType === 'REFACCIONES' ? '' : null, formatType === 'REFACCIONES' ? Validators.required : []],
        tipo_id: [formatType === 'REFACCIONES' ? '' : null, formatType === 'REFACCIONES' ? Validators.required : []],
        placa: [formatType === 'REFACCIONES' ? '' : null, formatType === 'REFACCIONES' ? Validators.required : []],
        modelo: [formatType === 'REFACCIONES' ? '' : null, formatType === 'REFACCIONES' ? Validators.required : []],
        cilindro: [formatType === 'REFACCIONES' ? '' : null, formatType === 'REFACCIONES' ? Validators.required : []],
        
        marca_nombre:[''],
        tipo_nombre:[''],
        grupo: [''],
        subgrupo: [''],
        oficio: [''],
        unit_price: [0, [Validators.required, Validators.min(0)]],
        amount: [{ value: 0, disabled: true }],
        partida: [{ value: 'S.P', disabled: this.mode === 'create_sf'}, Validators.required],
        observations: [''],
        received_quantity: [0, Validators.min(0)],
        is_delivered: [false],
        selectedProduct: [null]
      });
      
      this.productsFormArray.push(productForm);
      const index = this.productsFormArray.length - 1;
      this.watchMarcaChanges(productForm, index);
  
      // 12/10/25 Suscribir cambios solo para este renglón (evita bucles / resets de unit_id)
      this.subscribeProductControlChanges(productForm, index);
      
      this.filteredProducts[index] = [];
      this.allProducts[index] = [];
      this.productSearchQueries[index] = '';
      this.productPages[index] = 1;
      this.unitPriceRaw[index] = '0.00';
      this.tipos[index] = [];
      this.applyModePermissions();
    }
  
    // agregado 12/10/25
    private subscribeProductControlChanges(control: FormGroup, index: number): void {
    // marcar para evitar múltiples subscripciones al mismo FormGroup
    if ((control as any).__subscribed__) return;
    (control as any).__subscribed__ = true;
  
    // quantity -> recalcula solo este índice
    control.get('quantity')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.calculateProductAmountsForIndex(index);
    });
  
    // unit_price -> recalcula solo este índice
    control.get('unit_price')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.calculateProductAmountsForIndex(index);
    });
  
    //agregue debug borrar despues.
    control.get('unit_id')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(newVal => {
    console.log(`🔁 [DEBUG] product[${index}].unit_id cambiado a:`, newVal, 'units disponibles:', this.units?.length);
      });
    // selectedProduct -> si el producto trae unit_id lo parchea sin emitir events
    control.get('selectedProduct')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((value: any) => {
      if (value && value.unit_id) {
        const current = control.get('unit_id')?.value;
        if (String(current) !== String(value.unit_id)) {
          control.patchValue({ unit_id: value.unit_id }, { emitEvent: false });
        }
      }
    });
  }
  
    removeProduct(index: number): void {
      // **SIN CAMBIOS**
      this.productsFormArray.removeAt(index);
      this.filteredProducts.splice(index, 1);
      this.allProducts.splice(index, 1);
      this.productSearchQueries.splice(index, 1);
      this.productPages.splice(index, 1);
      this.unitPriceRaw.splice(index, 1);
      //this.tipos.splice(index, 1);
      this.calculateProductAmounts();
    }
  
   //cargar variables de proveedores, areas unidades, marcas, etc
  
    loadProviders(): void {
      // **SIN CAMBIOS**
      this.setGlobalLoading(true);
      this.orderService.getProviders(1, this.itemsPerPage).pipe(
        retry(2),
        catchError(() => {
          Swal.fire('Error', 'No se pudieron cargar los proveedores. Intenta de nuevo.', 'error');
          return of({ providers: [] });
        }),
        takeUntil(this.destroy$)
      ).subscribe({
        next: (data: any) => {
          this.providers = data.providers || [];
          this.setGlobalLoading(false);
        },
        error: () => {
          this.setGlobalLoading(false);
        }
      });
    }
  
    loadAreas(): void {
      // **SIN CAMBIOS**
      this.setGlobalLoading(true);
      this.orderService.getAreas().pipe(
        retry(2),
        catchError(() => {
          Swal.fire('Error', 'No se pudieron cargar las áreas. Intenta de nuevo.', 'error');
          return of({ areas: [] });
        }),
        takeUntil(this.destroy$)
      ).subscribe({
        next: (data: any) => {
          this.areas = data.areas || [];
          this.setGlobalLoading(false);
        },
        error: () => {
          this.setGlobalLoading(false);
        }
      });
    }
  
    loadUnits(): void {
      // **SIN CAMBIOS**
      this.setGlobalLoading(true);
      this.orderService.getUnits().pipe(
        retry(2),
        catchError(() => {
          Swal.fire('Error', 'No se pudieron cargar las unidades. Intenta de nuevo.', 'error');
          return of({ units: [] });
        }),
        takeUntil(this.destroy$)
      ).subscribe({
        next: (data: any) => {
    // Normalizar respuesta (API puede devolver { units: [...] } o directamente array)
    this.units = Array.isArray(data) ? data : (data?.units || data?.data || []);
    console.log('unidades (normalizadas):', this.units);
    this.setGlobalLoading(false);
  
    // 🔹 Re-parchar productos si ya hay data cargada
    this.productsFormArray.controls.forEach((control, index) => {
      const unitId = control.get('unit_id')?.value;
      if (unitId !== null && unitId !== undefined && unitId !== '') {
        const unidad = this.units.find(u => String(u.id) === String(unitId));
        if (unidad) {
          control.patchValue({ unit_id: unidad.id, unit_nombre: unidad.nombre ?? '' }, { emitEvent: false });
        }
      }
    }); try { this.cdr.detectChanges(); } catch(e) {}
  },
      error: () => this.setGlobalLoading(false)
    });
  }
  
    loadMarcas(): void {
      // **SIN CAMBIOS**
      this.setGlobalLoading(true);
      this.orderService.getMarcas().pipe(
        retry(2),
        catchError(() => {
          Swal.fire('Error', 'No se pudieron cargar las marcas. Intenta de nuevo.', 'error');
          return of({ marcas: [] });
        }),
        takeUntil(this.destroy$)
      ).subscribe({
        next: (data: any) => {
          this.marcas = data.marcas.map((marca: any) => ({ id: marca.id, nombre: marca.nombre })) || [];
          console.log('marcas de carros:', this.marcas)
          this.setGlobalLoading(false);
        },
        error: () => {
          this.setGlobalLoading(false);
        }
      });
    }
  
    loadTipos(marcaId: number, productIndex: number): void {
      // **SIN CAMBIOS**
      this.orderService.getTipos(marcaId).pipe(
        retry(2),
        catchError(() => {
          this.tipos[productIndex] = [];
          console.log('tipos de carros:', this.tipos)
          return of({ tipos: [] });
        }),
        takeUntil(this.destroy$)
      ).subscribe({
        next: (data: any) => {
          this.tipos[productIndex] = data.tipos.map((tipo: any) => 
            ({ id: tipo.id, nombre: tipo.nombre, marcaId: tipo.marca_id })) || [];
          console.log('tipos de carros:', productIndex, ':', this.tipos[productIndex]);
        }
      });
    }
    
    private watchMarcaChanges(control: AbstractControl, index: number): void {
      // **SIN CAMBIOS**
      const marcaControl = control.get('marca_id');
      if (marcaControl) {
        marcaControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(marcaId => {
          if (marcaId) {
            this.loadTipos(marcaId, index);
          } else {
            this.tipos[index] = [];
            control.get('tipo_id')?.setValue('', { emitEvent: false });
          }
        });
      }
    }
    
  
    loadProductCategories(): void {
      // **SIN CAMBIOS**
      this.setGlobalLoading(true);
      this.orderService.getProductCategories().pipe(
        retry(2),
        catchError(() => {
          Swal.fire('Error', 'No se pudieron cargar las categorías de productos. Intenta de nuevo.', 'error');
          return of({ categories: [] });
        }),
        takeUntil(this.destroy$)
      ).subscribe({
        next: (data: any) => {
          this.productCategories = data.categories || [];
          console.log('categories:',this.productCategories);
          this.setGlobalLoading(false);
        },
        error: () => {
          this.setGlobalLoading(false);
        }
      });
    }
  

  /** STREAM ÚNICO: Proveedores (input -> API si aplica) */
private initProviderSearchStream(): void {
  this.providerSearchSub?.unsubscribe();

  this.providerSearchSub = this.providerSearchSubject.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(query => {
      // Evitar consultas mientras el modal no esté visible
      if (!this.showProviderModal) {
        return of({ providers: [], total: 0 });
      }
      const q = (query ?? '').trim();

      // Regla: para cadenas >2 o vacío (recargar todo)
      const effectiveQuery = (q.length > 2 || q === '') ? q : '';
      return this.orderService.searchProviders(effectiveQuery, this.providerPage, this.itemsPerPage).pipe(
        catchError((error) => {
          console.error('Error searching providers:', error);
          // No spamear al usuario, pero puedes mostrar un toast si quieres:
          // this.showNotification('error', 'Error al buscar proveedores');
          return of({ providers: [], total: 0 });
        })
      );
    }),
    takeUntil(this.destroy$)
  ).subscribe(response => {
    if (!this.showProviderModal) return;

    this.allProviders = Array.isArray(response?.providers) ? response.providers : [];
    this.applyProviderLocalFilter(this.providerSearchQuery); // filtro local inmediato
  });
}

/** FILTRO LOCAL: Proveedores */
private applyProviderLocalFilter(query: string): void {
  const q = (query ?? '').toLowerCase().trim();
  const base = this.allProviders || [];

  if (!q) {
    this.filteredProviders = [...base];
    return;
  }

  this.filteredProviders = base.filter(provider =>
    (provider.full_name ?? '').toLowerCase().includes(q) ||
    (provider.code ?? '').toLowerCase().includes(q) ||
    (provider.rfc ?? '').toLowerCase().includes(q)
  );
}
    

      /** HANDLER ÚNICO: entrada de búsqueda de proveedores */
onProviderQueryChange(query: string): void {
  this.providerSearchQuery = query ?? '';

  // 1) Respuesta inmediata: filtro local
  this.applyProviderLocalFilter(this.providerSearchQuery);

  // 2) Si query >2 o vacío (para recargar todo): API
  if (this.providerSearchQuery.length > 2 || this.providerSearchQuery.trim() === '') {
    this.providerPage = 1;
    this.providerSearchSubject.next(this.providerSearchQuery);
  }
}
   

openProviderModal(): void {
  this.showProviderModal = true;

  // Estado inicial
  this.providerSearchQuery = '';
  this.providerPage = 1;

  // (Re)inicia el stream y dispara primera carga (todas)
  this.initProviderSearchStream();
  this.providerSearchSubject.next(''); // carga inicial desde API (query vacío)
  this.applyProviderLocalFilter('');   // muestra algo en UI desde memoria
}

closeProviderModal(): void {
  this.showProviderModal = false;
  this.providerSearchQuery = '';
}



    selectProvider(provider: any, event?: Event): void {
  if (event) event.stopPropagation();

  if (!provider || !provider.id) {
    this.showNotification('error', 'Proveedor no válido');
    return;
  }

  this.orderForm.patchValue({
    provider_id: provider.id,
    provider_name: provider.full_name
  }, { emitEvent: false });

  this.closeProviderModal();
  // Feedback opcional
  this.showNotification('success', `Proveedor "${provider.full_name}" seleccionado`);
}
    
    filterProvider(query: string): void {
      if(!query){
        this.filteredProviders = [...this.allProviders];
        return;
      }
  
      const q = query.toLowerCase();
        this.filteredProviders = this.allProviders.filter(provider => 
          provider.full_name.toLowerCase().includes(q) ||
          (provider.code && provider.code.toLowerCase().includes(q)) ||
          (provider.rfc && provider.rfc.toLowerCase().includes(q))
        );
    }
  
     
  openSubareaModal(): void {
  this.showSubareaModal = true;
  this.subareaSelectionInProgress = false;

  // Estado inicial
  this.subareaSearchQuery = '';
  this.subareaPage = 1;

  // (Re)inicia el stream y dispara primera carga (todas)
  this.initSubareaSearchStream();
  this.subareaSearchSubject.next('');   // ← load initial page from API
  this.applyLocalSubareaFilter('');     // ← visual rápido
}

closeSubareaModal(): void {
  this.showSubareaModal = false;
  this.subareaSearchQuery = '';
  // No es necesario desuscribir el stream aquí; ya se maneja en destroy$
}

selectSubarea(subarea: any, event?: Event): void {
  if (event) event.stopPropagation();

  if (!subarea || !subarea.id) {
    this.showNotification('error', 'Subárea no válida');
    return;
  }

  // Evita que el stream refresque la tabla mientras se asigna
  this.subareaSelectionInProgress = true;

  this.orderForm.patchValue({
    requester_subarea_id: subarea.id,
    requester_subarea_name: subarea.name || 'N/A',
    requester_area_id: subarea.area?.id || null,
    requester_area_name: subarea.area?.name || 'N/A',
    ur: subarea.area?.urs || ''
  }, { emitEvent: false });

  this.subareaSelectionInProgress = false;
  this.closeSubareaModal();

  // UX: feedback opcional
  this.showNotification('success', `Subárea "${subarea.name}" seleccionada`);
}


private initSubareaSearchStream(): void {
  // Evita streams duplicados
  this.subareaSearchSub?.unsubscribe();

  this.subareaSearchSub = this.subareaSearchSubject.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(query => {
      // Mientras el modal no esté abierto o hay selección en curso, no dispares API
      if (!this.showSubareaModal || this.subareaSelectionInProgress) {
        return of({ subareas: [], total: 0 });
      }
      // Query vacío = cargar todo (página 1)
      const q = (query ?? '').trim();
      const effectiveQuery = q.length > 2 || q === '' ? q : ''; // cortos: evita pegarle a la API
      return this.orderService.searchSubareas(effectiveQuery, this.subareaPage, this.itemsPerPage).pipe(
        catchError((error) => {
          console.error('Error searching subareas:', error);
          this.showNotification('error', 'Error al buscar subáreas');
          return of({ subareas: [], total: 0 });
        })
      );
    }),
    takeUntil(this.destroy$)
  ).subscribe(response => {
    if (!this.showSubareaModal || this.subareaSelectionInProgress) return;

    this.allSubareas = response.subareas || [];
    this.applyLocalSubareaFilter(this.subareaSearchQuery);
  });
}

onSubareaQueryChange(query: string): void {
  this.subareaSearchQuery = query ?? '';

  // 1) Respuesta inmediata: filtra en memoria
  this.applyLocalSubareaFilter(this.subareaSearchQuery);

  // 2) Si el query es razonable (>2) o vacío (recargar todo), consulta servidor
  if (this.subareaSearchQuery.length > 2 || this.subareaSearchQuery.trim() === '') {
    this.subareaPage = 1;
    this.subareaSearchSubject.next(this.subareaSearchQuery);
  }
}

private applyLocalSubareaFilter(query: string): void {
  const q = (query ?? '').toLowerCase().trim();
  if (!q) {
    this.filteredSubareas = [...(this.allSubareas || [])];
    return;
  }

  this.filteredSubareas = (this.allSubareas || []).filter(s =>
    (s.name ?? '').toLowerCase().includes(q) ||
    (s.area?.name ?? '').toLowerCase().includes(q) ||
    (s.code ?? '').toLowerCase().includes(q)
  );
}
    

  
  resetSubareaSearch(): void {
    this.subareaSearchQuery = '';
    this.subareaPage = 1;
    this.applyLocalSubareaFilter('');
    this.subareaSearchSubject.next('');
  }
  
  
    // Modificar openProductModal para hacer focus
    openProductModal(index: number): void {
      this.showProductModal = index;
      
      // Inicializar arrays si no existen
      if (!this.productSearchQueries[index]) {
        this.productSearchQueries[index] = '';
      }
      if (!this.allProducts[index]) {
        this.allProducts[index] = [];
        this.filteredProducts[index] = [];
        this.productPages[index] = 1;
      }
      
      // Cargar productos inicialmente si no los tenemos
      if (this.allProducts[index].length === 0) {
        this.searchProducts('', index);
      }else{
        this.filterProducts(this.productSearchQueries[index], index);
      }
      
      // Hacer focus en el input después de que el modal se abra
      setTimeout(() => {
        if (this.productSearchInput) {
          this.productSearchInput.nativeElement.focus();
        }
      }, 100);
    }
  
    // CERRAR MODAL DE PRODUCTOS (sin resetear los datos)
    closeProductModal(): void {
      this.showProductModal = null;
    }
  

    /** Filtro local unificado para productos */
private applyLocalProductFilter(index: number, query: string): void {
  const q = (query ?? '').toLowerCase().trim();
  const base = this.allProducts[index] || [];

  if (!q) {
    this.filteredProducts[index] = [...base];
    return;
  }

  this.filteredProducts[index] = base.filter((p: any) =>
    (p.title ?? '').toLowerCase().includes(q) ||
    (p.description ?? '').toLowerCase().includes(q) ||
    ((p.sku ?? '').toLowerCase().includes(q))
  );
}
  
/** Handler único de búsqueda: input → filtro local + API si aplica */
onProductQueryChange(query: string, index: number): void {
  // Guarda el texto
  this.productSearchQueries[index] = query ?? '';

  // 1) Filtro local inmediato para UX fluida
  this.applyLocalProductFilter(index, this.productSearchQueries[index]);

  // 2) Si el query es razonable (>1) o vacío (recargar todo), consulta servidor
  if (this.productSearchQueries[index].trim() === '' || this.productSearchQueries[index].length > 1) {
    this.productPages[index] = 1;
    this.searchProducts(this.productSearchQueries[index], index);
  }
}

/** Dispara búsqueda API (stream ya implementado en ngOnInit) */
searchProducts(query: string, index: number): void {
  // sincroniza el query si viene distinto
  if (this.productSearchQueries[index] !== query) {
    this.productSearchQueries[index] = query;
  }
  // reinicia paginación de ese index
  this.productPages[index] = 1;

  // dispara stream a la API (mantén tu pipe existente en ngOnInit)
  this.productSearchSubject.next({ query, index });
}


    // FILTRADO DE PRODUCTOS (sin cambios)
    filterProducts(query: string, index: number): void {
      this.filteredProducts[index] = query
        ? (this.allProducts[index] || []).filter(product =>
            product.title.toLowerCase().includes(query.toLowerCase()) ||
            product.description.toLowerCase().includes(query.toLowerCase()) ||
            (product.sku && product.sku.toLowerCase().includes(query.toLowerCase())))
        : [...(this.allProducts[index] || [])];
    }
  
  
    // SELECCIÓN DE PRODUCTO (modificada para no cerrar modal)
    selectProduct(product: any, index: number, event?: Event): void {
      if (event) event.stopPropagation ();
            
      if (!product || !product.id) {
        this.showNotification('error', 'Producto no válido');
        return;
      }
  
      const productForm = this.productsFormArray.at(index) as FormGroup;

      productForm.patchValue({
        product_id: product.id,
        description: product.title.toUpperCase(),
        brand: product.specifications ? product.specifications.toUpperCase() : 'N/A',
        unit_id: product.unit_id || '',
        unit_nombre:product.unit?.nombre || product.unit?.name || '',
        unit_price: product.unit_price || 0,
        partida: product.partida || 'S.P',
        selectedProduct: product
      }, { emitEvent: false }); 
  
      //agregado el 12/10/25
      this.subscribeProductControlChanges(productForm, index);
      
      this.unitPriceRaw[index] = this.formatCurrency(product.unit_price || 0);
      this.calculateProductAmount(index);
      
      // NO cerramos el modal, solo mostramos feedback
      this.showNotification('success', `Producto agregado`);
      
      // Opcional: limpiar búsqueda después de seleccionar
      this.productSearchQueries[index] = '';
      this.filterProducts('', index);
      this.applyModePermissions?.();
      //this.enforceDisabledFields();
    }
  
  
    // ✅ AGREGAR este método para agregar producto desde el modal - MODIFICADO
    addProductFromModal(): void {
      if (this.showProductModal !== null) {
        const currentIndex = this.showProductModal;
        const currentSearchQuery = this.productSearchQueries[currentIndex] || '';
        
        this.addProduct(); // Agrega nuevo renglón
        const newIndex = this.productsFormArray.length - 1;
        
        // Copiar el estado de búsqueda del modal actual al nuevo
        this.productSearchQueries[newIndex] = currentSearchQuery;
        this.allProducts[newIndex] = [...this.allProducts[currentIndex]];
        this.filteredProducts[newIndex] = [...this.filteredProducts[currentIndex]];
        this.productPages[newIndex] = this.productPages[currentIndex];
        
        // Mantener el modal abierto para el nuevo índice
        this.showProductModal = newIndex;
        this.onProductQueryChange(currentSearchQuery, newIndex);
        
        // Hacer focus en el input de búsqueda del nuevo modal
        setTimeout(() => {
          if (this.productSearchInput) {
            this.productSearchInput.nativeElement.focus();
          }
        }, 100);
      }
    }
  
    /** ✅ Valida solo los campos visibles del modal de producto rápido */
    isQuickProductFormValid(): boolean {
      const f = this.newProductForm.value;
      return (
        !!f.title?.trim() &&
        !!f.description?.trim() &&
        f.price_general > 0 &&
        !!f.product_categorie_id &&
        !!f.umbral_unit_id
      );
    }
  
      
  // ✅ Crear producto rápido (flujo simplificado para suficiencia presupuestal)
  createQuickProduct(): void {
    if (this.newProductForm.invalid) {
      Swal.fire({
        icon: 'warning',
        title: 'Datos incompletos',
        text: 'Por favor, completa los campos obligatorios del producto.',
        confirmButtonText: 'OK'
      });
      return;
    }
  
    const formValue = this.newProductForm.value;
    const payload = {
      title: formValue.title?.trim(),
      description: formValue.description?.trim(),
      product_categorie_id: formValue.product_categorie_id,
      umbral_unit_id: formValue.umbral_unit_id,
      price_general: parseFloat(formValue.price_general),
      specifications: formValue.specifications || '',
      brand: formValue.brand || '',
    };
  
    this.isGlobalLoading = true;
  
    this.orderService.createQuickProduct(payload).subscribe({
    next: (res) => {
      Swal.fire({
        icon: 'success',
        title: 'Producto creado',
        text: res.message || 'El producto se registró correctamente.',
        timer: 2000,
        showConfirmButton: false,
      });
  
      // Agregar a la tabla actual
      if (res.product) {
        this.filteredProducts[this.showProductModal ?? 0].push(res.product);
      }
  
      this.newProductForm.reset();
      this.closeCreateProductModal();
    },
    error: (err) => {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo crear el producto',
        text: err.message || 'Por favor, intenta nuevamente.',
      });
    }
  });
  }
  
   
    /*
    onProductSearch(event: Event): void {
      const input = event.target as HTMLInputElement;
      this.toUpperCase(event);
      this.searchProducts(input.value, this.showProductModal ?? 0);
      }
  */
  
    // ✅ Cerrar modal de creación de producto
    closeCreateProductModal(): void {
      this.showCreateProductModal = false;
      this.productCreatedMessage = '';
      this.resetNewProductForm();
      }
  
    // ✅ Resetear formulario de nuevo producto
    resetNewProductForm(): void {
      this.newProductForm.reset();
      this.showAutomotrizFields = false;
    }
  
    openCreateProductModal(): void {
    this.showCreateProductModal = true;
    this.productCreatedMessage = '';
  
    // ✅ Limpieza profunda de validadores ocultos (solo para el modal rápido)
    Object.keys(this.newProductForm.controls).forEach(key => {
      const control = this.newProductForm.get(key);
      if (control) {
        // Si no es un campo visible en el modal, limpiamos validadores y errores
        if (!['title', 'description', 'specifications', 'price_general', 'product_categorie_id', 'umbral_unit_id'].includes(key)) {
          control.clearValidators();
          control.setErrors(null);
          control.updateValueAndValidity({ emitEvent: false });
        }
      }
    });
  
    // Fuerza a Angular a recalcular el estado del formulario
    this.newProductForm.updateValueAndValidity();
  }
  
  
    // ✅ Marcar todos los campos como touched para mostrar errores
    markFormGroupTouched(formGroup: FormGroup) {
      Object.keys(formGroup.controls).forEach(key => {
        const control = formGroup.get(key);
        if (control) {
          control.markAsTouched();
        }
      });
    }
  
  
  // **AÑADIDO**: Método para enviar la Suficiencia Presupuestal a Área 2
    sendToArea2(orderId: number): void {
    // Validar que el formulario sea válido y que tengamos el foliosf
    if (!this.orderForm.valid || !this.orderForm.get('foliosf')?.value) {
      Swal.fire('Error', 'Por favor, ingrese un folio de suficiencia válido.', 'error');
      return;
    }
  
    this.setGlobalLoading(true);
    const data = {
      foliosf: this.orderForm.get('foliosf')?.value // Obtener el foliosf del formulario
    };
  
    this.orderService.sendToArea2(orderId, data).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response) => {
        Swal.fire('Éxito', response.message || 'Suficiencia Presupuestal enviada exitosamente.', 'success');
        this.router.navigate(['/ordenpedido/oplist']);
        this.setGlobalLoading(false);
      },
      error: (error: any) => {
        let errorMessage = 'No se pudo enviar la Suficiencia Presupuestal';
        if (error.status === 400 && error.error?.errors) {
          errorMessage = Object.values(error.error.errors).flat().join('<br>');
        } else if (error.status === 401) {
          errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
          this.authService.logout();
          this.router.navigate(['/auth/login']);
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }
        Swal.fire('Error', errorMessage, 'error');
        this.setGlobalLoading(false);
      }
    });
    }
  
    
    submit(): void {
    console.log('Modo actual:', this.mode);
    console.log('Validadores del formulario:', this.orderForm.validator);
    console.log('Estado del formulario:', this.orderForm.status);
    console.log('Errores del formulario:', this.orderForm.errors);
    console.log('DEBUG submit', {
    mode: this.mode,
    perms: this.authService.currentUserValue?.permissions,
    canUpdate: this.authService.hasPermission('orders.update'),
    canAssign: this.authService.hasPermission('orders.assign_partidas'),
    canCreate: this.authService.hasPermission('orders.create_sf'),
    canAddOP: this.authService.hasPermission('orders.add_order_number'),
    canReceive: this.authService.hasPermission('orders.receive'),
  });
  
    if (this.orderForm.invalid) {
      console.log('Formulario inválido. Errores:', this.orderForm.errors);
      console.log('Errores por campo:', this.getFormValidationErrors());
      
      this.orderForm.markAllAsTouched();
      const errors = this.getFormValidationErrors() || [];
      Swal.fire({
        title: 'Error',
        html: errors.length ? `Corrige los siguientes errores:<br>${errors.join('<br>')}` 
        : 'Completa todos los campos requeridos.',
        icon: 'error'
      });
      return;
    }
  
    // 2) Tomar todos los valores (incluyendo deshabilitados)
    const formValue = JSON.parse(JSON.stringify(this.orderForm.getRawValue())); 
    formValue.concept_total = this.parseCurrency(this.financialDisplays['concept_total']);
    formValue.iva           = this.parseCurrency(this.financialDisplays['iva']);
    formValue.isr_retention = this.parseCurrency(this.financialDisplays['isr_retention']);
    formValue.total         = this.parseCurrency(this.financialDisplays['total']);
  
    formValue.provider_id          = Number(formValue.provider_id);
    formValue.requester_area_id    = Number(formValue.requester_area_id);
    formValue.requester_subarea_id = formValue.requester_subarea_id ? Number(formValue.requester_subarea_id) : null;
  
    // 3) Determinar status según el modo
    let computedStatus: string | null = formValue.status || null;
    
    //STATUS DE BD 'pending_sf_validation','validate_sf','pending_warehouse','partially_received','completed'
  
    if (this.mode === 'create_sf') {
      computedStatus = 'pending_sf_validation';
    } else if (this.mode === 'validate_sf' && this.authService.hasPermission('orders.assign_partidas')) {
      computedStatus = 'validate_sf';
    } else if (this.mode === 'update' && this.authService.hasPermission('orders.update')) {
      computedStatus = formValue.status || 'pending_sf_validation';
    } else if ((this.mode === 'add_order_number') && this.authService.hasPermission('orders.add_order_number')) {
      computedStatus = 'pending_warehouse';
    } else if (this.mode === 'receive' && this.authService.hasPermission('orders.receive')) {
      const items = (this.productsFormArray?.getRawValue?.() || []).map((p: any) => ({
        quantity: Number(p.quantity) || 0,
        received_quantity: Number(p.received_quantity) || 0
      }));
      const allReceived = items.length > 0 && items.every(p => p.received_quantity >= p.quantity && p.quantity > 0);
      const anyReceived = items.some(p => p.received_quantity > 0);
      computedStatus = allReceived ? 'completed' : (anyReceived ? 'partially_received' : 'pending_warehouse');
    }
  
    // 4) Armar payload limpio
    const cleanedFormValue = {
      ...formValue,
      order_number: this.mode === 'create_sf' ? null : formValue.order_number,
      subsidio_estatal: formValue.subsidio_estatal ?? false,
      ingresos_propios: formValue.ingresos_propios ?? false,
      federal: formValue.federal ?? false,
      mixto: formValue.mixto ?? false,
      products: formValue.products.map((product: any) => ({
        id: product.id || null,
        product_id: Number(product.product_id),
        progresivo: product.progresivo,
        ur_progressive: product.ur_progressive,
        quantity: Number(product.quantity),
        unit_id: Number(product.unit_id),
        description: product.description,
        unit_price: Number(product.unit_price),
        amount: Number(product.quantity) * Number(product.unit_price),
        brand: product.brand || null,
        marca_id: product.marca_id ? Number(product.marca_id) : null,
        tipo_id: product.tipo_id ? Number(product.tipo_id) : null,
        placa: product.placa || null,
        modelo: product.modelo || null,
        cilindro: product.cilindro || null,
        oficio: product.oficio || null,
        grupo: product.grupo || null,
        subgrupo: product.subgrupo || null,
        observations: product.observations || null,
        received_quantity: Number(product.received_quantity) || 0,
        is_delivered: product.is_delivered || false,
        partida: this.mode === 'create_sf' ? null : product.partida
      })),
      status: computedStatus
    };
  
    console.log('SUBMIT financials -> concept_total(form):', this.orderForm.get('concept_total')?.value,
              'iva(form):', this.orderForm.get('iva')?.value,
              'isr(form):', this.orderForm.get('isr_retention')?.value,
              'total(form):', this.orderForm.get('total')?.value,
              'financialDisplays:', this.financialDisplays,
              'ivaEditing:', this.ivaEditing, 'isrEditing:', this.isrEditing);
    // Limpieza de auxiliares
    delete cleanedFormValue.provider_name;
    delete cleanedFormValue.requester_area_name;
    delete cleanedFormValue.requester_subarea_name;
    cleanedFormValue.products.forEach((product: any) => {
      delete product.selectedProduct;
      delete product.amount;
    });
  
    let action: Observable<any>;
    let successMessage = '';
  
    // 5) Selección de acción
    if (this.mode === 'create_sf' && this.authService.hasPermission('orders.create_sf')) {
      action = this.orderService.createSuficiencia(cleanedFormValue);
      successMessage = `Suficiencia Presupuestal ${cleanedFormValue.foliosf} creada exitosamente.`;
  
    } else if (this.mode === 'validate_sf' && this.authService.hasPermission('orders.assign_partidas')) {
      action = this.orderService.validateSuficiencia(this.orderId!, cleanedFormValue);
      successMessage = `Suficiencia Presupuestal ${cleanedFormValue.foliosf} validada exitosamente.`;
  
    } else if (this.mode === 'add_order_number' && this.authService.hasPermission('orders.add_order_number')) {
      action = this.orderService.validateOrder(this.orderId!, cleanedFormValue);
      successMessage = `Orden de pedido ${cleanedFormValue.order_number} validada y enviada al almacén.`;
  
    } else if (this.mode === 'update' && this.authService.hasPermission('orders.update')) {
      action = this.orderService.update(this.orderId!, cleanedFormValue);
      successMessage = `Orden o Suficiencia ${cleanedFormValue.order_number} actualizada exitosamente.`;
  
    } else if (this.mode === 'receive' && this.authService.hasPermission('orders.receive')) {
      action = this.orderService.receiveProducts(this.orderId!, cleanedFormValue);
      successMessage = cleanedFormValue.status === 'completed'
        ? `Recepción COMPLETA registrada para la orden ${cleanedFormValue.order_number}.`
        : `Recepción PARCIAL registrada para la orden ${cleanedFormValue.order_number}.`;
    } else {
      Swal.fire('Error', 'No tienes permisos para realizar esta acción.', 'error');
      return;
    }
  
    this.setGlobalLoading(true);
    action.pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        localStorage.removeItem('orderFormDraft');
  
        const orderId =
          (response?.data?.id) ??
          (response?.order?.id) ??
          (response?.id) ??
          (response?.order_id) ??  // ← para save*Pdf
          this.orderId;
        const orderData = response?.data || response?.order || response || {};
        //const orderId = Number(orderData?.id || this.orderId);
  
        const folio   = cleanedFormValue.foliosf;
        const ordNum  = cleanedFormValue.order_number;
  
        const notify = (message: string) => {
          const userId = this.authService.currentUserValue?.id;
          if (!userId || !orderId) return;
          this.orderService.createNotification({
            user_id: userId,
            order_request_id: orderId,
            message
          }).subscribe();
        };
  
  
        // Notificaciones
        if (this.mode === 'create_sf') {
          notify(`Nueva suficiencia presupuestal creada con FOLIO: ${folio}`);
        } else if (this.mode === 'validate_sf') {
          notify(`Suficiencia ${folio} Validada. Favor de asignar Número de Orden.`);
        } else if (this.mode === 'add_order_number' || this.mode === 'validate') {
          notify(`Orden ${ordNum} enviada a Almacén para recepción (estatus: ${cleanedFormValue.status}).`);
        } else if (this.mode === 'receive') {
          notify(`Recepción ${cleanedFormValue.status === 'completed' ? 'COMPLETA' : 'PARCIAL'} registrada para orden ${ordNum}.`);
        }
  
        // Generar PDFs
        if (this.mode === 'create_sf' || this.mode === 'validate_sf') {
          this.generateAndSaveSuficienciaPdf(orderId);
        } else if (this.mode === 'add_order_number' || this.mode === 'validate') {
          this.generateAndSaveOrderPdf(orderId);
        }
  
        Swal.fire({
            title: 'Éxito',
            text: `${successMessage} ¿Deseas ${this.mode === 'validate_sf' || this.mode === 'create_sf' ? 'crear otra' : 'volver a la lista'}?`,
            icon: 'success',
            showCancelButton: true,
            confirmButtonText: this.mode === 'validate_sf' || this.mode === 'create_sf' ? 'SÍ' : 'Volver',
            cancelButtonText: this.mode === 'validate_sf' || this.mode === 'create_sf' ? 'NO' : 'Quedarme'
          }).then(result => {
            this.setGlobalLoading(false);
            
            if (result.isConfirmed) {
              if (this.mode === 'validate_sf' || this.mode === 'create_sf') {
                this.resetFormState(); 
                this.router.navigate(['/ordenpedido/oplist']);
              } else {
                this.router.navigate(['/ordenpedido/oplist']);
              }
            }else {
              this.router.navigate(['/ordenpedido/oplist']);
            }
          });
      },
      error: (error: any) => {
        let errorMessage = 'No se pudo procesar la orden';
        if (error.status === 400 && error.error?.errors) {
          errorMessage = Object.values(error.error.errors).flat().join('<br>');
          this.router.navigate(['/ordenpedido/oplist']);
        } else if (error.status === 401) {
          errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
          this.authService.logout();
          this.router.navigate(['/auth/login']);
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }
        Swal.fire('Error', errorMessage, 'error');
        this.setGlobalLoading(false);
      }
    });
    }
  
  
    /** Devuelve la base pública (sin /api) para armar /storage/... */
  private getPublicBase(): string {
    // Si URL_SERVICIOS = http://127.0.0.1:8000/api  => devuelve http://127.0.0.1:8000
    return URL_SERVICIOS.replace(/\/api\/?$/, '');
  }
  
  /** Abre en nueva pestaña una ruta almacenada en storage público */
  private openStorageFile(relativePath: string) {
    // relativePath = 'suficiencias/suficiencia_73_1759008729.pdf'
    const url = `${this.getPublicBase()}/storage/${relativePath}`;
    window.open(url, '_blank');
  }
  
  /** Generar y abrir PDF de Suficiencia */
  generateAndSaveSuficienciaPdf(orderId: number) {
    this.orderService.saveSuficienciaPdf(orderId).subscribe({
      next: (res) => {
        const path = res?.suficiencia_pdf_path;
        this.setGlobalLoading(false);
        if (path) {
          this.openStorageFile(path);
        } 
      },
      error: (error) => {
        let errorMessage = 'No se pudo generar el PDF de la Suficiencia Presupuestal';
        if (error.status === 400 && error.error?.errors) {
          errorMessage = Object.values(error.error.errors).flat().join('<br>');
        } else if (error.status === 401) {
          errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
          this.authService.logout();
          this.router.navigate(['/auth/login']);
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }
        this.showToast(errorMessage, 'error');
        this.setGlobalLoading(false);
      }
    });
  }
  
  // **Función para generar y guardar PDF de Orden de Pedido**
  generateAndSaveOrderPdf(orderId: number): void {
    this.setGlobalLoading(true);
    this.orderService.saveOrderPdf(orderId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        const path = response.pdf_path || null;
        this.setGlobalLoading(false);
        if (path) {
          this.openStorageFile(path);
        } 
  
        // **Extra**: Enviar al proveedor si aplica
        this.orderService.sendOrderPdf(orderId).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => console.log('PDF enviado al proveedor'),
          error: (error) => console.error('Error al enviar el PDF al proveedor:', error)
        });
      },
      error: (error) => {
        let errorMessage = 'No se pudo generar el PDF de la Orden de Pedido';
        if (error.status === 400 && error.error?.errors) {
          errorMessage = Object.values(error.error.errors).flat().join('<br>');
        } else if (error.status === 401) {
          errorMessage = 'Sesión expirada. Por favor, inicia sesión nuevamente.';
          this.authService.logout();
          this.router.navigate(['/auth/login']);
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }
        this.showToast(errorMessage, 'error');
        this.setGlobalLoading(false);
      }
    });
  }
  
  
  
    private showToast(message: string, type: 'success' | 'error' | 'info' = 'success') {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: type,
        title: message,
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true
      });
    }
   
  
    // **AÑADIDO**: Método para descargar el PDF
    downloadPdf(): void {
      if (!this.orderId || !this.pdfUrl) {
        Swal.fire('Error', 'No hay PDF disponible para descargar', 'error');
        return;
      }
      this.orderService.getOrderPdf(this.orderId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = this.mode === 'validate_sf' ? `suficiencia_${this.orderForm.get('foliosf')?.value}.pdf` : `Orden_${this.orderForm.get('order_number')?.value}.pdf`;
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          Swal.fire('Error', 'No se pudo descargar el PDF', 'error');
        }
      });
    }
  
    private getFormValidationErrors(): string[] {
      // **SIN CAMBIOS**
      const errors: string[] = [];
      const errorMessages: { [key: string]: string } = {
        required: 'Es obligatorio',
        min: 'Debe ser mayor o igual a 0',
        atLeastOneFinancingType: 'Debe seleccionar al menos un tipo de financiamiento'
      };
  
      Object.keys(this.orderForm.controls).forEach(key => {
        const control = this.orderForm.get(key);
        const controlErrors = control?.errors;
        if (controlErrors) {
          Object.keys(controlErrors).forEach(errorKey => {
            errors.push(`Campo "${key}": ${errorMessages[errorKey] || errorKey}`);
          });
        }
      });
  
      this.productsFormArray.controls.forEach((productGroup: AbstractControl, index: number) => {
        const productForm = productGroup as FormGroup;
        Object.keys(productForm.controls).forEach(key => {
          const control = productForm.get(key);
          const controlErrors = control?.errors;
          if (controlErrors) {
            Object.keys(controlErrors).forEach(errorKey => {
              errors.push(`Producto ${index + 1} - Campo "${key}": ${errorMessages[errorKey] || errorKey}`);
            });
          }
        });
      });
  
      return errors;
    }
  
    calculateProductAmount(index: number): void {
      // **SIN CAMBIOS**
      const product = this.productsFormArray.at(index);
      const quantity = new Decimal(product.get('quantity')?.value || 0);
      const unitPrice = new Decimal(product.get('unit_price')?.value || 0);
      const amount = quantity.mul(unitPrice);
      product.get('amount')?.setValue(amount.toNumber(), { emitEvent: false });
      this.calculateProductAmounts();
    }
  
    
    updateUnitPrice(index: number, value: string): void {
      // **SIN CAMBIOS**
      const numericValue = this.parseCurrency(value);
      this.productsFormArray.at(index).get('unit_price')?.setValue(numericValue, { emitEvent: false });
      this.unitPriceRaw[index] = value;
      this.calculateProductAmount(index);
    }
  
    formatUnitPrice(index: number): void {
      // **SIN CAMBIOS**
      const numericValue = this.productsFormArray.at(index).get('unit_price')?.value || 0;
      this.unitPriceRaw[index] = this.formatCurrency(numericValue);
      this.calculateProductAmount(index);
    }
  
    
    formatIva(): void {
      // **SIN CAMBIOS**
      const ivaValue = this.orderForm.get('iva')?.value || 0;
      this.financialDisplays['iva'] = this.formatCurrency(ivaValue);
    }
  
    updateIsrRetention(value: string): void {
      // **SIN CAMBIOS**
      const numericValue = this.parseCurrency(value);
      this.orderForm.get('isr_retention')?.setValue(numericValue, { emitEvent: false });
      this.financialDisplays['isr_retention'] = this.formatCurrency(numericValue);
      if (!this.isAutoCalculation) this.calculateTotals();
    }
  
    formatIsrRetention(): void {
      // **SIN CAMBIOS**
      const isrValue = this.orderForm.get('isr_retention')?.value || 0;
      this.financialDisplays['isr_retention'] = this.formatCurrency(isrValue);
    }
  
    
    formatCurrenc(value: number | null | undefined): string {
      // **SIN CAMBIOS**
      return (value ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  
    
    toUpperCase(event: Event): void {
      // **SIN CAMBIOS**
      const input = event.target as HTMLInputElement;
      input.value = input.value.toUpperCase();
      const controlName = input.getAttribute('formControlName');
      if (controlName) {
        const control = this.orderForm.get(controlName) || this.newProductForm.get(controlName);
        if (control) control.setValue(input.value, { emitEvent: false });
      } else {
        const ngModelName = input.getAttribute('ngModel');
        if (ngModelName === 'providerSearchQuery') this.providerSearchQuery = input.value;
        else if (ngModelName === 'subareaSearchQuery') this.subareaSearchQuery = input.value;
        else if (ngModelName === 'productSearchQueries[showProductModal || 0]') {
          this.productSearchQueries[this.showProductModal || 0] = input.value;
        }
      }
    }
  
    toggleAddProductForm(): void {
      // **SIN CAMBIOS**
      this.showAddProductForm = !this.showAddProductForm;
      if (!this.showAddProductForm) {
        this.newProductForm.reset();
        this.productCreatedMessage = '';
      }
    }
  
   
  
  
    onProductCategoryChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const categoryId = target?.value ? parseInt(target.value, 10) : null;
  
    if (!categoryId) return;
  
    const selectedCategory = this.productCategories.find(cat => cat.id === categoryId);
    const isAutomotriz = selectedCategory?.name?.toUpperCase().includes('REFACCIONES AUTOMOTRICES');
    this.showAutomotrizFields = isAutomotriz;
  
    // 🔹 Detectar si estamos en el modo de creación rápida
    const isQuickCreate = this.showCreateProductModal === true;
  
    if (isAutomotriz) {
      if (isQuickCreate) {
        // ✅ Modal rápido: desactivar validadores automotrices
        ['marca_id', 'tipo_id', 'modelo', 'cilindro', 'numeroeco', 'placa'].forEach(campo => {
          const ctrl = this.newProductForm.get(campo);
          ctrl?.clearValidators();
          ctrl?.setErrors(null);
          ctrl?.updateValueAndValidity({ emitEvent: false });
        });
      } else {
        // 🧩 Modo completo (órdenes): activar validaciones automotrices normales
        ['marca_id', 'tipo_id', 'modelo', 'cilindro', 'numeroeco', 'placa'].forEach(campo => {
          const ctrl = this.newProductForm.get(campo);
          ctrl?.setValidators(Validators.required);
          ctrl?.updateValueAndValidity({ emitEvent: false });
        });
      }
    } else {
      // 🔸 Categorías normales — limpiar validaciones automotrices
      ['marca_id', 'tipo_id', 'modelo', 'cilindro', 'numeroeco', 'placa'].forEach(campo => {
        const ctrl = this.newProductForm.get(campo);
        ctrl?.clearValidators();
        ctrl?.setErrors(null);
        ctrl?.updateValueAndValidity({ emitEvent: false });
      });
    }
  
    this.newProductForm.updateValueAndValidity();
  }
  
  
    getPageNumbers(totalItems: number): number[] {
      // **SIN CAMBIOS**
      const totalPages = Math.ceil(totalItems / this.itemsPerPage);
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
  
    public cancel(): void {
      // **SIN CAMBIOS**
      this.router.navigate(['/ordenpedido/oplist']);
    }
  
   
    // Mostrar notificación estilo post-it
    showNotification(type: 'success' | 'error', message: string) {
    Swal.fire({
      title: type === 'success' ? '¡Éxito!' : '¡Error!',
      text: message,
      icon: type,
      background: '#fff3cd', // Fondo amarillo estilo post-it
      customClass: {
        popup: 'post-it-notification',
      },
      showConfirmButton: false,
      timer: 3000,
      position: 'top-end',
    });
  
    if (this.user && this.user.id && this.orderId) {
      this.orderService.createNotification({
        user_id: this.user.id,
        order_request_id: this.orderId,
        message,
        }).subscribe({
          error: (err) => console.error('Error al registrar notificación:', err),
        });
      }
    }
  
    markNotificationAsRead(notificationId: number): void {
    this.orderService.markNotificationAsRead(notificationId).subscribe({
      next: () => {
        this.notifications = this.notifications.map(n =>
          n.id === notificationId ? { ...n, is_read: true } : n
        );
      },
      error: (err) => {
        console.error('Error al marcar notificación como leída:', err);
      }
    });
  }
  
    uploadInvoice() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf';
      input.onchange = (event: any) => {
        const file = event.target.files[0];
        if (file) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('order_request_id', String(this.orderId || ''));
          this.orderService.createInvoice(formData).subscribe({
            next: (response) => this.showNotification('success', response.message),
            error: (err) => this.showNotification('error', err.message),
          });
        }
      };
      input.click();
    }
  
    validateReceivedQuantity(index: number) {
      const product = this.productsFormArray.at(index);
      const quantity = product.get('quantity')!.value;
      const received = product.get('received_quantity')!.value;
      if (received > quantity || received < 0) {
        product.get('received_quantity')!.setErrors({ invalidReceivedQuantity: true });
      } else {
        product.get('received_quantity')!.setErrors(null);
      }
    }
  
  
    //Nuevos modales para vehiculos
  
    // ✅ Abrir modal de vehículos
    openVehiculoModal(index: number): void {
      this.showVehiculoModal = index;
      this.vehiculoSearchQuery = '';
      
      // Cargar vehículos si no están cargados
      if (this.allVehiculos.length === 0) {
        this.loadVehiculos();
      } else {
        this.filteredVehiculos = [...this.allVehiculos];
      }
    }
  
  // ✅ Cerrar modal de vehículos
    closeVehiculoModal(): void {
      this.showVehiculoModal = null;
      this.vehiculoSearchQuery = '';
    }
  
  // ✅ Cargar vehículos desde API
    loadVehiculos(): void {
      this.setGlobalLoading(true);
      this.orderService.getVehiculos().pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (data: any) => {
          this.allVehiculos = data.vehiculos || [];
          this.filteredVehiculos = [...this.allVehiculos];
          this.setGlobalLoading(false);
        },
        error: (error) => {
          console.error('Error loading vehicles:', error);
          this.filteredVehiculos = [];
          this.setGlobalLoading(false);
          Swal.fire('Error', 'No se pudieron cargar los vehículos', 'error');
        }
      });
    }
  
  // ✅ Búsqueda en tiempo real
    onVehiculoSearchChange(query: string): void {
      this.vehiculoSearchQuery = query;
      this.filterVehiculos(query);
    }
  
  // ✅ Filtrado local de vehículos
    filterVehiculos(query: string): void {
      if (!query || query.trim() === '') {
        this.filteredVehiculos = [...this.allVehiculos];
        return;
      }
      
      const queryLower = query.toLowerCase();
      this.filteredVehiculos = this.allVehiculos.filter(vehiculo =>
        (vehiculo.placa && vehiculo.placa.toLowerCase().includes(queryLower)) ||
        (vehiculo.numero_eco && vehiculo.numero_eco.toLowerCase().includes(queryLower)) ||
        (vehiculo.numero_serie && vehiculo.numero_serie.toLowerCase().includes(queryLower)) ||
        (vehiculo.marca?.nombre && vehiculo.marca.nombre.toLowerCase().includes(queryLower)) ||
        (vehiculo.tipo?.nombre && vehiculo.tipo.nombre.toLowerCase().includes(queryLower)) ||
        (vehiculo.modelo && vehiculo.modelo.toString().includes(query))
      );
    }
  
  // ✅ Seleccionar vehículo
    selectVehiculo(vehiculo: any, event?: Event): void {
      console.log('Vehiculo seleccionado:',vehiculo);
      console.log('Formulario destino:', this.productsFormArray.at(this.showVehiculoModal!).value);
      if (event) {
        event.stopPropagation();
      }
      
      if (!vehiculo || this.showVehiculoModal ===null) {
        Swal.fire('Error', 'Vehículo no válido', 'error');
        return;
      }
  
      const index =this.showVehiculoModal;
      const productForm = this.productsFormArray.at(index) as FormGroup;
  
      console.log('Vehículo seleccionado:', vehiculo);
      console.log('Campos del formulario:', productForm.controls);
      
      productForm.patchValue({
        placa: vehiculo.placa || '',
        marca_id: vehiculo.marca_id || '',
        marca_nombre: vehiculo.marca?.nombre || '',
        tipo_id: vehiculo.tipo_id || '',
        tipo_nombre: vehiculo.tipo?.nombre || '',
        modelo: vehiculo.modelo || '',
        cilindro: vehiculo.cilindro || ''
      }, { emitEvent: false });
  
      // ✅ Marcar como touched para mostrar validación
      productForm.get('placa')?.markAsTouched();
      productForm.get('marca_nombre')?.markAsTouched();
      productForm.get('tipo_nombre')?.markAsTouched();
      productForm.get('modelo')?.markAsTouched();
      productForm.get('cilindro')?.markAsTouched();
  
      this.closeVehiculoModal();
      
      // Feedback al usuario
      Swal.fire('Éxito', `Vehículo ${vehiculo.numero_eco} seleccionado`, 'success');
    }
  
  // ✅ Resetear búsqueda
    resetVehiculoSearch(): void {
      this.vehiculoSearchQuery = '';
      this.filterVehiculos('');
    }
  
    
  // Buscar vehículos
    searchVehiculos(query: string): void {
      this.vehiculoSearchQuery = query;
      this.filteredVehiculos = query
        ? this.allVehiculos.filter(vehiculo =>
            vehiculo.placa.toLowerCase().includes(query.toLowerCase()) ||
            (vehiculo.marca?.nombre && vehiculo.marca.nombre.toLowerCase().includes(query.toLowerCase())) ||
            (vehiculo.tipo?.nombre && vehiculo.tipo.nombre.toLowerCase().includes(query.toLowerCase())) ||
            vehiculo.modelo.toString().includes(query))
        : [...this.allVehiculos];
    }
  
    adjustTextareaHeight(event: Event): void {
      const textarea = event.target as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto'; 
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }
  
  /**
   * Ajusta automáticamente todos los textareas de descripción
   * después de cargar datos desde la API
   */
    adjustAllTextareas(): void {
      setTimeout(() => {
        const textareas = document.querySelectorAll<HTMLTextAreaElement>('.input-description');
        textareas.forEach(textarea => {
          textarea.style.height = 'auto';
          textarea.style.height = `${textarea.scrollHeight}px`;
        });
      }, 50); // pequeño delay para esperar render
    }
  
  
  
  // Validar foliosf al salir del campo
    validateFoliosf(value: string): void {
    const control = this.orderForm.get('foliosf');
    if (!value || !control) return;
  
    this.orderService.checkUnique('foliosf', value).subscribe({
      next: (isUnique: boolean) => {
        if (!isUnique) {
          control.setErrors({ notUnique: true });
        } else {
          if (control.hasError('notUnique')) {
            control.setErrors(null);
          }
        }
      },
      error: (err) => console.error('Error validando folio:', err)
    });
    }
  
    // Validar order_number al salir del campo
    validateOrderNumber(value: string): void {
    const control = this.orderForm.get('order_number');
    if (!value || !control) return;
  
    this.orderService.checkUnique('order_number', value).subscribe({
      next: (isUnique: boolean) => {
        if (!isUnique) {
          control.setErrors({ notUnique: true });
        } else {
          if (control.hasError('notUnique')) {
            control.setErrors(null);
          }
        }
      },
      error: (err) => {
        console.error('Error validando número de orden:', err);
      }
    });
    }

 /*
    setFormPermissions(): void {   // permisos segun modo 
      // Deshabilitar todo por defecto
      this.orderForm.disable({ emitEvent: false });
      this.productsFormArray.controls.forEach(control => control.disable({ emitEvent: false }));
  
      switch (this.mode) {
        case 'create_sf':
          // ✅ Crear suficiencia presupuestal
          this.orderForm.get('foliosf')?.enable({ emitEvent: false });
          this.orderForm.get('date')?.enable({ emitEvent: false });
          this.orderForm.get('date_limited')?.enable({ emitEvent: false });
          this.orderForm.get('format_type')?.enable({ emitEvent: false });
          this.orderForm.get('process')?.enable({ emitEvent: false });
          this.orderForm.get('provider_id')?.enable({ emitEvent: false });
          this.orderForm.get('provider_name')?.enable({ emitEvent: false });
          this.orderForm.get('requester_area_id')?.enable({ emitEvent: false });
          this.orderForm.get('requester_area_name')?.enable({ emitEvent: false });
          this.orderForm.get('requester_subarea_id')?.enable({ emitEvent: false });
          this.orderForm.get('requester_subarea_name')?.enable({ emitEvent: false });
          this.orderForm.get('ur')?.enable({ emitEvent: false });
          this.orderForm.get('delivery_place')?.enable({ emitEvent: false });
          this.orderForm.get('no_beneficiarios')?.enable({ emitEvent: false });
  
          this.productsFormArray.controls.forEach(control => {
            control.get('oficio')?.enable({ emitEvent: false });
            control.get('ur_progressive')?.enable({ emitEvent: false });
            control.get('placa')?.enable({ emitEvent: false });
            control.get('marca_nombre')?.enable({ emitEvent: false });
            control.get('tipo_nombre')?.enable({ emitEvent: false });
            control.get('modelo')?.enable({ emitEvent: false });
            control.get('cilindro')?.enable({ emitEvent: false });
            control.get('grupo')?.enable({ emitEvent: false });
            control.get('subgrupo')?.enable({ emitEvent: false });
            control.get('progresivo')?.enable({ emitEvent: false });
            control.get('description')?.enable({ emitEvent: false });
            control.get('brand')?.enable({ emitEvent: false });
            control.get('unit_id')?.enable({ emitEvent: false });
            control.get('quantity')?.enable({ emitEvent: false });
            control.get('unit_price')?.enable({ emitEvent: false });
            control.get('amount')?.enable({ emitEvent: false });
          });
          this.canaddProduct = true;  //deshabilitar boton para gregar productos
          break;
  
        case 'validate_sf':
          // ✅ Área 2: financiamiento + partida en productos
          this.orderForm.get('subsidio_estatal')?.enable({ emitEvent: false });
          this.orderForm.get('ingresos_propios')?.enable({ emitEvent: false });
          this.orderForm.get('federal')?.enable({ emitEvent: false });
          this.orderForm.get('mixto')?.enable({ emitEvent: false });
  
          this.productsFormArray.controls.forEach(control => {
            // Habilitar solo partida y observaciones
            control.get('partida')?.enable({ emitEvent: false });
            control.get('observations')?.enable({ emitEvent: false });
  
            // Deshabilitar los demás campos
            control.get('unit_price')?.disable({ emitEvent: false });
            control.get('quantity')?.disable({ emitEvent: false });
            control.get('amount')?.disable({ emitEvent: false });
          });
  
            
          // Bloquear también campos generales que no se editan en este modo
          this.orderForm.get('provider_id')?.disable({ emitEvent: false });
          this.orderForm.get('foliosf')?.disable({ emitEvent: false });
          this.orderForm.get('order_number')?.disable({ emitEvent: false });
  
          this.canaddProduct = false;  //deshabilitar boton para gregar productos
          break;
  
        case 'add_order_number':
          // ✅ Área 1: solo puede validar
          this.orderForm.get('order_number')?.enable({ emitEvent: false });
          this.orderForm.get('date_limited')?.enable({ emitEvent: false });
          this.orderForm.get('general_observations')?.enable({ emitEvent: false });
  
          this.canaddProduct = false;  //deshabilitar boton para gregar productos
          break;
  
        case 'receive':
          // ✅ Almacén: recepción
          this.productsFormArray.controls.forEach(control => {
            control.get('received_quantity')?.enable({ emitEvent: false });
            control.get('is_delivered')?.enable({ emitEvent: false });
            this.canaddProduct = false;  //deshabilitar boton para gregar productos
          });
          break;
  
        case 'update':
          // ✅ Crear / Editar orden
          this.orderForm.get('order_number')?.enable({ emitEvent: false });
          this.orderForm.get('foliosf')?.enable({ emitEvent: false });
          this.orderForm.get('date')?.enable({ emitEvent: false });
          this.orderForm.get('date_limited')?.enable({ emitEvent: false });
          this.orderForm.get('format_type')?.enable({ emitEvent: false });
          this.orderForm.get('process')?.enable({ emitEvent: false });
          this.orderForm.get('provider_id')?.enable({ emitEvent: false });
          this.orderForm.get('provider_name')?.enable({ emitEvent: false });
          this.orderForm.get('requester_area_id')?.enable({ emitEvent: false });
          this.orderForm.get('requester_area_name')?.enable({ emitEvent: false });
          this.orderForm.get('requester_subarea_id')?.enable({ emitEvent: false });
          this.orderForm.get('requester_subarea_name')?.enable({ emitEvent: false });
          this.orderForm.get('ur')?.enable({ emitEvent: false });
          this.orderForm.get('delivery_place')?.enable({ emitEvent: false });
          this.orderForm.get('no_beneficiarios')?.enable({ emitEvent: false });
  
          this.productsFormArray.controls.forEach(control => {
            control.get('oficio')?.enable({ emitEvent: false });
            control.get('ur_progressive')?.enable({ emitEvent: false });
            control.get('placa')?.enable({ emitEvent: false });
            control.get('marca_nombre')?.enable({ emitEvent: false });
            control.get('tipo_nombre')?.enable({ emitEvent: false });
            control.get('modelo')?.enable({ emitEvent: false });
            control.get('cilindro')?.enable({ emitEvent: false });
            control.get('grupo')?.enable({ emitEvent: false });
            control.get('subgrupo')?.enable({ emitEvent: false });
            control.get('progresivo')?.enable({ emitEvent: false });
            control.get('description')?.enable({ emitEvent: false });
            control.get('brand')?.enable({ emitEvent: false });
            control.get('unit_id')?.enable({ emitEvent: false });
            control.get('quantity')?.enable({ emitEvent: false });
            control.get('unit_price')?.enable({ emitEvent: false });
            control.get('amount')?.enable({ emitEvent: false });
            if (this.authService.hasPermission('orders.update')) {
                this.orderForm.enable({ emitEvent: false });
                this.productsFormArray.controls.forEach(c => c.enable({ emitEvent: false }));
              }
            this.canaddProduct = true;  //deshabilitar boton para gregar productos
          });
          break;
  
        default:
          this.orderForm.disable({ emitEvent: false });
          this.productsFormArray.controls.forEach(control => control.disable({ emitEvent: false }));
          break;
      }
    }
  */
    
    /*
    checkPermissions(): boolean {
    const mode = this.mode || 'create_sf';
    let requiredPermission = '';
  
    switch (mode) {
      case 'create_sf':
        requiredPermission = 'orders.create_sf';  // Area1 crear suficiencia
        break;
      case 'validate_sf':
        requiredPermission = 'orders.assign_partidas'; // Area 2 asignar partida y tipos financiamiento
        break;
      case 'add_order_number':
        requiredPermission = 'orders.add_order_number'; // Area 1 add order number
        break;
      case 'receive':
        requiredPermission = 'orders.receive'; // Area 3 recibir productos
        break;
      case 'update':
        requiredPermission = 'orders.update'; // Area1 Actualizar Orden o SF  ??? Debe de haber una para cada caso
        break;
      case 'view':
        requiredPermission = 'orders.view'; // vistas pdf 
        break;
      default:
        requiredPermission = 'orders.list'; // vista general con filtro para cada Area
        break;
    }
  
    const hasPermission = this.authService.hasPermission(requiredPermission);
  
    console.log(`🔍 Modo: ${mode} | Permiso requerido: ${requiredPermission} | Tiene permiso?: ${hasPermission}`);
  
    return hasPermission;
  }
  */
  /*
    // Determinar si el formulario es válido para habilitar el botón
    isFormValid(form: any): boolean {
      return form.valid && this.isFoliosfValid && (!this.isValidationMode || this.isOrderNumberValid);
    }
  */
    /*
    submitForm(data: any) {
      if (this.isValidationMode) {
        this.validateOrder(data);
      } else {
        this.createSuficiencia(data);
      }
    }
  */
    /*
  createSuficiencia(data: any) {
    // Loading
    Swal.fire({
      title: 'Procesando...',
      text: 'Creando suficiencia presupuestal, por favor espera.',
      allowOutsideClick: false,
      showConfirmButton: false,
      willOpen: () => {
        Swal.showLoading(null);
      }
    });
  
    this.orderService.createSuficiencia(data).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        //Swal.close(); // cierra el loading
  
        // Modal con opciones (no se autocierran)
        Swal.fire({
          icon: 'success',
          title: '¡Suficiencia creada!',
          text: response.message || 'Suficiencia presupuestal creada exitosamente.',
          showCancelButton: true,
          showDenyButton: true,
          confirmButtonText: 'Enviar a Contabilidad',
          denyButtonText: 'Crear otra',
          cancelButtonText: 'Salir',
          allowOutsideClick: false,
          allowEscapeKey: false
        }).then(result => {
          if (result.isConfirmed) {
            // Enviar a Área 2
            Swal.fire({
              title: 'Enviando...',
              text: 'Enviando suficiencia a Contabilidad, por favor espera.',
              allowOutsideClick: false,
              showConfirmButton: false,
              willOpen: () => Swal.showLoading(null)
            });
  
            this.orderService.sendToArea2(response.order.id, { foliosf: data.foliosf }).pipe(takeUntil(this.destroy$)).subscribe({
              next: (resp) => {
                Swal.close();
                Swal.fire({
                  icon: 'success',
                  title: '¡Enviada!',
                  text: resp?.message || 'Suficiencia enviada a Contabilidad.',
                  confirmButtonText: 'Ir a la lista'
                }).then(() => {
                  this.router.navigate(['/ordenpedido/oplist']);
                });
              },
              error: (err) => {
                Swal.close();
                Swal.fire({
                  icon: 'error',
                  title: 'Error',
                  text: err?.error?.message || 'Error al enviar la suficiencia a Contabilidad.',
                  confirmButtonText: 'OK'
                });
              }
            });
  
          } else if (result.isDenied) {
            // Crear otra: limpia formulario y deja en modo create_sf
            this.resetFormState();
            this.mode = 'create_sf';
  
          } else {
            // Salir
            this.router.navigate(['/ordenpedido/oplist']);
          }
        });
      },
      error: (err) => {
        Swal.close();
        let errorMessage = err?.error?.message || 'Error al crear la suficiencia presupuestal.';
        if (err?.error?.errors?.foliosf) {
          errorMessage = 'El folio SF ya está en uso. Por favor, ingresa un folio diferente.';
        }
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: errorMessage,
          confirmButtonText: 'OK'
        });
      }
    });
  }
  
  
   // Validar suficiencia en Área 2 y generar pdf de suficiencia
    validateSuficiencia(data: any) {
  
      if (this.mode === 'validate_sf') {
  
        const f = this.orderForm.value;
  
        // ✅ Validar que al menos un financiamiento esté marcado
        const anyFinanciamiento = f.subsidio_estatal || f.ingresos_propios || f.federal || f.mixto;
        if (!anyFinanciamiento) {
          Swal.fire({
            icon: 'warning',
            title: 'Falta tipo de financiamiento',
            text: 'Selecciona al menos un tipo de financiamiento antes de continuar.',
            confirmButtonText: 'OK'
          });
          return;
        }
      
      // ✅ Validar que cada producto tenga partida
      const invalidPartida = (f.products || []).some((p: any) => !p.partida || p.partida.trim() === '');
        if (invalidPartida) {
          Swal.fire({
            icon: 'warning',
            title: 'Falta partida',
            text: 'Cada producto debe tener una partida asignada antes de validar.',
            confirmButtonText: 'OK'
          });
          return;
        }
      }
  
      this.orderService.validateSuficiencia(data.id, data).subscribe({
        next: (response) => {
          this.showNotification('success', response.message);
          this.orderService.saveSuficienciaPdf(data.id).subscribe({
            next: (pdfResponse) => this.showNotification('success', 'PDF de suficiencia generado'),
            error: (err) => this.showNotification('error', err.message),
          });
        },
        error: (err) => this.showNotification('error', err.message),
      });
    }
  
  
    validateOrder(data: any) {
    // Loading
    Swal.fire({
      title: 'Procesando...',
      text: 'Validando orden de pedido, por favor espera.',
      allowOutsideClick: false,
      showConfirmButton: false,
      willOpen: () => {
        Swal.showLoading(null);
      }
    });
  
    // Solo enviamos lo que necesita el backend (ajusta si tu API requiere más campos)
    const payload = { order_number: data.order_number };
  
    this.orderService.validateOrder(this.orderId!, payload).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        Swal.close();
  
        Swal.fire({
          icon: 'success',
          title: '¡Orden Validada!',
          text: response?.message || 'Orden de pedido validada exitosamente.',
          showDenyButton: true,
          showCancelButton: true,
          confirmButtonText: 'Ir a la lista',
          denyButtonText: 'Validar otra',
          cancelButtonText: 'Salir',
          allowOutsideClick: false,
          allowEscapeKey: false
        }).then(result => {
          if (result.isConfirmed) {
            this.router.navigate(['/ordenpedido/oplist']);
          } else if (result.isDenied) {
            // Volver a pantalla de validación para otra orden
            this.router.navigate(['/ordenpedido/oplist'], { queryParams: { mode: 'validate' } });
          } else {
            // Quedarme en la misma pantalla: no hacemos nada
          }
        });
      },
      error: (err) => {
        Swal.close();
        let errorMessage = err?.error?.message || 'Error al validar la orden de pedido.';
        if (err?.error?.errors?.order_number) {
          errorMessage = 'El número de orden ya está en uso. Por favor, ingresa un número diferente.';
        }
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: errorMessage,
          confirmButtonText: 'OK'
        });
      }
    });
  }
  
    update(data: any) {
    // Loading
    Swal.fire({
      title: 'Procesando...',
      text: 'Actualizando, por favor espera.',
      allowOutsideClick: false,
      showConfirmButton: false,
      willOpen: () => {
        Swal.showLoading(null);
      }
    });
  
      this.orderService.update(this.orderId!, data).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        Swal.close();
  
        Swal.fire({
          icon: 'success',
          title: '¡Actualizado!',
          text: response?.message || 'Actualizado exitosamente.',
          showDenyButton: true,
          showCancelButton: true,
          confirmButtonText: 'Ir a la lista',
          denyButtonText: 'Actualizar otra',
          cancelButtonText: 'Salir',
          allowOutsideClick: false,
          allowEscapeKey: false
        }).then(result => {
          if (result.isConfirmed) {
            this.router.navigate(['/ordenpedido/oplist']);
          } else if (result.isDenied) {
            // Volver a pantalla de validación para otra orden
            this.router.navigate(['/ordenpedido/oplist'], { queryParams: { mode: 'validate_sf' } });
          } else {
            // Quedarme en la misma pantalla: no hacemos nada
          }
        });
      },
      error: (err) => {
        Swal.close();
        let errorMessage = err?.error?.message || 'Error al Actualizar.';
        if (err?.error?.errors?.order_number) {
          errorMessage = 'El número de orden ya está en uso. Por favor, ingresa un número diferente.';
        }
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: errorMessage,
          confirmButtonText: 'OK'
        });
      }
    });
  }
  */
  private ignoreDraftOnce = false;
  
  private resetFormState(): void {
    try {
      // Detener cualquier spinner
      this.setGlobalLoading(false);
      this.isLoading = false;
  
      // Limpiar borrador guardado
      localStorage.removeItem('orderFormDraft');
      this.ignoreDraftOnce = true; // si usas esta bandera, declárala en la clase: ignoreDraftOnce = false;
  
      // Fechas: hoy y mañana
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(today.getDate() + 1);
  
      // Resetear formulario principal con valores por defecto
      this.orderForm.reset({
        order_number: null,
        foliosf: '',
        date: today.toISOString().split('T')[0],
        date_limited: tomorrow.toISOString().split('T')[0],
        format_type: 'PRODUCTOS',
        process: '',
        provider_id: '',
        provider_name: '',
        oficio: '',
        no_beneficiarios: '',
        requester_area_id: '',
        requester_area_name: '',
        requester_subarea_id: null,
        requester_subarea_name: '',
        ur: '',
        delivery_place: '',
        concept_total: 0,
        iva: 0,
        isr_retention: 0,
        total: 0,
        subsidio_estatal: false,
        ingresos_propios: false,
        federal: false,
        mixto: false,
        general_observations: ''
      });
  
      // Limpiar productos y auxiliares
      this.clearProducts();
           // limpia completamente la tabla de productos
      this.addProduct();        // si NO quieres un renglón vacío por defecto, comenta esta línea
  
      // Displays financieros sincronizados con el form
      this.financialDisplays = {
        concept_total: '0.00',
        iva: '0.00',
        isr_retention: '0.00',
        total: '0.00'
      };
      this.orderForm.patchValue({
        concept_total: 0,
        iva: 0,
        isr_retention: 0,
        total: 0
      }, { emitEvent: false });
  
      // Recalcular totales con el estado nuevo
      this.calculateProductAmounts(); // 👈 en plural, recalcula todo
  
      // Estados auxiliares
      this.pdfUrl = null;
      this.showProductModal = null;
      this.showProviderModal = false;
      this.showSubareaModal = false;
      this.showVehiculoModal = null;
  
      this.vehiculoSearchQuery = '';
      this.filteredVehiculos = [];
  
      this.subareaSearchQuery = '';
      this.filteredSubareas = [];
  
      this.providerSearchQuery = '';
      this.filteredProviders = [];
  
      this.showAutomotrizFields = false;
      this.isAutoCalculation = true;
  
      this.ivaEditing = this.financialDisplays['iva'];
  this.isrEditing = this.financialDisplays['isr_retention'];
  
      this.orderForm.get('iva')?.disable({ emitEvent: false });
      this.orderForm.get('isr_retention')?.disable({ emitEvent: false });
      this.applyModePermissions();
      // Ajustar textareas
      this.adjustAllTextareas();
    } catch (e) {
      console.error('[resetFormState] error reseteando formulario:', e);
      this.setGlobalLoading(false);
      this.isLoading = false;
    }
  }
  
  
  private clearProducts(): void {
    this.productsFormArray.clear();
    this.unitPriceRaw = [];
    this.filteredProducts = [];
    this.allProducts = [];
    this.productSearchQueries = [];
    this.productPages = [];
    this.tipos = {};
    this.showProductModal = null;
  }
  
  
  dateRangeValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const start = control.get('date')?.value;
    const end = control.get('date_limited')?.value;
  
    if (!start || !end) return null;
  
    const startDate = new Date(start);
    const endDate = new Date(end);
  
    // ✅ valida que la fecha límite sea al menos 1 día después
    if (endDate <= startDate) {
      return { invalidDateRange: true };
    }
    return null;
  };
  
  openDatePicker(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    if (!input) return;
  
    try {
      // showPicker solo funciona dentro de un gesto de usuario
      if (typeof (input as any).showPicker === 'function') {
        (input as any).showPicker();
      } else {
        // Fallback para navegadores sin showPicker
        input.focus();
        input.click();
      }
    } catch {
      // Silenciar NotAllowedError si el navegador fue especial
      input.focus();
    }
  }
  
  
    private enforceDisabledFields(): void {
      this.productsFormArray.controls.forEach(control => {
        const disableFields = this.mode === 'validate_sf' || this.mode === 'receive';
        const enableFields = this.mode === 'create_sf' || this.mode === 'update';
  
        if (disableFields) {
          control.get('unit_price')?.disable({ emitEvent: false });
          control.get('quantity')?.disable({ emitEvent: false });
          control.get('amount')?.disable({ emitEvent: false });
        } else if (enableFields) {
          control.get('unit_price')?.enable({ emitEvent: false });
          control.get('quantity')?.enable({ emitEvent: false });
          control.get('amount')?.enable({ emitEvent: false });
        }
      });
    }
  
  ///añadido el 11 octubre para centralizar permisos
    private verifyPermissions(): boolean {
    const permissionMap: { [key: string]: string } = {
      create_sf: 'orders.create_sf',
      validate_sf: 'orders.assign_partidas',
      add_order_number: 'orders.add_order_number',
      receive: 'orders.receive',
      update: 'orders.update',
      view: 'orders.view',
      list: 'orders.list'
    };
  
    const requiredPermission = permissionMap[this.mode] || 'orders.list';
    const hasPermission = this.authService.hasPermission(requiredPermission);
  
    if (!hasPermission) {
      Swal.fire({
        title: 'Acceso Denegado',
        text: `No tienes permisos verificado desde verifyPErmissions ${this.mode}.`,
        icon: 'error',
        confirmButtonText: 'OK'
      }).then(() => {
        this.router.navigate(['/ordenpedido/oplist']);
      });
    }
  
    return hasPermission;
  }
  
  
  private calculateProductAmountsForIndex(index: number): void {
    const control = this.productsFormArray.at(index) as FormGroup;
    if (!control) return;
  
    const qty = Number(control.get('quantity')?.value || 0);
    const price = Number(control.get('unit_price')?.value || 0);
    const amount = Number((qty * price).toFixed(2));
  
    const currentAmount = Number(control.get('amount')?.value || 0);
    if (Number(currentAmount.toFixed(2)) !== amount) {
      control.patchValue({ amount }, { emitEvent: false });
    }
  
    // Recalcula totales generales de forma segura
    this.calculateProductAmounts();
  }
  
  
  calculateProductAmounts(): void {
    const productsSnapshot = this.productsFormArray.getRawValue();
    let conceptTotal = new Decimal(0);
  
    productsSnapshot.forEach((p: any, idx: number) => {
      const quantity = new Decimal(p.quantity || 0);
      const unitPrice = new Decimal(p.unit_price || 0);
      const amount = quantity.mul(unitPrice);
      const control = this.productsFormArray.at(idx);
  
      const currentAmount = new Decimal(control.get('amount')?.value || 0);
      if (!currentAmount.equals(amount)) {
        control.get('amount')?.setValue(amount.toNumber(), { emitEvent: false });
      }
  
      conceptTotal = conceptTotal.add(amount);
    });
  
    // actualizar concept_total si cambió
    const currentConcept = new Decimal(this.orderForm.get('concept_total')?.value || 0);
    if (!currentConcept.equals(conceptTotal)) {
      this.orderForm.get('concept_total')?.setValue(conceptTotal.toNumber(), { emitEvent: false });
      this.financialDisplays['concept_total'] = this.formatCurrency(conceptTotal.toNumber());
    }
  
    // Calculo IVA/ISR
    if (this.isAutoCalculation) {
      const iva = conceptTotal.mul(0.16);
      const isrRetention = new Decimal(0);
      const total = conceptTotal.add(iva).sub(isrRetention);
  
      // Actualizar form con helpers para mantener display/buffer sincronizados
      this.setIvaFromNumber(iva.toNumber());
      this.setIsrFromNumber(isrRetention.toNumber());
  
      this.orderForm.get('total')?.setValue(total.toNumber(), { emitEvent: false });
      this.financialDisplays['total'] = this.formatCurrency(total.toNumber());
  console.log('[calculateProductAmounts] conceptTotal:', conceptTotal.toNumber(), 'iva:', iva.toNumber(), 'total:', total.toNumber());  } else {
      this.calculateTotals();
    }
  }
  
  /**
   * Reemplaza calculateTotals()
   * ---------------------------
   * Calcula total = concept_total + iva - isr_retention y parchea el control total.
   */
  calculateTotals(): void {
    const conceptTotal = new Decimal(this.orderForm.get('concept_total')?.value || 0);
    const iva = new Decimal(this.orderForm.get('iva')?.value || 0);
    const isrRetention = new Decimal(this.orderForm.get('isr_retention')?.value || 0);
    const total = conceptTotal.add(iva).sub(isrRetention).toNumber();
  
    this.orderForm.get('total')?.setValue(Number(total.toFixed(2)), { emitEvent: false });
    this.financialDisplays['total'] = this.formatCurrency(Number(total.toFixed(2)));
  }
  
  
  
  
  
  /**
   * onUnitChange
   * Asegura que el control del producto tenga unit_id con el tipo correcto y
   * actualiza el campo auxiliar unit_nombre para mostrar la etiqueta correcta.
   */
  onUnitChange(selectedValue: any, index: number): void {
    const control = this.productsFormArray.at(index);
    if (!control) return;
  
    // Normalizar: '' => '', numérico => Number(...)
    let normalized: any = selectedValue;
    if (selectedValue === '' || selectedValue === null || selectedValue === undefined) {
      normalized = '';
    } else if (!isNaN(Number(selectedValue))) {
      normalized = Number(selectedValue);
    }
  
    // Buscar unidad en la lista local
    const unidad = this.units?.find(u => String(u.id) === String(normalized));
    const unitNombre = unidad ? (unidad.nombre ?? unidad.name ?? '') : (control.get('unit_nombre')?.value ?? '');
  
    control.patchValue({
      unit_id: normalized,
      unit_nombre: unitNombre
    }, { emitEvent: false });
  
    console.log(`[onUnitChange] product[${index}] unit set:`, normalized, unitNombre);
    try { this.cdr.detectChanges(); } catch (e) {}
  }
  
  
  
  
  
  /* ===========================
     UTIL: parseCurrency (robusta)
     =========================== */
  parseCurrency(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    let s = String(value).trim();
    if (s === '') return 0;
  
    // Keep only digits, dots, commas and minus
    s = s.replace(/[^\d\-,.]/g, '');
  
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
  
    let decimalSeparator: string | null = null;
    if (lastDot !== -1 && lastComma !== -1) {
      decimalSeparator = lastDot > lastComma ? '.' : ',';
    } else if (lastComma !== -1) {
      decimalSeparator = (s.length - lastComma - 1) <= 2 ? ',' : null;
    } else if (lastDot !== -1) {
      decimalSeparator = (s.length - lastDot - 1) <= 2 ? '.' : null;
    }
  
    let normalized = s;
    if (decimalSeparator === ',') {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else if (decimalSeparator === '.') {
      normalized = normalized.replace(/,/g, '');
    } else {
      normalized = normalized.replace(/[.,]/g, '');
    }
  
    normalized = normalized.replace(/[^\d.-]/g, '');
  
    const num = parseFloat(normalized);
    return isNaN(num) ? 0 : num;
  }
  
  /* ===========================
     FORMATO ÚNICO: formatCurrency
     (usa este, elimina formatCurrenc)
     =========================== */
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-MX', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(value || 0));
  }
  
  
  /* onFinancialInput: mantener (sin cambios) - sincroniza cuando el input está atado a key genérico */
  onFinancialInput(key: string, value: string): void {
    const numericValue = this.parseCurrency(value);
    this.orderForm.get(key)?.setValue(numericValue, { emitEvent: false });
    this.financialDisplays[key] = this.formatCurrency(numericValue);
    if (!this.isAutoCalculation) this.calculateTotals();
  }
  
  
  ///eliminar todas las repetidas de aqui para arriba
  
  // ---------------- Consolidated IVA/ISR handlers & helpers ----------------
  private setIvaFromNumber(value: number) {
    const rounded = Number(Number(value || 0).toFixed(2));
    this.orderForm.get('iva')?.setValue(rounded, { emitEvent: false });
    this.financialDisplays['iva'] = this.formatCurrency(rounded);
    if (!this.isIvaFocused) this.ivaEditing = this.financialDisplays['iva'];
    try { this.cdr.detectChanges(); } catch(e) {}
    console.log('[setIvaFromNumber] iva:', rounded, 'display:', this.financialDisplays['iva']);
  }
  
  private setIsrFromNumber(value: number) {
    const rounded = Number(Number(value || 0).toFixed(2));
    this.orderForm.get('isr_retention')?.setValue(rounded, { emitEvent: false });
    this.financialDisplays['isr_retention'] = this.formatCurrency(rounded);
    if (!this.isIsrFocused) this.isrEditing = this.financialDisplays['isr_retention'];
    try { this.cdr.detectChanges(); } catch(e) {}
    console.log('[setIsrFromNumber] isr:', rounded, 'display:', this.financialDisplays['isr_retention']);
  }
  
  
  onIvaInput(raw: string) {
    this.ivaEditing = raw ?? '';
    // Si manual, parsear y recalcular total en tiempo real
    if (!this.isAutoCalculation) {
      const num = this.parseCurrency(String(raw ?? ''));
      const rounded = Number(Number(num || 0).toFixed(2));
      this.orderForm.get('iva')?.setValue(rounded, { emitEvent: false });
      this.financialDisplays['iva'] = this.formatCurrency(rounded);
      this.calculateTotals();
      console.log('[onIvaInput] manual iva set to', rounded);
    }
  }
  
  onIvaFocus() {
    this.isIvaFocused = true;
    const val = this.orderForm.get('iva')?.value ?? 0;
    this.ivaEditing = (Number(val) || 0).toFixed(2);
    console.log('[onIvaFocus] ivaEditing=', this.ivaEditing);
  }
  
  onIvaBlur() {
    this.isIvaFocused = false;
    const raw = String(this.ivaEditing || '').replace(',', '.').trim();
    const num = isNaN(Number(raw)) ? 0 : Number(parseFloat(raw));
    const rounded = Number(num.toFixed(2));
    this.orderForm.get('iva')?.setValue(rounded, { emitEvent: false });
    this.financialDisplays['iva'] = this.formatCurrency(rounded);
    this.ivaEditing = this.financialDisplays['iva'];
    this.calculateTotals();
    try { this.cdr.detectChanges(); } catch (e) {}
    console.log('[onIvaBlur] iva persisted:', rounded);
  }
  
  // ISR
  onIsrInput(raw: string) {
    this.isrEditing = raw ?? '';
    if (!this.isAutoCalculation) {
      const num = this.parseCurrency(String(raw ?? ''));
      const rounded = Number(Number(num || 0).toFixed(2));
      this.orderForm.get('isr_retention')?.setValue(rounded, { emitEvent: false });
      this.financialDisplays['isr_retention'] = this.formatCurrency(rounded);
      this.calculateTotals();
      console.log('[onIsrInput] manual isr set to', rounded);
    }
  }
  
  onIsrFocus() {
    this.isIsrFocused = true;
    const val = this.orderForm.get('isr_retention')?.value ?? 0;
    this.isrEditing = (Number(val) || 0).toFixed(2);
    console.log('[onIsrFocus] isrEditing=', this.isrEditing);
  }
  
  onIsrBlur() {
    this.isIsrFocused = false;
    const raw = String(this.isrEditing || '').replace(',', '.').trim();
    const num = isNaN(Number(raw)) ? 0 : Number(parseFloat(raw));
    const rounded = Number(num.toFixed(2));
    this.orderForm.get('isr_retention')?.setValue(rounded, { emitEvent: false });
    this.financialDisplays['isr_retention'] = this.formatCurrency(rounded);
    this.isrEditing = this.financialDisplays['isr_retention'];
    this.calculateTotals();
    try { this.cdr.detectChanges(); } catch (e) {}
    console.log('[onIsrBlur] isr persisted:', rounded);
  }
  
  // toggleCalculationMode: usa helpers
  toggleCalculationMode(): void {
    this.isAutoCalculation = !this.isAutoCalculation;
    if (this.isAutoCalculation) {
      // deshabilitar edición manual
      this.orderForm.get('iva')?.disable({ emitEvent: false });
      this.orderForm.get('isr_retention')?.disable({ emitEvent: false });
      // recalcular y sincronizar displays
      this.calculateProductAmounts();
      console.log('[toggleCalculationMode] switched TO auto');
    } else {
      // habilitar edición manual y preparar buffers
      this.orderForm.get('iva')?.enable({ emitEvent: false });
      this.orderForm.get('isr_retention')?.enable({ emitEvent: false });
      const ivaVal = this.orderForm.get('iva')?.value ?? 0;
      const isrVal = this.orderForm.get('isr_retention')?.value ?? 0;
      this.ivaEditing = (Number(ivaVal) || 0).toFixed(2);
      this.isrEditing = (Number(isrVal) || 0).toFixed(2);
      try { this.cdr.detectChanges(); } catch(e){}
      console.log('[toggleCalculationMode] switched TO manual, ivaEditing=', this.ivaEditing);
    }
  }
  
/**
 * Aplica permisos/habilitaciones según el modo actual.
 * Consolidación de setFormPermissions + enforceDisabledFields.
 */
private applyModePermissions(): void {
  // 1) Deshabilitar todo por defecto
  this.orderForm.disable({ emitEvent: false });
  this.productsFormArray.controls.forEach(c => c.disable({ emitEvent: false }));

  const enable = (path: string) => this.orderForm.get(path)?.enable({ emitEvent: false });
  const enableProd = (c: AbstractControl, path: string) => (c.get(path)?.enable({ emitEvent: false }));

  switch (this.mode) {
    case 'create_sf':
      // Campos editables en Área 1 (primer paso)
      [
        'foliosf','date','date_limited','format_type','process','provider_id','provider_name',
        'requester_area_id','requester_area_name','requester_subarea_id','requester_subarea_name',
        'ur','delivery_place','no_beneficiarios','general_observations'
      ].forEach(enable);

      // Productos editables
      this.productsFormArray.controls.forEach(c => {
        ['oficio','ur_progressive','placa','marca_nombre','tipo_nombre','modelo','cilindro',
         'grupo','subgrupo','progresivo','description','brand','unit_id','quantity','unit_price','amount','partida'
        ].forEach(p => enableProd(c, p));
      });

      this.canaddProduct = true;
      break;

    case 'validate_sf': // Área 2
      ['subsidio_estatal','ingresos_propios','federal','mixto'].forEach(enable);

      this.productsFormArray.controls.forEach(c => {
        // Solo editable partida/observations
        ['partida','observations'].forEach(p => enableProd(c, p));
      });

      // Asegurar campos no editables en este modo
      // (order_number/foliosf/provider_id quedan bloqueados)
      this.canaddProduct = false;
      break;

    case 'add_order_number': // Área 1 segunda vuelta
      ['order_number','date_limited','general_observations'].forEach(enable);
      this.canaddProduct = false;
      break;

    case 'receive': // Área 3
      this.productsFormArray.controls.forEach(c => {
        ['received_quantity','is_delivered'].forEach(p => enableProd(c, p));
      });
      this.canaddProduct = false;
      break;

    case 'update': // Edición con permiso explícito
      if (this.authService.hasPermission('orders.update')) {
        // Habilita todo el form y productos (control fino, como en create_sf)
        [
          'order_number','foliosf','date','date_limited','format_type','process','provider_id','provider_name',
          'requester_area_id','requester_area_name','requester_subarea_id','requester_subarea_name',
          'ur','delivery_place','no_beneficiarios','general_observations'
        ].forEach(enable);

        this.productsFormArray.controls.forEach(c => {
          ['oficio','ur_progressive','placa','marca_nombre','tipo_nombre','modelo','cilindro',
           'grupo','subgrupo','progresivo','description','brand','unit_id','quantity','unit_price','amount','partida','observations'
          ].forEach(p => enableProd(c, p));
        });

        this.canaddProduct = true;
      }
      break;

    default:
      // list/view → todo permanece disabled
      break;
  }

  // IVA / ISR según modo de cálculo
  if (this.isAutoCalculation) {
    this.orderForm.get('iva')?.disable({ emitEvent: false });
    this.orderForm.get('isr_retention')?.disable({ emitEvent: false });
  } else {
    this.orderForm.get('iva')?.enable({ emitEvent: false });
    this.orderForm.get('isr_retention')?.enable({ emitEvent: false });
  }
}

// 👇 Pega esto DENTRO de la clase OpEditComponent

// TrackBy (mejor performance en *ngFor)
trackByProvider = (_: number, item: any) => item?.id ?? _;
trackBySubarea  = (_: number, item: any) => item?.id ?? _;
trackByProduct  = (_: number, item: any) => item?.id ?? _;
trackByVehiculo = (_: number, item: any) => item?.id ?? _;
trackByUnit     = (_: number, item: any) => item?.id ?? _;

// Compare function para selects [compareWith]
compareById = (a: any, b: any): boolean => {
  if ((a === '' || a === null || a === undefined) && (b === '' || b === null || b === undefined)) return true;
  return String(a) === String(b);
};

// Fallbacks de unidad cuando la unidad del producto no está en la lista "units"
shouldShowFallbackUnit(productControl: import('@angular/forms').AbstractControl): boolean {
  try {
    const val = productControl?.get('unit_id')?.value;
    if (val === null || val === undefined || val === '') return false;
    if (!this.units || this.units.length === 0) return true; // aún no cargan las units
    return !this.units.some((u: any) => String(u.id) === String(val));
  } catch {
    return false;
  }
}

getFallbackUnitLabel(productControl: import('@angular/forms').AbstractControl): string {
  try {
    const val = productControl?.get('unit_id')?.value;
    if (!val) return '—';
    // si la unidad ya está en this.units, regresa su nombre
    if (this.units && this.units.length > 0) {
      const found = this.units.find((u: any) => String(u.id) === String(val));
      if (found) return found.nombre ?? found.name ?? String(found.id);
    }
    // etiqueta desde el form si existe
    const unitNombre = productControl?.get('unit_nombre')?.value;
    if (unitNombre) return unitNombre;
    // o desde selectedProduct.unit si existe
    const selUnit = productControl?.get('selectedProduct')?.value?.unit;
    if (selUnit) return selUnit.nombre ?? selUnit.name ?? String(val);
    return String(val);
  } catch {
    return String(productControl?.get('unit_id')?.value ?? '—');
  }
}
}

/*

import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../auth/services/auth.service';
import { OpserviceService } from '../service/opservice.service';
import { ProductsService } from '../../products/service/products.service';

// Clase base (tu op-create)
import { OpCreateComponent } from '../op-create/op-create.component';

@Component({
  selector: 'app-op-edit',
  templateUrl: './op-edit.component.html',
  styleUrls: ['./op-edit.component.scss']
})
export class OpEditComponent extends OpCreateComponent implements OnInit {

  constructor(
    fb: FormBuilder,
    authService: AuthService,
    auth: AuthService,
    orderService: OpserviceService,
    router: Router,
    route: ActivatedRoute,
    productService: ProductsService,
    cdr: ChangeDetectorRef
  ) {

    
    // Inicializa base
    super(fb, authService, auth, orderService, router, route, productService, cdr);
    // ⚠️ Forzamos modo update ANTES de ngOnInit (para que checkPermissions() ya use 'update')
    this.mode = 'update';
  }

  override ngOnInit(): void {
    // Ejecuta toda la inicialización del padre (catálogos, streams, carga por ID, etc.)
    super.ngOnInit();

    // ⚠️ Vuelve a forzar 'update' porque la base puede cambiarlo por queryParams
    this.mode = 'update';

    // Limpia validadores globales si no necesitas alguno extra en edición
    //this.orderForm.clearValidators();
    //this.orderForm.setValidators([]);

    // Reaplica permisos/habilitaciones para 'up'
    this.setFormPermissions();

    // Recalcula estado de validación sin disparar cascadas
    this.orderForm.updateValueAndValidity({ emitEvent: false });

    // Ajuste visual de textareas
    this.adjustAllTextareas();
  }
}

*/



    
    
     
    /*/ INICIALIZAR STREAM DE BÚSQUEDA (llamar en ngOnInit)
  private initProviderSearchStream(): void {
    this.providerSearchSub = this.providerSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        // Si query vacío o muy corto, mostrar todos
        if (!query || query.length <= 2) {
          return of({ providers: this.allProviders, total: this.allProviders.length });
        }
        // Búsqueda API para queries > 2 caracteres
        return this.orderService.searchProviders(query, this.providerPage, this.itemsPerPage).pipe(
          catchError(() => of({ providers: [], total: 0 }))
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe(response => {
      this.allProviders = response.providers || [];
      this.applyProviderLocalFilter(); // Aplicar filtro local
    });
  }
  */

  /*/ Suscripciones api proveedores - busq
      this.providerSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        return this.orderService.searchProviders(query, this.providerPage, this.itemsPerPage).pipe(
          catchError((error) => {
            console.error('Error searching providers:', error);
            return of({ providers: [], total: 0 });
          })
        );
    }),
    takeUntil(this.destroy$)
      ).subscribe(response => {
        this.allProviders = Array.isArray(response?.providers) ? response.providers : [];
        this.filteredProviders = [...this.allProviders]; // ← Más simple que filterProviders()
      });
    */
   /*/ FILTRADO LOCAL PARA PROVEEDORES
    private applyProviderLocalFilter(): void {
      if (!this.providerSearchQuery || this.providerSearchQuery.trim() === '') {
        this.filteredProviders = [...this.allProviders];
        return;
      } 
        const q = this.providerSearchQuery.toLowerCase();
    this.filteredProviders = this.allProviders.filter(provider => 
      (provider.full_name && provider.full_name.toLowerCase().includes(q)) ||
      (provider.code && provider.code.toLowerCase().includes(q)) ||
      (provider.rfc && provider.rfc.toLowerCase().includes(q))
    );
    }
  */
    /* CAMBIO EN LA BÚSQUEDA DE PROVEEDORES
    onProviderSearchChange(query: string): void {
      this.providerSearchQuery = query;
      
      this.applyProviderLocalFilter();
      // Para queries cortos: filtro local inmediato
      if (query && query.trim().length > 2) {
        this.providerPage = 1;
        this.providerSearchSubject.next(query);
      } else if (!query || query.trim() === '') {
        // Si query está vacío, recargar todos
        this.providerPage = 1;
        this.providerSearchSubject.next('');
      }
        
      }
      */
     /*/ ====== CAMBIOS EN EL INPUT ======
    onProviderQueryChange(query: string): void {
      this.providerSearchQuery = query;
  
      // 1) filtra local
      this.applyProviderLocalFilter();
  
      // 2) si el query es razonable, consulta servidor (opcional regla >2)
      if ((query ?? '').length > 2 || query === '') {
        this.providerPage = 1;
        this.providerSearchSubject.next(query);
      }
    }
      */
    /*/ ABRIR MODAL DE PROVEEDORES
    openProviderModal(): void {
      this.showProviderModal = true;
      
      this.providerSearchQuery = '';
      this.providerPage = 1;
      
      // Inicializar stream si no existe
      if (!this.providerSearchSub) {
        this.initProviderSearchStream();
      }
      
      // Cargar proveedores inicialmente
      this.providerSearchSubject.next('');
    }
  
    // CERRAR MODAL DE PROVEEDORES
    closeProviderModal(): void {
      this.showProviderModal = false;
      this.providerSearchQuery = '';
      
    }
  *//*/ SELECCIÓN DE PROVEEDOR (igual que antes)
    selectProvider(provider: any, event?: Event): void {
      if (event) {
        event.stopPropagation();
      }
      
      if (!provider || !provider.id) {
        this.showNotification('error', 'Proveedor no válido');
        return;
      }
  
      this.orderForm.patchValue({
        provider_id: provider.id,
        provider_name: provider.full_name
      });
      
      this.closeProviderModal();
    }
  */
    /*/ BÚSQUEDA MANUAL (si necesitas mantenerla)
    searchProvider(query: string): void {
      this.providerSearchQuery = query;
      if(this.providerSearchQuery){
        const q =query.toLowerCase();
        this.filteredProviders = this.allProviders.filter(provider => 
              provider.full_name.toLowerCase().includes(q) ||
              (provider.code && provider.code.toLowerCase().includes(q)) ||
              (provider.rfc && provider.rfc.toLowerCase().includes(q))
        );
      }else{
        this.providerPage = 1;
        this.providerSearchSubject.next('');
      }
    }
  
  
    // TrackBy para proveedores
    trackByProvider = (_: number, item: any) => item?.id ?? _;
  
  */
    //busqueda de subarea por coincidencia.
   /*
    searchSubareas(query: string): void {
      console.log ("Buscando subareas", query)
      this.subareaSearchQuery = query;
      // Si hay query, filtrar los resultados locales
      if (this.subareaSearchQuery) {
        this.filteredSubareas = this.allSubareas.filter(subarea => 
          subarea.name.toLowerCase().includes(this.subareaSearchQuery.toLowerCase()) ||
          (subarea.area?.name && subarea.area.name.toLowerCase().includes(this.subareaSearchQuery.toLowerCase()))
        );
      } else {
        
    this.subareaPage = 1;
    this.subareaSearchSubject.next('');
      }
  }
      
  
    filterSubareas(query: string): void {
    if (!query) {
      this.filteredSubareas = [...this.allSubareas];
      return;
    }
    
    const queryLower = query.toLowerCase();
    this.filteredSubareas = this.allSubareas.filter(subarea => 
      subarea.name.toLowerCase().includes(queryLower) ||
      (subarea.area?.name && subarea.area.name.toLowerCase().includes(queryLower)) ||
      (subarea.code && subarea.code.toLowerCase().includes(queryLower))
    );
    }
  

    private initSubareaSearchStream(): void {
      this.subareaSearchSub?.unsubscribe();
  
      this.subareaSearchSub = this.subareaSearchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(query => 
          this.orderService.searchSubareas(query, this.subareaPage, this.itemsPerPage).pipe(
            catchError((error) => {
              console.error('Error searching subareas:', error);
              this.showNotification('error', 'Error al buscar subáreas');
              return of({ subareas: [], total: 0 });
            })
          )
        ),
        takeUntil(this.destroy$)
      ).subscribe(response => {
        if(!this.showSubareaModal || this.subareaSelectionInProgress) return;
        this.allSubareas = response.subareas || [];
        this.applyLocalSubareaFilter(this.subareaSearchQuery);
      });
    }
  */
    /* input del buscador
    onSubareaSearchInput(event: Event): void {
      const input = event.target as HTMLInputElement;
      this.subareaSearchQuery = input.value;
      this.filterSubareas(this.subareaSearchQuery);
      if (this.subareaSearchQuery.length > 2){
  
        this.subareaPage = 1;
        this.subareaSearchSubject.next(this.subareaSearchQuery); // ✅ búsqueda solo API
      }
      }
  
    // abrir modal
    openSubareaModal(): void {
      this.showSubareaModal = true;
      this.subareaSelectionInProgress = false;
      this.initSubareaSearchStream();
      this.subareaSearchQuery = '';
      this.subareaPage = 1;
      this.subareaSearchSubject.next(''); 
      this.applyLocalSubareaFilter('');
      // cargar todas desde el API
    }
  
    // cerrar modal
    closeSubareaModal(): void {
      this.showSubareaModal = false;
      //this.subareaSearchSub?.unsubscribe();
      //this.subareaSearchSub = undefined;
      this.subareaSearchQuery = '';
      //this.filterSubareas('');
    }
  */
 
  

    /*
    // ====== CAMBIOS EN EL INPUT ======
    onSubareaQueryChange(query: string): void {
      this.subareaSearchQuery = query;
  
      // 1) filtra local
      this.applyLocalSubareaFilter(query);
  
      // 2) si el query es razonable, consulta servidor (opcional regla >2)
      if ((query ?? '').length > 2 || query === '') {
        this.subareaPage = 1;
        this.subareaSearchSubject.next(query);
      }
    }
  *//*
    // ====== FILTRO LOCAL ======
    private applyLocalSubareaFilter(query: string): void {
      if (!query) {
        this.filteredSubareas = [...this.allSubareas];
        return;
      }
      const q = query.toLowerCase();
      this.filteredSubareas = this.allSubareas.filter(s =>
        (s.name ?? '').toLowerCase().includes(q) ||
        (s.area?.name ?? '').toLowerCase().includes(q) ||
        (s.code ?? '').toLowerCase().includes(q)
      );
    }
  
  
    // seleccionar subárea
    selectSubarea(subarea: any, event?: Event): void {
      if (event) {
        event.stopPropagation();
      }
      if (!subarea || !subarea.id) {
        this.showNotification('error', 'Subárea no válida');
        return;
      }
  
    this.orderForm.patchValue({
      requester_subarea_id: subarea.id,
      requester_subarea_name: subarea.name || 'N/A',
      requester_area_id: subarea.area?.id || null,
      requester_area_name: subarea.area?.name || 'N/A',
      ur: subarea.area?.urs || '' 
    });
  
    this.closeSubareaModal();
  }
  */
    /*
    // CAMBIO EN LA BÚSQUEDA DE PRODUCTOS
    onProductSearchChange(query: string, index: number): void {
      this.productSearchQueries[index] = query;
      
      // Aplicar filtro local inmediatamente
      this.filterProducts(query, index);
      
      // Para queries largos, disparar búsqueda API
      if (query && query.trim().length > 1) {
        this.productPages[index] = 1;
        this.searchProducts(query, index);
      } else if (!query || query.trim() === '') {
        // Si query está vacío, recargar todos
        this.productPages[index] = 1;
        this.searchProducts('', index);
      }
    }
  */
/*
    searchProducts(query: string, index: number): void {
      // Solo actualizar si es diferente a la búsqueda actual
      if (this.productSearchQueries[index] !== query) {
        this.productSearchQueries[index] = query;
      }
      
      this.productPages[index] = 1;
      
      // Aquí tu lógica de búsqueda API existente
      this.productSearchSubject.next({ query, index });
    }
  
    */
  
  
    /*
    openProductModal(index: number): void {
  this.showProductModal = index;

  // Inicializa arrays por índice si no existen
  if (!this.productSearchQueries[index]) this.productSearchQueries[index] = '';
  if (!this.allProducts[index]) {
    this.allProducts[index] = [];
    this.filteredProducts[index] = [];
    this.productPages[index] = 1;
  }

  // Si no hay datos locales, dispara carga inicial desde API (query vacío = todos)
  if ((this.allProducts[index] || []).length === 0) {
    this.onProductQueryChange('', index);
  } else {
    // Si ya hay caché local, aplica filtro con el query persistido
    this.applyLocalProductFilter(index, this.productSearchQueries[index]);
  }

  // Enfocar input tras abrir
  setTimeout(() => {
    if (this.productSearchInput) {
      this.productSearchInput.nativeElement.focus();
    }
  }, 100);
}
  */
 
    /*
    onSubareaSearchChange(query: string): void {
      console.log('Buscando subáreas con query:', query);
  
      this.subareaSearchQuery = query;
  
      // Filtrar en memoria primero
      if (query && query.trim() !== '') {
        const q = query.toLowerCase();
        this.filteredSubareas = this.allSubareas.filter(subarea =>
          subarea.name.toLowerCase().includes(q) ||
          (subarea.area?.name && subarea.area.name.toLowerCase().includes(q)) ||
          (subarea.code && subarea.code.toLowerCase().includes(q))
        );
      } else {
        // Si no hay query, mostrar todas
        this.filteredSubareas = [...this.allSubareas];
      }
      this.subareaSearchSubject.next(query);
    }
  */
 /**
   * Mostrar fallback option si el producto trae unit_id pero la lista 'units'
   * no contiene esa unidad (caso cuando units se cargan/desactualizan).
   
  shouldShowFallbackUnit(productControl: AbstractControl): boolean {
    try {
      const val = productControl?.get('unit_id')?.value;
      if (val === null || val === undefined || val === '') return false;
      if (!this.units || this.units.length === 0) return true; // si todavía no cargamos units, mostramos fallback
      return !this.units.some(u => String(u.id) === String(val));
    } catch (e) {
      console.warn('[shouldShowFallbackUnit] error:', e);
      return false;
    }
  }
  */
  /**
   * Etiqueta a mostrar para el fallback option: intenta usar unit_nombre, selectedProduct.unit, o el id.
   
  getFallbackUnitLabel(productControl: AbstractControl): string {
    try {
      const val = productControl?.get('unit_id')?.value;
      if (!val) return '—';
      // si units contiene la unidad, retornamos su label
      if (this.units && this.units.length > 0) {
        const found = this.units.find(u => String(u.id) === String(val));
        if (found) return found.nombre ?? found.name ?? String(found.id);
      }
      // si no, buscamos unit_nombre en el form
      const unitNombre = productControl?.get('unit_nombre')?.value;
      if (unitNombre) return unitNombre;
      // fallback a selectedProduct.unit si existe
      const selUnit = productControl?.get('selectedProduct')?.value?.unit;
      if (selUnit) return selUnit.nombre ?? selUnit.name ?? String(val);
      return String(val);
    } catch (e) {
      console.warn('[getFallbackUnitLabel] error:', e);
      return String(productControl?.get('unit_id')?.value ?? '—');
    }
  }
  */