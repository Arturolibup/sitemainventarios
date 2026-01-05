import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiGlobalInsightsComponent } from './ai-global-insights.component';

describe('AiGlobalInsightsComponent', () => {
  let component: AiGlobalInsightsComponent;
  let fixture: ComponentFixture<AiGlobalInsightsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AiGlobalInsightsComponent]
    });
    fixture = TestBed.createComponent(AiGlobalInsightsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
