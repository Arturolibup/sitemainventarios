import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-chat-attachment-preview',
  templateUrl: './chat-attachment-preview.component.html',
  styleUrls: ['./chat-attachment-preview.component.scss'],
})
export class ChatAttachmentPreviewComponent {
  @Input() files: File[] = [];
  @Output() remove = new EventEmitter<number>();

  onRemove(index: number) {
    this.remove.emit(index);
  }
}
