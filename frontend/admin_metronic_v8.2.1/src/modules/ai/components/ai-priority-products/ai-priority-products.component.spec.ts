import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiPriorityProductsComponent } from './ai-priority-products.component';

describe('AiPriorityProductsComponent', () => {
  let component: AiPriorityProductsComponent;
  let fixture: ComponentFixture<AiPriorityProductsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AiPriorityProductsComponent]
    });
    fixture = TestBed.createComponent(AiPriorityProductsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
