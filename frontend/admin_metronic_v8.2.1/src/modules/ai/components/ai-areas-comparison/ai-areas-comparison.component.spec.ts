import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiAreasComparisonComponent } from './ai-areas-comparison.component';

describe('AiAreasComparisonComponent', () => {
  let component: AiAreasComparisonComponent;
  let fixture: ComponentFixture<AiAreasComparisonComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AiAreasComparisonComponent]
    });
    fixture = TestBed.createComponent(AiAreasComparisonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
