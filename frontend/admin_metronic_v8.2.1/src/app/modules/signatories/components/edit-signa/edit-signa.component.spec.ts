import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditSignaComponent } from './edit-signa.component';

describe('EditSignaComponent', () => {
  let component: EditSignaComponent;
  let fixture: ComponentFixture<EditSignaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [EditSignaComponent]
    });
    fixture = TestBed.createComponent(EditSignaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
