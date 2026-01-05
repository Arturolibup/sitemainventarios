import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { OpserviceService } from '../service/opservice.service';
import { ToastrService } from 'ngx-toastr';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-create-invoice-form',
  templateUrl: './create-invoice-form.component.html',
  styleUrls: ['./create-invoice-form.component.scss']
})
export class CreateInvoiceFormComponent implements OnInit {
  form: FormGroup;
  invoices: any[] = [];
  orderRequestId: number | null = null;
  isLoading: boolean = false;
  currentOrder: any = null;

  // Subida actual
  currentInvoiceFile: File | null = null;
  currentPhotos: File[] = [];

  generatedDocs: any[] = [];  // 🔹 Nuevo arreglo para PDFs generados

  // Modal / galería
  showPhotosModal = false;
  currentPhotosUrls: string[] = [];
  currentPhotoIndex = 0;
  currentInvoiceIdForPhotos: number | null = null;

  // Datos resumen
  foliosf: string | null = null;
  orderNumber: string | null = null;
  providerName: string | null = null;

  constructor(
    private fb: FormBuilder,
    private opService: OpserviceService,
    private router: Router,
    private route: ActivatedRoute,
    private toastr: ToastrService,
    private cdRef: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      order_request_id: ['', Validators.required],
      provider_id: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.orderRequestId = +this.route.snapshot.paramMap.get('order_request_id')!;
    const qpProviderId = this.route.snapshot.queryParamMap.get('provider_id');
    const qpFoliosf = this.route.snapshot.queryParamMap.get('foliosf');
    const qpOrderNumber = this.route.snapshot.queryParamMap.get('order_number');

    this.foliosf = qpFoliosf;
    this.orderNumber = qpOrderNumber;

    if (this.orderRequestId) {
      this.form.patchValue({ order_request_id: this.orderRequestId });
      this.form.get('order_request_id')?.disable();

      this.opService.getOrderById(this.orderRequestId).subscribe({
        next: (order: any) => {
          this.currentOrder = order;
          this.orderNumber = this.orderNumber || order?.order_number || null;
          this.foliosf = this.foliosf || order?.foliosf || null;

          const providerId = qpProviderId ? +qpProviderId : (order?.provider_id ?? order?.provider?.id);
          if (providerId) {
            this.form.patchValue({ provider_id: providerId });
            this.form.get('provider_id')?.disable();
          }

          this.providerName = order?.provider ? order.provider.full_name : '---';

          // 🔹 Cargar PDFs generados automáticamente
        this.generatedDocs = [];
        if (order?.suficiencia_pdf_path) {
          this.generatedDocs.push({ name: 'Suficiencia Presupuestal', path: order.suficiencia_pdf_path });
        }
        if (order?.pdf_path) {
          this.generatedDocs.push({ name: 'Orden de Pedido', path: order.pdf_path });
        }

          this.cdRef.detectChanges();
          this.loadInvoices();
        }
      });
    }

    this.opService.isLoading$.subscribe(isLoading => {
      this.isLoading = isLoading;
      this.cdRef.detectChanges();
    });
  }

  /** ================== UTILIDADES ================== */
  getFileIcon(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf': return 'bi bi-file-earmark-pdf text-danger';
      case 'doc': case 'docx': return 'bi bi-file-earmark-word text-primary';
      case 'xls': case 'xlsx': return 'bi bi-file-earmark-excel text-success';
      case 'jpg': case 'jpeg': case 'png': case 'gif': return 'bi bi-file-earmark-image text-warning';
      case 'zip': case 'rar': return 'bi bi-file-earmark-zip text-secondary';
      default: return 'bi bi-file-earmark text-muted';
    }
  }

  getFileName(filePath: string): string {
    return filePath.split('/').pop() || filePath;
  }

  getFullPhotoUrl(relativePath: string): string {
  if (relativePath.startsWith('http')) return relativePath;
  return `http://127.0.0.1:8000/storage/${relativePath}`;
}

  /** ================== SUBIDA ================== */
  onFileChange(event: any, type: string) {
    if (type === 'invoice') {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        this.toastr.error('El documento excede el límite de 5MB', 'Error');
        event.target.value = '';
        return;
      }
      this.currentInvoiceFile = file;
    } else if (type === 'photos') {
      this.currentPhotos = Array.from(event.target.files || []);
    }
  }

  async resizeImage(file: File, maxWidth = 1024, maxHeight = 1024, quality = 0.7): Promise<File> {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (event: any) => { img.src = event.target.result; };
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        if (width > maxWidth || height > maxHeight) {
          const scale = Math.min(maxWidth / width, maxHeight / height);
          width = width * scale; height = height * scale;
        }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => {
          if (blob) resolve(new File([blob], file.name, { type: file.type }));
          else reject('Error al comprimir imagen');
        }, file.type, quality);
      };
      reader.readAsDataURL(file);
    });
  }

  async onSubmit() {
    if (!this.currentInvoiceFile) {
      this.toastr.error('Seleccione un documento', 'Error');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toastr.error('Complete todos los campos requeridos', 'Error');
      return;
    }

    const rawValues = this.form.getRawValue();
    const formData = new FormData();
    formData.append('order_request_id', String(rawValues.order_request_id));
    formData.append('provider_id', String(rawValues.provider_id));
    formData.append('invoice_file', this.currentInvoiceFile);

    for (const photo of this.currentPhotos) {
      try {
        const compressed = await this.resizeImage(photo);
        formData.append('photos[]', compressed);
      } catch {
        formData.append('photos[]', photo);
      }
    }

    this.isLoading = true;
    this.opService.createInvoice(formData).subscribe({
      next: () => {
        this.toastr.success('Documento y fotos cargados con éxito', 'Éxito');
        this.loadInvoices();
        this.resetCurrentFiles();
        this.isLoading = false;
      },
      error: (error) => {
        this.toastr.error(error.message || 'Error al cargar el documento', 'Error');
        this.isLoading = false;
      }
    });
  }

  resetCurrentFiles() {
    this.currentInvoiceFile = null;
    this.currentPhotos = [];
    document.querySelectorAll('input[type="file"]').forEach(input => (input as HTMLInputElement).value = '');
  }

  /** ================== LISTADO ================== */
  loadInvoices() {
    if (!this.orderRequestId) return;
    this.opService.getInvoices(this.orderRequestId).subscribe({
      next: (res: any) => { this.invoices = res.invoices || res.data || []; },
      error: () => { this.toastr.error('Error al cargar los documentos', 'Error'); }
    });
  }

  /** ================== ACCIONES ================== */
  deleteInvoice(id: number) {
    Swal.fire({
      title: '¿Eliminar documento y todas sus fotos?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar'
    }).then(r => {
      if (r.isConfirmed) {
        this.opService.deleteInvoice(id).subscribe({
          next: () => { this.toastr.success('Eliminado con éxito'); this.loadInvoices(); },
          error: e => { this.toastr.error(e.message || 'Error al eliminar'); }
        });
      }
    });
  }

  async onReplaceDocChange(e: any, invoice: any) {
    const file: File | undefined = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.toastr.error('El documento excede 5MB', 'Error'); e.target.value = null; return;
    }
    const fd = new FormData(); fd.append('invoice_file', file);
    this.opService.replaceInvoiceFile(invoice.id, fd).subscribe({
      next: (updated: any) => {
        const idx = this.invoices.findIndex(i => i.id === invoice.id);
        if (idx !== -1) this.invoices[idx] = updated;
        this.toastr.success('Documento reemplazado', 'Éxito');
        e.target.value = null;
      },
      error: e => { this.toastr.error(e.message || 'Error al reemplazar'); e.target.value = null; }
    });
  }

  async onAddPhotosChange(e: any, invoice: any) {
    const files: File[] = Array.from(e.target.files || []);
    if (!files.length) return;
    const fd = new FormData();
    for (const file of files) {
      try {
        const compressed = await this.resizeImage(file);
        fd.append('photos[]', compressed);
      } catch {
        fd.append('photos[]', file);
      }
    }
    this.opService.appendInvoicePhotos(invoice.id, fd).subscribe({
      next: (updated: any) => {
        const idx = this.invoices.findIndex(i => i.id === invoice.id);
        if (idx !== -1) this.invoices[idx] = updated;
        if (this.currentInvoiceIdForPhotos === invoice.id) this.currentPhotosUrls = updated.photos || [];
        this.toastr.success('Fotos agregadas', 'Éxito');
        e.target.value = null;
      },
      error: e => { this.toastr.error(e.message || 'Error al agregar fotos'); e.target.value = null; }
    });
  }

  deleteOnePhoto(invoice: any, photoUrl: string) {
    Swal.fire({ title: '¿Eliminar esta foto?', icon: 'warning', showCancelButton: true }).then(r => {
      if (r.isConfirmed) {
        this.opService.deleteInvoicePhoto(invoice.id, photoUrl).subscribe({
          next: (updated: any) => {
            const idx = this.invoices.findIndex(i => i.id === invoice.id);
            if (idx !== -1) this.invoices[idx] = updated;
            if (this.currentInvoiceIdForPhotos === invoice.id) {
              this.currentPhotosUrls = updated.photos || [];
              this.currentPhotoIndex = Math.min(this.currentPhotoIndex, this.currentPhotosUrls.length - 1);
            }
            this.toastr.success('Foto eliminada', 'Éxito');
          },
          error: e => { this.toastr.error(e.message || 'Error al eliminar'); }
        });
      }
    });
  }

  deleteOnlyDocument(invoice: any) {
    Swal.fire({ title: '¿Eliminar solo el documento?', text: 'Las fotos se mantendrán', icon: 'warning', showCancelButton: true }).then(r => {
      if (r.isConfirmed) {
        this.opService.deleteInvoiceFile(invoice.id).subscribe({
          next: (updated: any) => {
            const idx = this.invoices.findIndex(i => i.id === invoice.id);
            if (idx !== -1) this.invoices[idx] = updated;
            this.toastr.success('Documento eliminado', 'Éxito');
          },
          error: e => { this.toastr.error(e.message || 'Error al eliminar'); }
        });
      }
    });
  }

  /** ================== MODAL FOTOS ================== */
  openPhotosModal(invoice: any, startIndex: number = 0) {
    this.currentInvoiceIdForPhotos = invoice.id;
    this.currentPhotosUrls = invoice.photos || [];
    this.currentPhotoIndex = Math.min(startIndex, this.currentPhotosUrls.length - 1);
    this.showPhotosModal = true;
  }
  
  closePhotosModal() {
    this.showPhotosModal = false;
    this.currentPhotosUrls = [];
    this.currentPhotoIndex = 0;
    this.currentInvoiceIdForPhotos = null;
  }
  prevPhoto() { if (this.currentPhotosUrls.length) this.currentPhotoIndex = (this.currentPhotoIndex - 1 + this.currentPhotosUrls.length) % this.currentPhotosUrls.length; }
  nextPhoto() { if (this.currentPhotosUrls.length) this.currentPhotoIndex = (this.currentPhotoIndex + 1) % this.currentPhotosUrls.length; }
  downloadCurrentPhoto() { if (this.currentPhotosUrls.length) window.open(this.currentPhotosUrls[this.currentPhotoIndex], '_blank'); }

  /** ================== OTROS ================== */
  downloadFile(url: string) { window.open(url, '_blank'); }
  goBack() { this.router.navigate(['/ordenpedido']); }
}
