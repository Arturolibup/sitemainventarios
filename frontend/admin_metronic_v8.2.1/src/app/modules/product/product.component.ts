import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-product',
  templateUrl: './product.component.html',
  styleUrls: ['./product.component.scss']
})

export class ProductComponent implements OnInit {
    pageTitle: string = 'Listado'; // Título por defecto
  
    constructor(private router: Router, private activatedRoute: ActivatedRoute) {}
  
    ngOnInit() {
      // Escuchar cambios en la ruta
      this.router.events
            .pipe(filter(event => event instanceof NavigationEnd))
            .subscribe(() => {
                let currentRoute = this.activatedRoute;
                while (currentRoute.firstChild) {
                    currentRoute = currentRoute.firstChild;
                }
                const routePath = currentRoute.snapshot.routeConfig?.path;
                const url = this.router.url;

                if (url.includes('product-exits/create')) {
                    this.pageTitle = 'Registro de Salida';
                } else if (url.includes('product-exits/edit')) {
                    this.pageTitle = 'Editar Salida';
                } else if (url.includes('product-exits/list')) {
                    this.pageTitle = 'Listado de Salidas';
                } else if (routePath === 'create') {
                    this.pageTitle = 'Registro de Entrada';
                } else if (routePath === 'edit/:id') {
                    this.pageTitle = 'Editar Entrada';
                } else if (routePath === 'delete/:id') {
                    this.pageTitle = 'Eliminar Entrada';
                } else if (routePath === 'create-purchase-documents') {
                    this.pageTitle = 'Crear Documentos de Compra';
                } else if (routePath === 'list-purchase-documents/:id') {
                    this.pageTitle = 'Listado de Documentos de Compra';
                } else if (routePath === 'edit-purchase-document/:id') {
                    this.pageTitle = 'Editar Documento de Compra';
                } else if (routePath === 'delete-purchase-document/:documentId') {
                    this.pageTitle = 'Eliminar Documento de Compra';
                } else {
                    this.pageTitle = 'Listado de Entradas';
                }
          
        });
    }
  }



  


