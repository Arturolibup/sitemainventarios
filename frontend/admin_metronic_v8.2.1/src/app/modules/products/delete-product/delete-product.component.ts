import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ProductsService } from '../service/products.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-delete-product',
  templateUrl: './delete-product.component.html',
  styleUrls: ['./delete-product.component.scss']
})
export class DeleteProductComponent implements OnInit {
  @Input() PRODUCT: any; // Receive the product object from ListProductComponent
  @Output() ProductD = new EventEmitter<any>(); // Emit event when product is deleted
  isLoading: any;

  constructor(
    public modal: NgbActiveModal,
    public productService: ProductsService,
    public toast: ToastrService
  ) {}

  ngOnInit(): void {
    this.isLoading = this.productService.isLoading$;
  }

  delete(): void {
    if (!this.PRODUCT?.id) {
      this.toast.error("Error", "No se pudo identificar el producto para eliminar");
      return;
    }

    this.productService.deleteproduct(this.PRODUCT.id).subscribe((resp: any) => {
      if (resp.message === 200) {
        this.toast.success("Éxito", "Producto eliminado correctamente");
        this.ProductD.emit(this.PRODUCT); // Emit the deleted product to update the list
        this.modal.close(); // Close the modal
      } else {
        this.toast.warning("Validación", resp.message.text || "Error al eliminar el producto");
      }
    });
  }
}