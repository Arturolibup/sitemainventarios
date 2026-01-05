import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductsService } from '../service/product.service';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-delete-purchase-documents',
  templateUrl: './delete-purchase-documents.component.html',
  styleUrls: ['./delete-purchase-documents.component.scss']
})
export class DeletePurchaseDocumentsComponent implements OnInit {
  documentId: number;
  isLoading$: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: ProductsService,
    private toast: ToastrService
  ) {
    this.documentId = +this.route.snapshot.paramMap.get('documentId')!;
  }

  ngOnInit() {
    this.isLoading$ = this.service.isLoading$;
  }

  deleteDocumen() {
    this.service.deletePurchaseDocument(this.documentId).subscribe({
      next: (response: any) => {
        this.toast.success('Documento oficial eliminado correctamente.');
        this.router.navigate(['/product-entries/list']);
      },
      error: (error: any) => {
        console.error('Error al eliminar documento oficial:', error);
        this.toast.error('Error al eliminar el documento oficial.');
      }
    });
  }

  deleteDocument() {
        Swal.fire({
        title: '¿Estás seguro?',
        text: '¿Deseas eliminar el Documento?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'No, cancelar',
        buttonsStyling: true,
        customClass: {
          confirmButton: 'btn btn-primary',
          cancelButton: 'btn btn-light'
        }
      }).then((result) => {
        if (result.isConfirmed) {
          this.deleteDocumen(); // Llama a la función que guarda los cambios
          this.router.navigate(['/product-entries/list']);
        }
      });
    }
  
}