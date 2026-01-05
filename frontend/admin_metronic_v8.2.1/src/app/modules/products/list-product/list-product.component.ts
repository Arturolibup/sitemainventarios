import { Component, OnInit } from '@angular/core';
import { ProductsService } from '../service/products.service';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { DeleteProductComponent } from '../delete-product/delete-product.component';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';


interface Product {
  id: string;
  title: string;
  sku: string;
  imagen: string | null;
  price_general: string | number;
  description: string;
  specifications: string;
  umbral: string;
  umbral_unit_id: string;
  tiempo_de_entrega: number;
  clave: string;
  product_categorie_id: string;
  product_categorie: { id: string; name: string };
  quantity_warehouse: number;
  warehouses: { id: string; product_id: string; unit_id: string; warehouse: string; quantity: number }[];
  marca_id?: string;
  tipo_id?: string;
  modelo?: number;
  numeroeco?: number;
  placa?: string;
  cilindro?: number;
  created_at: string;
}

@Component({
  selector: 'app-list-product',
  templateUrl: './list-product.component.html',
  styleUrls: ['./list-product.component.scss']
})
export class ListProductComponent implements OnInit {
  search: string = '';
  PRODUCTS: Product[] = [];
  CATEGORIES: any[] = [];
  categorie_warehouse: string = '';
  product_categorie_id: string = '';
  isLoading$: any;
  totalPages: number = 0;
  currentPage: number = 1;
  loading: boolean = false;
  pageSize: any;
  totalRecords: any;

  constructor(
    public productservice: ProductsService,
    public modalService: NgbModal,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.isLoading$ = this.productservice.isLoading$;
    this.configAll();
    this.loadFiltersFromUrl();
    this.listproducts();
  }
    // Cargar filtros desde URL
  loadFiltersFromUrl() {
    this.activatedRoute.queryParams.subscribe(params => {
      this.product_categorie_id = params['categorie'] || '';
      this.search = params['search'] || '';
      this.currentPage = +params['page'] || 1;
    });
  
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.router.url.includes('/productos/list')) {
          this.listproducts();
        }
      });
  }

  // MODIFIED: Enhanced error handling to display backend message
  listproducts(page = 1) {
    let data = {
      product_categorie_id: this.product_categorie_id,
      search: this.search,
    };

    this.productservice.listproducts(page, data).subscribe({
      next: (resp: any) => {
        console.log('Lista de productos en respuesta a resp:', resp);
        this.PRODUCTS = resp.products.data.map((product: Product) => ({
          ...product,
          imagen: product.imagen
            ? `${product.imagen}?t=${Date.now()}`
            : 'assets/media/svg/files/blank-image.svg'
        }));
        this.totalPages = resp.total;
        this.currentPage = resp.current_page;
        this.totalRecords = resp.total
        this.pageSize = resp.per_page;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.toastr.error(error.error?.message_text || 'No se pudieron cargar los productos', 'Error');
        this.PRODUCTS = [];
        this.loading = false;
      }
    });
  }

  configAll() {
    this.productservice.configAll().subscribe((resp: any) => {
      console.log('respuesta de configAll', resp);
      this.CATEGORIES = resp.categories;
    });
  }

  loadPage(page: any) {
    this.listproducts(page);
  }

  deleteproduct(PRODUCT: Product) {
    const modalRef = this.modalService.open(DeleteProductComponent, { centered: true, size: 'md' });
    modalRef.componentInstance.PRODUCT = PRODUCT;

    modalRef.componentInstance.ProductD.subscribe((prod: Product) => {
      let INDEX = this.PRODUCTS.findIndex((p: Product) => p.id === prod.id);
      if (INDEX !== -1) {
        this.PRODUCTS.splice(INDEX, 1);
      }
    });
  }

  refreshproducts(): void {
    this.search = '';
    this.product_categorie_id = '';
    this.router.navigate([], { queryParams: {
      search: null,
      categorie: null
    },
    queryParamsHandling: 'merge'
  });
    this.listproducts();
  }


  getProductQuantity(product: Product): string {
  if (!product.warehouses || product.warehouses.length === 0) {
    return '0';
  }
  
  const quantity = product.warehouses[0]?.quantity;
  return quantity ? (+quantity).toLocaleString() : '0';
}
}