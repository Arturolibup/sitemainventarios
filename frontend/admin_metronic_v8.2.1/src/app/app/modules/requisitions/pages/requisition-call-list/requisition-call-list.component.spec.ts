import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequisitionCallListComponent } from './requisition-call-list.component';

describe('RequisitionCallListComponent', () => {
  let component: RequisitionCallListComponent;
  let fixture: ComponentFixture<RequisitionCallListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RequisitionCallListComponent]
    });
    fixture = TestBed.createComponent(RequisitionCallListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
