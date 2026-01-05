import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListSignaComponent } from './list-signa.component';

describe('ListSignaComponent', () => {
  let component: ListSignaComponent;
  let fixture: ComponentFixture<ListSignaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ListSignaComponent]
    });
    fixture = TestBed.createComponent(ListSignaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
