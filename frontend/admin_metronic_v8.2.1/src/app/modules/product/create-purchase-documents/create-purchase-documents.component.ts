import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductsService } from '../service/product.service';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-create-purchase-documents',
  templateUrl: './create-purchase-documents.component.html',
  styleUrls: ['./create-purchase-documents.component.scss']
})
export class CreatePurchaseDocumentsComponent implements OnInit {
  entryId: number |null = null;
  invoiceNumber:string = "";
  documentPreviews: { file: File, url: string }[] = [];
  isLoading: boolean = false;
  isLoading$: any;
 
  invoiceSearchQuery: string = '';
  filteredInvoices: any[] = [];
  selectedInvoice: any = null;
  documentFiles: File[] = [];

  constructor(
    private service: ProductsService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    public toast: ToastrService,
    private route: ActivatedRoute, // Agregar ActivatedRoute
  ) {}

  ngOnInit() {
    this.isLoading$ = this.service.isLoading$;

   // Leer entry_id e invoice desde los queryParams
   this.route.queryParams.subscribe(params => {
    this.entryId = params['entry_id'] ? +params['entry_id'] : null;
    this.invoiceNumber = params['invoice'] || '';
    
    // Si tenemos entryId e invoiceNumber, no necesitamos búsqueda manual
    if (this.entryId && this.invoiceNumber) {
      this.selectedInvoice = { id: this.entryId, invoice_number: this.invoiceNumber };
    }
  });
}

  onFileChange(event: any) {
    const files = event.target.files;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this.documentFiles.push(file);
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.documentPreviews.push({
          file: file,
          url: e.target.result
        });
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

  removeDocument(index: number) {
    this.documentFiles.splice(index, 1);
    this.documentPreviews.splice(index, 1);
    this.cdr.detectChanges();
  }

  saveDocuments() {
    if (!this.entryId || !this.selectedInvoice) {
      this.toast.error('No se ha especificado una entrada válida.');
      return;
    }
  
    if (this.documentPreviews.length === 0) {
      this.toast.error('Debe seleccionar al menos un archivo.');
      return;
    }
  
    this.isLoading = true;
    const formData = new FormData();
    this.documentPreviews.forEach((preview, index) => {
      formData.append(`documents[${index}]`, preview.file);
    });
  
    this.service.savePurchaseDocuments(this.entryId, formData).subscribe({
      next: (response: any) => {
        this.toast.success('Documentos oficiales guardados correctamente.');
        this.router.navigate(['/product-entries/list-purchase-documents', this.entryId]);
      },
      error: (error: any) => {
        console.error('Error:', error);
        this.toast.error('Error al guardar los documentos oficiales.');
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }


  cancel() {
        Swal.fire({
        title: '¿Estás seguro?',
        text: '¿Deseas salir sin grabar?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí ',
        cancelButtonText: 'No',
        buttonsStyling: true,
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

    // Nuevo método para regresar al listado sin confirmación
  goBack() {
    this.router.navigate(['/product-entries/list']);
  }

  //Estan sin funcion por ahora. 
  /*
  searchInvoices(event: Event) {
    const inputElement = event.target as HTMLInputElement;
    const query = inputElement.value || '';
    this.invoiceSearchQuery = inputElement.value;

    if (query) {
      this.service.searchInvoices(query).subscribe(
        (response: any) => {
          this.filteredInvoices = response;
          // Seleccionar automáticamente si viene de la URL y hay coincidencia exacta
          const invoiceFromUrl = this.route.snapshot.queryParams['invoice'];
          if (invoiceFromUrl && invoiceFromUrl === query) {
            const exactMatch = this.filteredInvoices.find(inv => inv.invoice_number === query);
            if (exactMatch) {
              this.selectInvoice(exactMatch);
            }
          }
          this.cdr.detectChanges();
        },
        (error) => {
          console.error('Error al buscar facturas:', error);
          this.filteredInvoices = [];
          this.cdr.detectChanges();
        }
      );
    } else {
      this.filteredInvoices = [];
      this.cdr.detectChanges();
    }
  }

  selectInvoiceFromList() {
    if (this.filteredInvoices.length === 1) {
      this.selectInvoice(this.filteredInvoices[0]);
    }
  }

  selectInvoice(invoice: any) {
    this.selectedInvoice = invoice;
    this.invoiceSearchQuery = invoice.invoice_number;
    this.filteredInvoices = [];
    this.cdr.detectChanges();
  } 
   */
}