import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatAttachmentPreviewComponent } from './chat-attachment-preview.component';

describe('ChatAttachmentPreviewComponent', () => {
  let component: ChatAttachmentPreviewComponent;
  let fixture: ComponentFixture<ChatAttachmentPreviewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ChatAttachmentPreviewComponent]
    });
    fixture = TestBed.createComponent(ChatAttachmentPreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
