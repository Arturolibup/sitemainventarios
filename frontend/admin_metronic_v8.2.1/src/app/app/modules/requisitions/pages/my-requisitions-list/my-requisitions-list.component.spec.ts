import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyRequisitionsListComponent } from './my-requisitions-list.component';

describe('MyRequisitionsListComponent', () => {
  let component: MyRequisitionsListComponent;
  let fixture: ComponentFixture<MyRequisitionsListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MyRequisitionsListComponent]
    });
    fixture = TestBed.createComponent(MyRequisitionsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
