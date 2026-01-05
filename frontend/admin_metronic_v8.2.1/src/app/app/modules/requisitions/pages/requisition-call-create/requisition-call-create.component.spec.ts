import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RequisitionCallsCreateComponent } from './requisition-call-create.component';

describe('RequisitionCallCreateComponent', () => {
  let component: RequisitionCallsCreateComponent;
  let fixture: ComponentFixture<RequisitionCallsCreateComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RequisitionCallsCreateComponent]
    });
    fixture = TestBed.createComponent(RequisitionCallsCreateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
