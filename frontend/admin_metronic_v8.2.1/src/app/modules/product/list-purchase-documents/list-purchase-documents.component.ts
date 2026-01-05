import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductsService } from '../service/product.service';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-list-purchase-documents',
  templateUrl: './list-purchase-documents.component.html',
  styleUrls: ['./list-purchase-documents.component.scss']
})
export class ListPurchaseDocumentsComponent implements OnInit {
  @ViewChild('printIframe') printIframe!: ElementRef<HTMLIFrameElement>;
  documents: any[] = [];
  invoiceNumber: string = ''; // Para almacenar el número de factura
  entryId: number | null=null;
  
  isLoading$: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: ProductsService,
    private toast: ToastrService,
    
  ) 
  {
    
  }

  

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      this.entryId = +params.get('id')!;
      this.loadDocuments();
    });

    this.route.queryParams.subscribe(params => {
      this.invoiceNumber = params['invoice'] || '';
    });

    this.isLoading$ = this.service.isLoading$;
  }

  
  loadDocuments() {
    if (this.entryId) {
      this.service.listPurchaseDocuments(this.entryId).subscribe({
        next: (response: any) => {
          this.documents = response.data || response;
          console.log('Documentos cargados:', this.documents); // Depuración
          if (this.documents.length === 0) {
            this.toast.info('No hay documentos asociados a esta entrada', 'Info');
          }
        },
        error: (error: any) => {
          this.toast.error('Error al cargar los documentos', 'Error');
          console.error('Error:', error);
        }
      });
    }
  }

  printDocument(document: any) {
    if (!document?.id) {
        this.toast.error('Documento inválido', 'Error');
        return;
    }
    this.service.getPurchaseDocumentFile(document.id).subscribe({
        next: (blob: Blob) => {
            const url = window.URL.createObjectURL(blob);
            const printWindow = window.open(url);
            if (printWindow) {
                printWindow.onload = () => {
                    printWindow.print();
                    printWindow.onafterprint = () => printWindow.close();
                };
            } else {
                this.toast.error('No se pudo abrir la ventana de impresión', 'Error');
            }
        },
        error: (error) => {
            console.error('Error al imprimir:', error);
            this.toast.error(error.error?.message || 'No se pudo imprimir el documento', 'Error');
        }
    });
  }

  downloadDocument(docu: any) {
      if (!docu?.id) {
          this.toast.error('Documento inválido', 'Error');
          return;
      }
      this.service.getPurchaseDocumentFile(docu.id).subscribe({
          next: (blob: Blob) => {
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = docu.file_name;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
              this.toast.success(`Archivo ${docu.file_name} descargado`, 'Éxito');
          },
          error: (error) => {
              console.error('Error al descargar:', error);
              this.toast.error(error.error?.message || 'No se pudo descargar el documento', 'Error');
          }
      });
  }

  deleteDocument(documentId: number) {
    Swal.fire({
                title: '¿Estás seguro?',
                text: '¿Deseas eliminar este Documento? Esta acción no se puede deshacer.',
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
                    this.service.deletePurchaseDocument(documentId).subscribe({
                        next: () => {
                            Swal.fire({
                                icon: 'success',
                                title: 'Eliminada',
                                text: 'Entrada eliminada correctamente.',
                                timer: 1500,
                                showConfirmButton: false
                            });
                            this.documents = this.documents.filter(doc => doc.id !== documentId);;
                        },
                        error: () => {
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                text: 'Error al eliminar la entrada.'
                            });
                        }
                    });
                }
            });
  
  }

  goBack() {
    this.router.navigate(['/product-entries/list']);
  }

  cancel() {
    Swal.fire({
      title: '¿Estás seguro?',
      text: '¿Deseas salir de esta vista?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí',
      cancelButtonText: 'No',
      customClass: { confirmButton: 'btn btn-primary', cancelButton: 'btn btn-light' }
    }).then((result) => {
      if (result.isConfirmed) {
        this.goBack()
      }
    });
  }
}

  

