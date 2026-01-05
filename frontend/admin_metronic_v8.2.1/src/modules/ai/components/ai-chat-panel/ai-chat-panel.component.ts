
import { DomSanitizer } from '@angular/platform-browser';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
} from '@angular/core';

import { AiService } from '../../services/ai.service';
import Swal from 'sweetalert2';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

interface Message {
  text: string;
  isUser: boolean;
  timestamp: Date;
}

@Component({
  selector: 'app-ai-chat-panel',
  
  templateUrl: './ai-chat-panel.component.html',
  styleUrls: ['./ai-chat-panel.component.scss'],
})
export class AiChatPanelComponent implements OnDestroy, AfterViewInit {
  @ViewChild('chatContainer') chatContainer?: ElementRef<HTMLDivElement>;

  messages: Message[] = [];
  input = '';
  sending = false;
  suggestions: any[] = [];

  @Input() filters: any = {};

  private destroy$ = new Subject<void>();
  private scrolling = false; // evita loops de scroll

  // === PALABRAS CLAVE (solo frontend, para autocompletar) ===
  private intentKeywords: string[] = [
    'existencias bajas',
    'productos en umbral',
    'productos sin movimiento',
    'movimiento lento',
    'salidas por mes',
    'entradas por mes',
    'consumo por área',
    'análisis abc',
    'valor de inventario',
    'proyección de consumo',
    'pronóstico semanal',
    'productos estacionales',
  ];

  constructor(
    private aiService: AiService,
    private cdr: ChangeDetectorRef,
    public sanitizer: DomSanitizer
  ) {}

  // ============================================
  // INICIALIZACIÓN: CLICK EN BOTONES DEL PANEL IA
  // ============================================
  ngAfterViewInit(): void {
  const container = this.chatContainer?.nativeElement;
  if (!container) return;

  container.addEventListener('click', (event: any) => {
    const target = event.target as HTMLElement;
    const btn = target.closest('[data-ai-suggestion]');
    if (!btn) return;

    const fnName = btn.getAttribute('data-ai-suggestion');
    if (!fnName) return;

    this.onBackendSuggestionClick(fnName);
  });
}




  safe(html: string) {
  return this.sanitizer.bypassSecurityTrustHtml(html);
}
  

  

// Click sobre sugerencias del Backend → ejecuta función directa
  
  onBackendSuggestionClick(fnName: string): void {
  if (!fnName) return;

  // Prefijo especial: llamada directa a función del backend
  this.input = `__fn__:${fnName}`;
  this.suggestions = [];

  this.cdr.detectChanges();

  // Enviar automático
  setTimeout(() => this.send(), 50);
}


/*
  // ============================================
  // MÉTODO DE ENVÍO
  // ============================================
  send(): void {
    if (!this.input.trim() || this.sending) return;

    const rawInput = this.input.trim();
    const esLlamadaDirecta = this.isDirectFunctionCall(rawInput);

    let userMsg = this.input.trim();
    let backendText = rawInput;
    const cleanFilters: any = {};

    this.suggestions = []; // limpia sugerencias inline

    
    if (!esLlamadaDirecta) {
      if (this.filters?.product_id && this.filters.product_id !== 'all') {
        cleanFilters.product_id = this.filters.product_id;
        userMsg = `[Producto: ${this.filters.product_title}] ${userMsg}`;
      }
      if (this.filters?.area_id && this.filters.area_id !== 'all') {
        cleanFilters.area_id = this.filters.area_id;
        userMsg = `[Área: ${this.filters.area_name}] ${userMsg}`;
      }
    } else {
      // Si es llamada directa, limpiamos el prefijo antes de pintar
      userMsg = `(Atajo) ${userMsg.replace('__fn__:', '')}`;
    }

    // Pinta mensaje de usuario
    this.messages.push({
      text: userMsg,
      isUser: true,
      timestamp: new Date(),
    });

    this.input = '';
    this.sending = true;
    this.scrollToBottom();

    this.aiService
      .chat(this.inputSanitizedForBackend(backendText), cleanFilters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const reply = res.reply || res.answer || res;

          const normalized = this.normalizeBackendHtml(
            typeof reply === 'string' ? reply : JSON.stringify(reply)
          );

          this.messages.push({
            text: `<div class="msg-html">${normalized}</div>`,
            isUser: false,
            timestamp: new Date(),
          });

          this.sending = false;
          this.cdr.detectChanges();
          this.scrollToBottom();

          // Devuelve foco al input
          setTimeout(() => {
            const inputEl = document.querySelector(
              '#ai-chat-input'
            ) as HTMLInputElement;
            inputEl?.focus();
          }, 200);
        },

        error: () => {
          this.messages.push({
            text: this.buildOfflineFallbackPanel(),
            isUser: false,
            timestamp: new Date(),
          });

          this.sending = false;
          this.cdr.detectChanges();
          this.scrollToBottom();
        },
      });
  }
*/

send(): void {
  const rawInput = this.input.trim();
  if (!rawInput || this.sending) return;

  // 1) ¿Es llamada directa a función? (__fn__:handleXxx o handleXxx)
  const esLlamadaDirecta = this.isDirectFunctionCall(rawInput);

  // 2) Texto que se manda al backend SIEMPRE es el original
  const backendText = this.inputSanitizedForBackend(rawInput);

  // 3) Limpiamos sugerencias inline
  this.suggestions = [];

  const cleanFilters: any = {};
  let userBubbleText = rawInput;

  if (!esLlamadaDirecta) {
    // ============ CHAT NORMAL (texto libre) ============

    // Aplica filtros visibles SOLO para mensajes de usuario
    if (this.filters?.product_id && this.filters.product_id !== 'all') {
      cleanFilters.product_id = this.filters.product_id;
      userBubbleText = `[Producto: ${this.filters.product_title}] ${userBubbleText}`;
    }
    if (this.filters?.area_id && this.filters.area_id !== 'all') {
      cleanFilters.area_id = this.filters.area_id;
      userBubbleText = `[Área: ${this.filters.area_name}] ${userBubbleText}`;
    }

    // Pinta mensaje de USUARIO
    this.messages.push({
      text: userBubbleText,
      isUser: true,
      timestamp: new Date(),
    });
  } else {
    // ============ LLAMADA DIRECTA DESDE BOTÓN ============

    // NO mostramos "__fn__:handleXxx"
    // Solo una burbuja de IA avisando que está trabajando
    this.messages.push({
      text: `<div class="text-muted small">🔍 Ejecutando análisis solicitado…</div>`,
      isUser: false,          // 👈 IMPORTANTE: IA, no usuario
      timestamp: new Date(),
    });
  }

  // 4) Reset input + activar "IA está escribiendo"
  this.input = '';
  this.sending = true;
  this.cdr.detectChanges();
  this.scrollToBottom();

  // 5) Llamada al backend con EL TEXTO ORIGINAL
  this.aiService
    .chat(backendText, cleanFilters)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res) => {
        const reply = res.reply || res.answer || res;

        const normalized = this.normalizeBackendHtml(
          typeof reply === 'string' ? reply : JSON.stringify(reply)
        );

        this.messages.push({
          text: `<div class="msg-html">${normalized}</div>`,
          isUser: false,
          timestamp: new Date(),
        });

        this.sending = false;
        this.cdr.detectChanges();
        this.scrollToBottom();

        // Devuelve foco al input
        setTimeout(() => {
          const inputEl = document.querySelector(
            '#ai-chat-input'
          ) as HTMLInputElement;
          inputEl?.focus();
        }, 200);
      },

      error: () => {
        this.messages.push({
          text: this.buildOfflineFallbackPanel(),
          isUser: false,
          timestamp: new Date(),
        });

        this.sending = false;
        this.cdr.detectChanges();
        this.scrollToBottom();
      },
    });
}
  private buildOfflineFallbackPanel(): string {
  return `
    <div class="ia-card p-3 rounded-3 mb-3">
      <h5 class="mb-2 text-warning"><i class="fas fa-wifi-slash me-1"></i> No pude comunicarme con la IA</h5>
      <p class="text-muted small">Estoy disponible, pero no recibí suficiente información del servidor.</p>

      <div class='d-flex flex-column gap-2 mt-2'>
        <button class='btn btn-sm btn-secondary ai-suggestion-btn' data-ai-suggestion='handleEntryExitChart'>
          📊 Gráfica Entradas vs Salidas
        </button>
        <button class='btn btn-sm btn-secondary ai-suggestion-btn' data-ai-suggestion='handleLowStockProducts'>
          ⚠️ Productos con stock crítico
        </button>
        <button class='btn btn-sm btn-secondary ai-suggestion-btn' data-ai-suggestion='handleTopExitProducts'>
          🔝 Top productos más consumidos
        </button>
      </div>
    </div>`;
}

  /** Limpia prefijos internos antes de mandar al backend si no quieres que los vea tal cual */
  private inputSanitizedForBackend(text: string): string {
    // Por ahora lo mandamos igual; si quisieras ocultar __fn__ al backend, aquí lo procesas.
    return text.trim();
  }

  // Limpia HTML que pueda romper el tema, pero respeta nuestro panel y botones
  private normalizeBackendHtml(html: string): string {
    let clean = html || '';

    // 1. Mapear alerts de Bootstrap/Metronic a una tarjeta neutra
    clean = clean.replace(
      /class="alert([^"]*)"/gi,
      'class="ia-card$1"'
    );
    clean = clean.replace(
      /class='alert([^']*)'/gi,
      "class='ia-card$1'"
    );

    // 2. Eliminar estilos inline peligrosos
    clean = clean.replace(/style="[^"]*"/gi, '');
    clean = clean.replace(/style='[^']*'/gi, '');

    // 3. Normalizar texto blanco a texto oscuro
    clean = clean.replace(/class="text-white"/gi, 'class="text-dark"');
    clean = clean.replace(/class='text-white'/gi, "class='text-dark'");

    return clean;
  }

  private isDirectFunctionCall(text: string): boolean {
    const t = text.trim();
    return t.startsWith('__fn__:') || /^handle[A-Za-z0-9_]+$/.test(t);
  }

  // ============================================
  // SUGERENCIAS INLINE (teclado)
  // ============================================
  onInput(event: any): void {
    const q = (event.target.value || '').toLowerCase().trim();

    if (q.length < 2) {
      this.suggestions = [];
      return;
    }

    const matches = this.intentKeywords
      .filter((k) => k.toLowerCase().includes(q))
      .slice(0, 6)
      .map((k) => ({
        text: k,
        highlight: this.highlightMatch(k, q),
      }));

    this.suggestions = matches;
    this.cdr.detectChanges();
  }

  highlightMatch(text: string, query: string): string {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(
      regex,
      '<strong class="text-primary">$1</strong>'
    );
  }

  selectSuggestion(sug: any): void {
    this.input = sug.text;
    this.suggestions = [];
    this.send();
  }

  // ============================================
  // TOOLS
  // ============================================
  quickFill(t: string): void {
    this.input = t;
    this.suggestions = [];
    const el = document.getElementById(
      'ai-chat-input'
    ) as HTMLInputElement | null;
    if (el) setTimeout(() => el.focus(), 60);
  }

  clear(): void {
    Swal.fire({
      title: '¿Limpiar chat?',
      text: 'Se borrarán todos los mensajes.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, limpiar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
    }).then((r) => {
      if (r.isConfirmed) {
        this.messages = [];
      }
    });
  }

  private scrollToBottom(): void {
    if (this.scrolling) return;

    this.scrolling = true;
    setTimeout(() => {
      try {
        const el = this.chatContainer?.nativeElement;
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      } catch {}
      this.scrolling = false;
    }, 60);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}




/*
  executeShortcut(fnName: string): void {
  if (!fnName) return;

  // Limpieza de comillas basura
  fnName = fnName.replace(/['"]/g, '').trim();

  this.sending = true;
  this.messages.push({
    text: '(Ejecutando análisis solicitado...)',
    isUser: true,
    timestamp: new Date()
  });

  this.aiService
    .chat(`__fn__:${fnName}`, {})        // ← llamado oculto
    .subscribe({
      next: (res) => {
        const reply = res.reply || res.answer || res;
        this.sending = false;

        this.messages.push({
          text: `<div class="msg-html">${reply}</div>`,
          isUser: false,
          timestamp: new Date()
        });

        this.scrollToBottom();
      },
      error: () => {
        this.sending = false;
      }
    });
}
*/


/*
import {
  AfterViewChecked,
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild
} from '@angular/core';

import { AiService } from '../../services/ai.service';
import Swal from 'sweetalert2';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface Message {
  text: string;
  isUser: boolean;
  timestamp: Date;
}

@Component({
  selector: 'app-ai-chat-panel',
  templateUrl: './ai-chat-panel.component.html',
  styleUrls: ['./ai-chat-panel.component.scss'],
})
export class AiChatPanelComponent
  implements OnDestroy, AfterViewChecked, AfterViewInit
{
  @ViewChild('chatContainer') chatContainer?: ElementRef<HTMLDivElement>;

  messages: Message[] = [];
  input = '';
  sending = false;
  suggestions: any[] = [];

  @Input() filters: any = {};

  private destroy$ = new Subject<void>();

  // === PALABRAS CLAVE (solo frontend) ===
  private intentKeywords: string[] = [
    'stock bajo',
    'stock crítico',
    'salidas mes',
    'entradas por proveedor',
    'top productos',
    'consumo por área',
    'análisis abc',
    'predecir agotamiento',
    'movimiento lento',
    'productos estacionales',
    'salidas por subarea',
    'entradas por mes',
    'grafico entradas salidas',
    'valor inventario',
  ];

  constructor(
    private aiService: AiService,
    private cdr: ChangeDetectorRef
  ) {}

  // ============================================
  // SCROLL AUTOMÁTICO Y CONSISTENTE
  // ============================================
  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  ngAfterViewInit(): void {
    // Delegación de eventos SOLO AQUÍ
    if (this.chatContainer) {
      this.chatContainer.nativeElement.addEventListener(
        'click',
        (event: Event) => {
          const target = event.target as HTMLElement;
          const btn = target.closest(
            '.ai-suggestion-btn'
          ) as HTMLElement | null;

          if (btn?.dataset?.['aiSuggestion']) {
            const query = btn.dataset['aiSuggestion']!;
            this.onBackendSuggestionClick(query);
          }
        }
      );
    }
  }

  // Click sobre sugerencias del Backend
  onBackendSuggestionClick(query: string): void {
    this.input = query;
    this.suggestions = []; // limpia sugerencias inline

    const el = document.getElementById(
      'ai-chat-input'
    ) as HTMLInputElement | null;
    if (el) {
      setTimeout(() => el.focus(), 80);
    }
  }

  // ============================================
  // MÉTODO DE ENVÍO
  // ============================================
  send(): void {
    if (!this.input.trim() || this.sending) return;

    let userMsg = this.input.trim();

    this.suggestions = []; // limpia sugerencias inline

    // Filtros visibles
    const cleanFilters: any = {};
    if (this.filters?.product_id && this.filters.product_id !== 'all') {
      cleanFilters.product_id = this.filters.product_id;
      userMsg = `[Producto: ${this.filters.product_title}] ${userMsg}`;
    }
    if (this.filters?.area_id && this.filters.area_id !== 'all') {
      cleanFilters.area_id = this.filters.area_id;
      userMsg = `[Área: ${this.filters.area_name}] ${userMsg}`;
    }

    // Pinta mensaje de usuario
    this.messages.push({
      text: userMsg,
      isUser: true,
      timestamp: new Date(),
    });

    this.input = '';
    this.sending = true;

    this.aiService
      .chat(userMsg, cleanFilters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const reply = res.reply || res.answer || res;

          // LIMPIA sugerencias inline si el backend envía panel
          if (typeof reply === 'string' && reply.includes('ai-suggestion-panel')) {
            this.suggestions = [];
          }

          const normalized = this.normalizeBackendHtml(reply);
          this.messages.push({
            text: `<div class="msg-html">${normalized}</div>`,
            isUser: false,
            timestamp: new Date(),
          });

          this.sending = false;
          this.cdr.detectChanges();

          setTimeout(() => this.scrollToBottom(), 80);

          // Devuelve foco al input
          setTimeout(() => {
            const inputEl = document.querySelector(
              '#ai-chat-input'
            ) as HTMLInputElement;
            inputEl?.focus();
          }, 200);
        },

        error: () => {
          this.messages.push({
            text: `<div class="text-danger">
              <i class="fas fa-exclamation-triangle"></i> Error de conexión. Intenta de nuevo.
            </div>`,
            isUser: false,
            timestamp: new Date(),
          });

          this.sending = false;
          this.cdr.detectChanges();
          setTimeout(() => this.scrollToBottom(), 80);
        },
      });
  }

  private normalizeBackendHtml(html: string): string {
  let clean = html;

  // 1. Quitar clases bootstrap/metronic que rompen theme
  clean = clean.replace(/class="alert[^"]*"/gi, 'class="ia-card"');
  clean = clean.replace(/class='alert[^']*'/gi, "class='ia-card'");

  // 2. Forzar que NO tenga estilos inline de Bootstrap
  clean = clean.replace(/style="[^"]*"/gi, '');
  clean = clean.replace(/style='[^']*'/gi, '');

  return clean;
}
  private sanitizeReply(html: string): string {
  return html
    // elimina color blanco
    .replace(/color:\s*#fff+/gi, '')
    .replace(/color:\s*white/gi, '')
    // elimina opacidad cero
    .replace(/opacity:\s*0(\.\d+)?/gi, '')
    .replace(/opacity:\s*0/gi, '')
    // elimina estilos inline peligrosos
    .replace(/style="[^"]*"/gi, '')
    .replace(/style='[^']*'/gi, '')
    // elimina clases invisibles de bootstrap/metronic
    .replace(/class="text-white"/gi, 'class="text-dark"')
    .replace(/class='text-white'/gi, 'class="text-dark"');
}

  // ============================================
  // SUGERENCIAS INLINE
  // ============================================
  onInput(event: any): void {
    const q = event.target.value.toLowerCase().trim();

    if (q.length < 2) {
      this.suggestions = [];
      return;
    }

    const matches = this.intentKeywords
      .filter((k) => k.toLowerCase().includes(q))
      .slice(0, 6)
      .map((k) => ({
        text: k,
        highlight: this.highlightMatch(k, q),
      }));

    this.suggestions = matches;
    this.cdr.detectChanges();
  }

  highlightMatch(text: string, query: string): string {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(
      regex,
      '<strong class="text-primary">$1</strong>'
    );
  }

  selectSuggestion(sug: any): void {
    this.input = sug.text;
    this.suggestions = [];
    this.send();
  }

  // ============================================
  // TOOLS
  // ============================================
  quickFill(t: string): void {
    this.input = t;
    this.suggestions = [];
    const el = document.getElementById(
      'ai-chat-input'
    ) as HTMLInputElement | null;
    if (el) setTimeout(() => el.focus(), 60);
  }

  clear(): void {
    Swal.fire({
      title: '¿Limpiar chat?',
      text: 'Se borrarán todos los mensajes.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, limpiar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
    }).then((r) => {
      if (r.isConfirmed) {
        this.messages = [];
      }
    });
  }

  private scrollToBottom(): void {
    try {
      const el = this.chatContainer?.nativeElement;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    } catch {}
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
*/