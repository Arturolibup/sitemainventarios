import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateSignaComponent } from './create-signa.component';

describe('CreateSignaComponent', () => {
  let component: CreateSignaComponent;
  let fixture: ComponentFixture<CreateSignaComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [CreateSignaComponent]
    });
    fixture = TestBed.createComponent(CreateSignaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
