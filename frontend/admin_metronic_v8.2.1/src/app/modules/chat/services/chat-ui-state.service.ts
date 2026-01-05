import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class ChatUiStateService {
  private visibleSubject = new BehaviorSubject<boolean>(false);
  visible$ = this.visibleSubject.asObservable();

  constructor(private router: Router) {
    // estado inicial según ruta actual
    this.applyRouteRule(this.router.url);

    // cuando cambie ruta, aplicar regla
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.applyRouteRule(e.urlAfterRedirects));
  }

  private applyRouteRule(url: string) {
    const isAuthRoute = url.startsWith('/auth');

    if (isAuthRoute) {
      // 🔥 en login/auth: chat muerto
      localStorage.removeItem('chat_window_open');
      this.visibleSubject.next(false);
      return;
    }

    // ✅ rutas normales: respeta localStorage
    const storedOpen = localStorage.getItem('chat_window_open') === '1';
    this.visibleSubject.next(storedOpen);
  }

  open() {
    // si estás en /auth, NO abrir
    if (this.router.url.startsWith('/auth')) return;

    localStorage.setItem('chat_window_open', '1');
    this.visibleSubject.next(true);
  }

  close() {
    localStorage.setItem('chat_window_open', '0');
    this.visibleSubject.next(false);
  }

  toggle() {
    if (this.router.url.startsWith('/auth')) return;

    const newVal = !this.visibleSubject.getValue();
    localStorage.setItem('chat_window_open', newVal ? '1' : '0');
    this.visibleSubject.next(newVal);
  }
}





/*import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ChatUiStateService {
  private visibleSubject = new BehaviorSubject<boolean>(
    localStorage.getItem('chat_window_open') === '1'
  );

  visible$ = this.visibleSubject.asObservable();

  open() {
    localStorage.setItem('chat_window_open', '1');
    this.visibleSubject.next(true);
  }

  close() {
    localStorage.setItem('chat_window_open', '0');
    this.visibleSubject.next(false);
  }

  toggle() {
    const newVal = !this.visibleSubject.getValue();
    localStorage.setItem('chat_window_open', newVal ? '1' : '0');
    this.visibleSubject.next(newVal);
  }
}
*/