import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductsService } from '../service/product.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-edit-purchase-documents',
  templateUrl: './edit-purchase-documents.component.html',
  styleUrls: ['./edit-purchase-documents.component.scss']
})
export class EditPurchaseDocumentsComponent implements OnInit {
  documentId: number;
  private _document: any = null;
  get document(): any {
    return this._document;
  }
  set document(value: any) {
    console.log('Set document:', value);
    this._document = value;
  }
  documentFile: File | null = null;
  documentPreview: { file: File, url: string } | null = null;
  isLoading$: any;
  isDocumentLoaded: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: ProductsService,
    private cdr: ChangeDetectorRef,
    private toast: ToastrService
  ) {
    this.documentId = +this.route.snapshot.paramMap.get('id')!;
    console.log('Constructor - Document ID:', this.documentId);
  }

  ngOnInit() {
    console.log('ngOnInit - Inicio');
    this.isLoading$ = this.service.isLoading$;
    this.loadDocument();
    console.log('ngOnInit - Fin');
  }

  async loadDocument() {
    try {
      console.log('loadDocument - Inicio');
      const response = await this.service.getPurchaseDocument(this.documentId).toPromise();
      console.log('Respuesta de getPurchaseDocument:', response);
      this.document = { ...response };
      console.log('Documento asignado:', this._document);
      const blob = await this.service.getPurchaseDocumentFile(this.documentId).toPromise();
      console.log('Blob recibido:', blob);
      this._document.url = window.URL.createObjectURL(blob);
      console.log('Documento final con URL:', this._document);
      this.isDocumentLoaded = true;
      this.cdr.detectChanges();
      console.log('loadDocument - Fin');
    } catch (error) {
      console.error('Error al cargar documento:', error);
      this.toast.error('Error al cargar el documento oficial.');
      this.router.navigate(['/product-entries/list']);
    }
  }


  
  ngAfterViewInit() {
    console.log('ngAfterViewInit - Documento:', this._document);
  }

  ngOnDestroy() {
    console.log('ngOnDestroy - Documento:', this._document);
  }

  onFileChange(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.documentFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.documentPreview = { file: file, url: e.target.result };
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

  removeDocument() {
    this.documentFile = null;
    this.documentPreview = null;
    this.cdr.detectChanges();
  }

  updateDocument() {
    if (!this.documentFile) {
      this.toast.error('Debe seleccionar un nuevo documento.');
      return;
    }
    const formData = new FormData();
    formData.append('document', this.documentFile);
    this.service.updatePurchaseDocument(this.documentId, formData).subscribe({
      next: (response: any) => {
        this.toast.success('Documento oficial actualizado correctamente.');
        this.router.navigate(['/product-entries/list-purchase-documents', this._document.entry_id]);
      },
      error: (error: any) => {
        this.toast.error('Error al actualizar el documento oficial.');
      }
    });
  }

  cancel() {
    this.router.navigate(['/product-entries/list-purchase-documents', this._document?.entry_id]);
  }

  downloadCurrentDocument() {
    this.service.getPurchaseDocumentFile(this.documentId).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this._document.original_name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      },
      error: (error) => {
        this.toast.error('Error al descargar el documento actual', 'Error');
      }
    });
  }

  isImageFile(fileType: string | undefined): boolean {
    if (!fileType) return false;
    const normalizedType = fileType.toLowerCase().trim();
    return normalizedType === 'jpg' || normalizedType === 'jpeg' || normalizedType === 'png';
  }

  onImageError(event: Event) {
    console.error('Error al cargar la imagen en <img>:', event);
  }
}