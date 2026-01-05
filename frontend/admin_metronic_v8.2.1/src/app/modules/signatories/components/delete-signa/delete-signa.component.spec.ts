import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeleteSignaComponent } from './delete-signa.component';

describe('DeleteSignaComponent', () => {
  let component: DeleteSignaComponent;
  let fixture: ComponentFixture<DeleteSignaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [DeleteSignaComponent]
    });
    fixture = TestBed.createComponent(DeleteSignaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
