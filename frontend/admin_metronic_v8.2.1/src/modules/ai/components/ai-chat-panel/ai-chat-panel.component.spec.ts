import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiChatPanelComponent } from './ai-chat-panel.component';

describe('AiChatPanelComponent', () => {
  let component: AiChatPanelComponent;
  let fixture: ComponentFixture<AiChatPanelComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AiChatPanelComponent]
    });
    fixture = TestBed.createComponent(AiChatPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
