// chat.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import {
  ChatConversation,
  ChatMessage,
  PaginatedMessages,
  ApiResource,
  ApiCollection,
} from '../models/chat.models';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { URL_SERVICIOS } from 'src/app/config/config';
import { AuthService } from 'src/app/modules/auth';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private baseUrl = `${URL_SERVICIOS}/chat`;

  private unreadCountSubject = new BehaviorSubject<number>(0);
  unreadCount$ = this.unreadCountSubject.asObservable();

  private conversationsCache: ChatConversation[] = [];

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: 'Bearer ' + this.authService.token,
    });
  }

  getConversations(): Observable<ChatConversation[]> {
    return this.http
      .get<ApiCollection<ChatConversation> | ChatConversation[] | any>(
        `${this.baseUrl}/conversations`,
        { headers: this.getHeaders() }
      )
      .pipe(
        map((resp: any) => {
          const convs: ChatConversation[] = Array.isArray(resp)
            ? resp
            : Array.isArray(resp?.data)
            ? resp.data
            : Array.isArray(resp?.conversations)
            ? resp.conversations
            : [];

          this.conversationsCache = convs;
          this.updateUnreadCount();
          return convs;
        })
      );
  }

  getConversation(conversationId: number): Observable<ChatConversation> {
    return this.http
      .get<ApiResource<ChatConversation>>(
        `${this.baseUrl}/conversations/${conversationId}`,
        { headers: this.getHeaders() }
      )
      .pipe(map((resp) => resp.data));
  }

  openConversation(receiverId: number): Observable<ChatConversation> {
    return this.http
      .post<ApiResource<ChatConversation> | ChatConversation>(
        `${this.baseUrl}/conversations`,
        { receiver_id: receiverId },
        { headers: this.getHeaders() }
      )
      .pipe(map((resp: any) => resp?.data ?? resp));
  }

  getMessages(
    conversationId: number,
    page: number = 1,
    perPage: number = 30
  ): Observable<PaginatedMessages> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', perPage.toString());

    return this.http.get<PaginatedMessages>(
      `${this.baseUrl}/conversations/${conversationId}/messages`,
      { headers: this.getHeaders(), params }
    );
  }

  sendMessage(
    conversationId: number,
    body: string | null,
    files: File[] = []
  ): Observable<ChatMessage> {
    const formData = new FormData();

    if (body && body.trim().length > 0) formData.append('body', body.trim());
    files.forEach((file) => formData.append('files[]', file, file.name));

    return this.http
      .post<ApiResource<ChatMessage> | ChatMessage>(
        `${this.baseUrl}/conversations/${conversationId}/messages`,
        formData,
        { headers: this.getHeaders() }
      )
      .pipe(map((resp: any) => resp?.data ?? resp));
  }

  markAsRead(conversationId: number) {
    return this.http
      .post(
        `${this.baseUrl}/conversations/${conversationId}/read`,
        {},
        { headers: this.getHeaders() }
      )
      .pipe(
        tap(() => {
          const conv = this.conversationsCache.find((c) => c.id === conversationId);
          if (conv) conv.unread_count = 0;
          this.updateUnreadCount();
        })
      );
  }

  updateUnreadCount() {
    const total = (Array.isArray(this.conversationsCache) ? this.conversationsCache : []).reduce(
      (acc, c) => acc + (c.unread_count || 0),
      0
    );
    this.unreadCountSubject.next(total);
  }

  downloadAttachment(downloadUrl: string) {
  return this.http.get(downloadUrl, {
    headers: this.getHeaders(), // 🔐 Bearer SIEMPRE
    responseType: 'blob',
  });
}

  getUsers() {
  return this.http.get<any>(`${this.baseUrl}/users`, { headers: this.getHeaders() });
}
}
