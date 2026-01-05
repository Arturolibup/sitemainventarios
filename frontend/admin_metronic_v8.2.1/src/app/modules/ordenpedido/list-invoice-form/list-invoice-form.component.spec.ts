import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListInvoiceFormComponent } from './list-invoice-form.component';

describe('ListInvoiceFormComponent', () => {
  let component: ListInvoiceFormComponent;
  let fixture: ComponentFixture<ListInvoiceFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ListInvoiceFormComponent]
    });
    fixture = TestBed.createComponent(ListInvoiceFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
