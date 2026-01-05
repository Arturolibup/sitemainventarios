import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeleteInvoiceFormComponent } from './delete-invoice-form.component';

describe('DeleteInvoiceFormComponent', () => {
  let component: DeleteInvoiceFormComponent;
  let fixture: ComponentFixture<DeleteInvoiceFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DeleteInvoiceFormComponent]
    });
    fixture = TestBed.createComponent(DeleteInvoiceFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
