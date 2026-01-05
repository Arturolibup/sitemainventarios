import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequisitionApproveListComponent } from './requisition-approve-list.component';

describe('RequisitionApproveListComponent', () => {
  let component: RequisitionApproveListComponent;
  let fixture: ComponentFixture<RequisitionApproveListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RequisitionApproveListComponent]
    });
    fixture = TestBed.createComponent(RequisitionApproveListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
