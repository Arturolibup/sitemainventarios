export type ChatUserStatus = 'online' | 'offline' | 'busy' | 'away';

export interface ChatUser {
  id: number;
  name: string;
  email?: string;
  avatar_url?: string | null;
  status?: ChatUserStatus;
}

export interface ChatAttachment {
  id: number;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  download_url: string;
}

export interface ChatMessage {
  
  id: number;
  conversation_id: number;
  sender_id: number;
  body?: string | null;
  has_attachments: boolean;
  is_system: boolean;
  sent_at: string | null;
  attachments: ChatAttachment[];
  read_at?: string | null;
}

export interface ChatConversation {
  id: number;
  type: 'direct' | 'group';
  title?: string | null;
  last_message?: ChatMessage | null;
  participants: ChatUser[];
  unread_count: number;
}

export interface PaginatedMessages {
  data: ChatMessage[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

// Respuesta típica de Laravel JsonResource: { data: T }
export interface ApiResource<T> {
  data: T;
}

// Respuesta típica de ResourceCollection: { data: T[], meta?: any }
export interface ApiCollection<T> {
  data: T[];
  meta?: any;
}
