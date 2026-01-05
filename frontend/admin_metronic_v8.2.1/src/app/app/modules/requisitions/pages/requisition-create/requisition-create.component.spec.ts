import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequisitionCreateComponent } from './requisition-create.component';

describe('RequisitionCreateComponent', () => {
  let component: RequisitionCreateComponent;
  let fixture: ComponentFixture<RequisitionCreateComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RequisitionCreateComponent]
    });
    fixture = TestBed.createComponent(RequisitionCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
