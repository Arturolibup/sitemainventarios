import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequisitionApproveComponent } from './requisition-approve.component';

describe('RequisitionApproveComponent', () => {
  let component: RequisitionApproveComponent;
  let fixture: ComponentFixture<RequisitionApproveComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RequisitionApproveComponent]
    });
    fixture = TestBed.createComponent(RequisitionApproveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
