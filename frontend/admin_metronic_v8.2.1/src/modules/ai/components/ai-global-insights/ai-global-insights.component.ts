import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { AiService, Subarea, Product } from '../../services/ai.service';
import { Chart } from 'chart.js/auto';
import { NotificationService } from 'src/app/services/notification.service';
import { Router } from '@angular/router';
import { calendarFormat } from 'moment';
import { CommonModule } from '@angular/common';

interface Insight {
  type: string;
  summary: string;
  severity: number;
  product_id?: number;
  area_id?: number;
  subarea_id?: number;
  details?: any;
}

interface Forecast {
  '3_meses': number[];
  '6_meses': number[];
  '12_meses': number[];
}

interface Report {
  narrativa_global: string;
  proyeccion_consumo: Forecast;
  insights: Insight[];
  generated_at: string;
  historico_consumo?: number[];
  confianza?: number;
  desviacion?: number;

  // ✅ NUEVO: recomendación de compra
  recomendacion_compra?: {
    cantidad_sugerida: number | null;
    mes_recomendado: string | null;
    motivo: string;
  } | null;
}

@Component({
  selector: 'app-ai-global-insights',
  
  templateUrl: './ai-global-insights.component.html',
  styleUrls: ['./ai-global-insights.component.scss']
})
export class AiGlobalInsightsComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('forecastChart', { static: false }) canvas!: ElementRef<HTMLCanvasElement>;
  private destroy$ = new Subject<void>();
  private chart!: Chart;
  private requestInProgress = false;

  @Input() filters: any = {};

  loading = false;
  report: Report | null = null;
  filtersForm!: FormGroup;

  areas: any[] = [];
  subareas: any[] = [];
  categorias: any[] = [];

  subareasSearch: Subarea[] = [];
  productos: Product[] = [];
  partidas: any[] = [];

  private subareaSearch$ = new Subject<string>();
  private productSearch$ = new Subject<string>();
  private partidaSearch$ = new Subject<string>();

  constructor(
    private fb: FormBuilder,
    private aiService: AiService,
    private notification: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadInitialData();
    this.setupSearchStreams();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filters'] && !changes['filters'].firstChange) {
      const f = changes['filters'].currentValue || {};
      this.filtersForm.patchValue({
        area_id: f.area_id !== 'all' ? f.area_id : null,
        subarea_id: f.subarea_id !== 'all' ? f.subarea_id : null,
        categoria_id: f.category_id !== 'all' ? f.category_id : null,
        product_id: f.product_id !== 'all' ? f.product_id : null
      }, { emitEvent: false });

      if (f.area_id && f.area_id !== 'all') {
        this.loadSubareasByArea(+f.area_id);
      }
      this.loadReport();
    }
  }

  private initForm(): void {
    this.filtersForm = this.fb.group({
      area_id: [null],
      subarea_id: [null],
      product_id: [null],
      categoria_id: [null],
      partida_id: [null],
      fecha_inicio: [null]
    });

    this.filtersForm.valueChanges
      .pipe(debounceTime(800), takeUntil(this.destroy$))
      .subscribe(() => this.loadReport());
  }

  private loadInitialData(): void {
    this.aiService.getAreas().subscribe(res => this.areas = Array.isArray(res) ? res : []);

    this.aiService.getCategorias().subscribe((res: any) => {
      const arr = Array.isArray(res) ? res : (res?.categories || res?.data || res || []);
      this.categorias = arr.map((c: any) => ({
        id: c.id || c.category_id,
        name: c.name || c.title || c.category_name || 'Sin nombre'
      }));
      this.cdr.detectChanges();
    });
  }

  private loadSubareasByArea(areaId: number): void {
    this.aiService.getSubareasByArea(areaId).subscribe({
      next: (res) => this.subareas = Array.isArray(res) ? res : (res.subareas || []),
      error: () => this.subareas = []
    });
  }

  private setupSearchStreams(): void {
    this.subareaSearch$.pipe(
      debounceTime(300), distinctUntilChanged(),
      switchMap(term => term.trim() ? this.aiService.searchSubareas(term) : of({ subareas: [] })),
      takeUntil(this.destroy$)
    ).subscribe(res => this.subareasSearch = res.subareas || []);

    this.productSearch$.pipe(
      debounceTime(300), distinctUntilChanged(),
      switchMap(term => term.trim() ? this.aiService.searchProducts(term) : of({ products: [] })),
      takeUntil(this.destroy$)
    ).subscribe(res => this.productos = res.products || []);

    this.partidaSearch$.pipe(
      debounceTime(300), distinctUntilChanged(),
      switchMap(term => term.trim() ? this.aiService.searchPartidas(term) : of([])),
      takeUntil(this.destroy$)
    ).subscribe((res: any) => {
      this.partidas = Array.isArray(res) ? res : (res?.partidas || res?.data || []);
      this.cdr.detectChanges();
    });
  }

  searchSubarea(e: Event) { this.subareaSearch$.next((e.target as HTMLInputElement).value); }
  searchProduct(e: Event) { this.productSearch$.next((e.target as HTMLInputElement).value); }
  searchPartida(e: Event) { this.partidaSearch$.next((e.target as HTMLInputElement).value); }

  selectSubarea(s: Subarea) {
    this.filtersForm.patchValue({ subarea_id: s.id });
    this.subareasSearch = [];
    const input = document.querySelector('input[placeholder="Buscar subárea..."]') as HTMLInputElement;
    if (input) input.value = s.name;
    this.loadReport();
  }

  selectProduct(p: Product) {
    this.filtersForm.patchValue({ product_id: p.product_id });
    this.productos = [];
    const input = document.querySelector('input[placeholder="Buscar producto..."]') as HTMLInputElement;
    if (input) input.value = p.title;
    this.loadReport();
  }

  selectPartida(partida: any): void {
    this.filtersForm.patchValue({ partida_id: partida.id });
    this.partidas = [];
    const input = document.querySelector('input[placeholder="Buscar partida..."]') as HTMLInputElement;
    if (input) input.value = partida.name;
    this.loadReport();
  }

  // ✅ NUEVA FUNCIÓN: Limpiar todos los filtros
  clearFilters(): void {
    // Resetear el formulario
    this.filtersForm.reset({
      area_id: null,
      subarea_id: null,
      product_id: null,
      categoria_id: null,
      partida_id: null,
      fecha_inicio: null
    });

    // Limpiar arrays de búsqueda
    this.subareasSearch = [];
    this.productos = [];
    this.partidas = [];
    this.subareas = [];

    // Limpiar inputs de búsqueda
    const inputs = [
      'input[placeholder="Buscar subárea..."]',
      'input[placeholder="Buscar producto..."]',
      'input[placeholder="Buscar partida..."]'
    ];
    
    inputs.forEach(selector => {
      const input = document.querySelector(selector) as HTMLInputElement;
      if (input) input.value = '';
    });

    // Limpiar reporte actual
    this.report = null;

    // Destruir gráfica si existe
    try {
      if (this.chart) {
        this.chart.destroy();
        this.chart = null as any;
      }
    } catch (e) {
      console.warn('Error al destruir gráfica:', e);
    }

    this.notification.success('Filtros limpiados correctamente');
    this.cdr.detectChanges();
  }

  loadReport(): void {
    if (this.requestInProgress) {
      console.warn('Ya hay una petición en progreso');
      return;
    }

    this.requestInProgress = true;
    this.loading = true;
    this.report = null;

    // Destruir gráfica antes de nueva petición
    try {
      if (this.chart) {
        this.chart.destroy();
        this.chart = null as any;
      }
    } catch (e) {
      console.warn('Error al destruir gráfica anterior:', e);
    }

    // 🔥 Limpieza completa de filtros
    const raw = this.filtersForm.value;
    const clean: any = {};
    const mapping: any = { categoria_id: 'category_id' };

    Object.entries(raw).forEach(([key, val]: any) => {
      if (val === null || val === '' || val === 'all' || val === undefined) return;
      const mappedKey = mapping[key] ?? key;
      clean[mappedKey] = val;
    });

    // 🔹 Año automático si no se envía
    clean.year = new Date().getFullYear();

    console.log('📡 Filtros LIMPIOS hacia IA:', clean);

    this.aiService.getGlobalAnalysis(clean)
      .pipe(timeout(30000), takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          const data = res?.data || res || {};

          this.report = {
            narrativa_global: data.narrativa_global || 'Análisis completado.',
            proyeccion_consumo: this.normalizeForecast(data.proyeccion_consumo || {}),
            insights: Array.isArray(data.insights) ? data.insights : [],
            generated_at: data.generated_at || new Date().toISOString(),
            historico_consumo: Array.isArray(data.historico_consumo)
              ? [...data.historico_consumo]
              : [],
            confianza: typeof data.confianza === 'number' ? data.confianza : 0.92,
            recomendacion_compra: data.recomendacion_compra || null
          };

          console.log('📥 REPORTE IA RECIBIDO:', this.report);

          this.loading = false;
          this.requestInProgress = false;

          // ✅ MEJOR sincronización con el DOM
          this.cdr.detectChanges();

          requestAnimationFrame(() => {
            if (this.canvas?.nativeElement && this.report?.historico_consumo?.length) {
              this.renderChart();
            } else {
              console.warn('Canvas o datos no disponibles para graficar');
            }
          });
        },
        error: (err) => {
          console.error('Error IA:', err);
          this.notification.error('Error al obtener análisis IA');
          this.report = this.getFallbackReport();
          this.loading = false;
          this.requestInProgress = false;
          
          this.cdr.detectChanges();
          requestAnimationFrame(() => {
            if (this.canvas?.nativeElement) {
              this.renderChart();
            }
          });
        }
      });
  }

  private normalizeForecast(raw: any): Forecast {
    const toArray = (v: any): number[] => {
      if (Array.isArray(v)) return v.map(Number);
      if (v && typeof v === 'object') return Object.values(v).map(Number);
      return [];
    };
    return {
      '3_meses': toArray(raw?.['3_meses'] || raw?.['3_meses']),
      '6_meses': toArray(raw?.['6_meses'] || raw?.['6_meses']),
      '12_meses': toArray(raw?.['12_meses'] || raw?.['12_meses'])
    };
  }

  private renderChart(): void {
    // ✅ Validaciones mejoradas
    if (!this.canvas?.nativeElement) {
      console.warn('Canvas no disponible aún');
      return;
    }

    if (!this.report) {
      console.warn('No hay reporte para graficar');
      return;
    }

    const hist = this.report.historico_consumo;
    if (!Array.isArray(hist) || hist.length === 0) {
      console.warn('No hay datos históricos para graficar');
      return;
    }

    // Validar que sean números válidos
    if (!hist.every(v => typeof v === 'number' && !isNaN(v))) {
      console.error('Datos históricos contienen valores no numéricos');
      return;
    }

    // DESTRUIR SI YA EXISTE (de forma más segura)
    try {
      if (this.chart) {
        this.chart.destroy();
        this.chart = null as any;
      }
    } catch (e) {
      console.warn('Error al destruir gráfica anterior:', e);
    }

    const ctx = this.canvas.nativeElement;
    const past = hist.length;
    const p3 = this.report.proyeccion_consumo['3_meses'] || [];
    const p12 = this.report.proyeccion_consumo['12_meses'] || [];
    const labels = this.generateLabels(past, Math.max(p3.length, p12.length, 12));

    try {
      this.chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Histórico Real',
              data: [...hist, ...Array(20).fill(null)],
              borderColor: '#3699ff',
              backgroundColor: 'rgba(54,153,255,0.1)',
              fill: true,
              tension: 0.4,
              pointRadius: 4
            },
            {
              label: 'Pronóstico 3 meses',
              data: [...Array(past).fill(null), ...p3],
              borderColor: '#00c853',
              borderDash: [8, 4],
              pointRadius: 5
            },
            {
              label: 'Pronóstico 12 meses',
              data: [...Array(past).fill(null), ...p12],
              borderColor: '#ff6b6b',
              borderDash: [8, 4],
              pointRadius: 5
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            title: { 
              display: true, 
              text: 'Proyección de Consumo - IA Predictiva', 
              font: { size: 16, weight: 'bold' } 
            }
          },
          scales: { y: { beginAtZero: true } }
        }
      });

      console.log('✅ GRÁFICA PINTADA CON ÉXITO');
    } catch (error) {
      console.error('Error al crear gráfica:', error);
      this.notification.error('Error al generar gráfica');
    }
  }

  // ✅ CORREGIDA: Generación de etiquetas más precisa
  private generateLabels(past: number, future: number): string[] {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const now = new Date();
    const result: string[] = [];

    // HISTÓRICO: desde (mes_actual - past) hasta mes_actual
    for (let i = past - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthIndex = date.getMonth();
      result.push(`${months[monthIndex]} ${date.getFullYear()}`);
    }

    // FUTURO: desde el mes siguiente
    for (let i = 1; i <= future; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthIndex = date.getMonth();
      result.push(`${months[monthIndex]} ${date.getFullYear()}`);
    }

    return result;
  }

  getSeverityBadge(severity: number): string {
    if (severity >= 4) return 'bg-danger';
    if (severity === 3) return 'bg-warning';
    if (severity === 2) return 'bg-info';
    return 'bg-secondary';
  }

  getSeverityText(severity: number): string {
    if (severity >= 4) return 'Crítica';
    if (severity === 3) return 'Alta';
    if (severity === 2) return 'Media';
    return 'Baja';
  }

  private getFallbackReport(): Report {
    return {
      narrativa_global: 'Sistema en modo local. Consumo estable detectado.',
      proyeccion_consumo: { 
        '3_meses': [1200, 1300, 1400], 
        '6_meses': [1200, 1300, 1400, 1350, 1450, 1500], 
        '12_meses': Array(12).fill(1200).map((_, i) => 1200 + i * 50) 
      },
      insights: [],
      generated_at: new Date().toISOString(),
      confianza: 0.89
    };
  }

  goBack(): void {
    this.router.navigate(['..']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    
    try {
      if (this.chart) {
        this.chart.destroy();
        this.chart = null as any;
      }
    } catch (e) {
      console.warn('Error al destruir gráfica en ngOnDestroy:', e);
    }
  }
}



/*import { Component, OnInit, OnDestroy, Input, OnChanges, SimpleChanges, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { AiService, Subarea, Product } from '../../services/ai.service';
import { Chart } from 'chart.js/auto';
import { NotificationService } from 'src/app/services/notification.service';
import { Router } from '@angular/router';
import { calendarFormat } from 'moment';
import { CommonModule } from '@angular/common';

interface Insight {
  type: string;
  summary: string;
  severity: number;
  product_id?: number;
  area_id?: number;
  subarea_id?: number;
  details?: any;
}

interface Forecast {
  '3_meses': number[];
  '6_meses': number[];
  '12_meses': number[];
}

interface Report {
  narrativa_global: string;
  proyeccion_consumo: Forecast;
  insights: Insight[];
  generated_at: string;
  historico_consumo?: number[];
  confianza?: number;
  desviacion?: number;

  // ✅ NUEVO: recomendación de compra
  recomendacion_compra?: {
    cantidad_sugerida: number | null;
    mes_recomendado: string | null;
    motivo: string;
  } | null;
}

@Component({
  selector: 'app-ai-global-insights',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule
  ],
  templateUrl: './ai-global-insights.component.html',
  styleUrls: ['./ai-global-insights.component.scss']
})
export class AiGlobalInsightsComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('forecastChart', { static: false }) canvas!: ElementRef<HTMLCanvasElement>;
  private destroy$ = new Subject<void>();
  private chart!: Chart;
  private requestInProgress = false;

  @Input() filters: any = {};

  loading = false;
  report: Report | null = null;
  filtersForm!: FormGroup;

  areas: any[] = [];
  subareas: any[] = [];
  categorias: any[] = [];

  subareasSearch: Subarea[] = [];
  productos: Product[] = [];
  partidas: any[] = [];

  private subareaSearch$ = new Subject<string>();
  private productSearch$ = new Subject<string>();
  private partidaSearch$ = new Subject<string>();

  constructor(
    private fb: FormBuilder,
    private aiService: AiService,
    private notification: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadInitialData();
    this.setupSearchStreams();
    
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['filters'] && !changes['filters'].firstChange) {
      const f = changes['filters'].currentValue || {};
      this.filtersForm.patchValue({
        area_id: f.area_id !== 'all' ? f.area_id : null,
        subarea_id: f.subarea_id !== 'all' ? f.subarea_id : null,
        categoria_id: f.category_id !== 'all' ? f.category_id : null,
        product_id: f.product_id !== 'all' ? f.product_id : null
      }, { emitEvent: false });

      if (f.area_id && f.area_id !== 'all') {
        this.loadSubareasByArea(+f.area_id);
      }
      this.loadReport();
    }
  }

  

  private initForm(): void {
    this.filtersForm = this.fb.group({
      area_id: [null],
      subarea_id: [null],
      product_id: [null],
      categoria_id: [null],
      partida_id: [null],
      fecha_inicio: [null]
    });

    this.filtersForm.valueChanges
      .pipe(debounceTime(800), takeUntil(this.destroy$))
      .subscribe(() => this.loadReport());
  }

  private loadInitialData(): void {
    this.aiService.getAreas().subscribe(res => this.areas = Array.isArray(res) ? res : []);

    this.aiService.getCategorias().subscribe((res: any) => {
      const arr = Array.isArray(res) ? res : (res?.categories || res?.data || res || []);
      this.categorias = arr.map((c: any) => ({
        id: c.id || c.category_id,
        name: c.name || c.title || c.category_name || 'Sin nombre'
      }));
      this.cdr.detectChanges();
    });
  }

  private loadSubareasByArea(areaId: number): void {
    this.aiService.getSubareasByArea(areaId).subscribe({
      next: (res) => this.subareas = Array.isArray(res) ? res : (res.subareas || []),
      error: () => this.subareas = []
    });
  }

  private setupSearchStreams(): void {
    this.subareaSearch$.pipe(
      debounceTime(300), distinctUntilChanged(),
      switchMap(term => term.trim() ? this.aiService.searchSubareas(term) : of({ subareas: [] })),
      takeUntil(this.destroy$)
    ).subscribe(res => this.subareasSearch = res.subareas || []);

    this.productSearch$.pipe(
      debounceTime(300), distinctUntilChanged(),
      switchMap(term => term.trim() ? this.aiService.searchProducts(term) : of({ products: [] })),
      takeUntil(this.destroy$)
    ).subscribe(res => this.productos = res.products || []);

    // PARTIDAS → TU RUTA REAL ES /api/partidas/buscar (no /search)
    this.partidaSearch$.pipe(
      debounceTime(300), distinctUntilChanged(),
      switchMap(term => term.trim() ? this.aiService.searchPartidas(term) : of([])),
      takeUntil(this.destroy$)
    ).subscribe((res: any) => {
      this.partidas = Array.isArray(res) ? res : (res?.partidas || res?.data || []);
      this.cdr.detectChanges();
    });
  }

  searchSubarea(e: Event) { this.subareaSearch$.next((e.target as HTMLInputElement).value); }
  searchProduct(e: Event) { this.productSearch$.next((e.target as HTMLInputElement).value); }
  searchPartida(e: Event) { this.partidaSearch$.next((e.target as HTMLInputElement).value); }

  selectSubarea(s: Subarea) {
    this.filtersForm.patchValue({ subarea_id: s.id });
    this.subareasSearch = [];
    const input = document.querySelector('input[placeholder="Buscar subárea..."]') as HTMLInputElement;
    if (input) input.value = s.name;
    this.loadReport();
  }

  selectProduct(p: Product) {
    this.filtersForm.patchValue({ product_id: p.product_id });
    this.productos = [];
    const input = document.querySelector('input[placeholder="Buscar producto..."]') as HTMLInputElement;
    if (input) input.value = p.title;
    this.loadReport();
  }

  selectPartida(partida: any): void {
  this.filtersForm.patchValue({ partida_id: partida.id }); // id = 21101, 22201, etc.
  this.partidas = [];
  const input = document.querySelector('input[placeholder="Buscar partida..."]') as HTMLInputElement;
  if (input) input.value = partida.name;
  
  this.loadReport(); // ← AHORA SÍ LA IA VA A FILTRAR PERFECTO POR PARTIDA
}

  loadReport(): void {
  if (this.requestInProgress) return;

  this.requestInProgress = true;
  this.loading = true;
  this.report = null;

  // 🔥 Limpieza completa de filtros
  const raw = this.filtersForm.value;

  const clean: any = {};
  const mapping: any = { categoria_id: 'category_id' };

  Object.entries(raw).forEach(([key, val]: any) => {
    if (val === null || val === '' || val === 'all' || val === undefined) return;

    const mappedKey = mapping[key] ?? key;
    clean[mappedKey] = val;
  });

  // 🔹 Año automático si no se envía
  clean.year = new Date().getFullYear();

  console.log('📡 Filtros LIMPIOS hacia IA:', clean);

  this.aiService.getGlobalAnalysis(clean)
    .pipe(timeout(30000), takeUntil(this.destroy$))
    .subscribe({
      next: (res: any) => {
        const data = res?.data || res || {};

        this.report = {
          narrativa_global: data.narrativa_global || 'Análisis completado.',
          proyeccion_consumo: this.normalizeForecast(data.proyeccion_consumo || {}),
          insights: Array.isArray(data.insights) ? data.insights : [],
          generated_at: data.generated_at || new Date().toISOString(),
          historico_consumo: Array.isArray(data.historico_consumo)
            ? [...data.historico_consumo]
            : [],
          confianza: typeof data.confianza === 'number' ? data.confianza : 0.92,
          recomendacion_compra: data.recomendacion_compra || null
        };

        console.log('📥 REPORTE IA RECIBIDO:', this.report);

        this.loading = false;
        this.requestInProgress = false;

        setTimeout(() => {
          this.cdr.detectChanges();
          this.renderChart();
        }, 0);
      },
      error: (err) => {
        console.warn('Error IA:', err);
        this.report = this.getFallbackReport();
        this.renderChart();
        this.loading = false;
        this.requestInProgress = false;
      }
    });
}


  private normalizeForecast(raw: any): Forecast {
    const toArray = (v: any): number[] => {
      if (Array.isArray(v)) return v.map(Number);
      if (v && typeof v === 'object') return Object.values(v).map(Number);
      return [];
    };
    return {
      '3_meses': toArray(raw?.['3_meses'] || raw?.['3_meses']),
      '6_meses': toArray(raw?.['6_meses'] || raw?.['6_meses']),
      '12_meses': toArray(raw?.['12_meses'] || raw?.['12_meses'])
    };
  }

  private renderChart(): void {
  if (!this.canvas?.nativeElement) {
    console.warn('Canvas no disponible aún');
    return;
  }

  if (!this.report?.historico_consumo?.length) {
    console.warn('No hay datos históricos');
    return;
  }

  // DESTRUIR SI YA EXISTE
  if (this.chart) {
    this.chart.destroy();
  }

  const ctx = this.canvas.nativeElement;
  const hist = this.report.historico_consumo;
  const past = hist.length;
  const p3 = this.report.proyeccion_consumo['3_meses'] || [];
  const p12 = this.report.proyeccion_consumo['12_meses'] || [];
  const labels = this.generateLabels(past, Math.max(p3.length, p12.length, 12));

  this.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Histórico Real',
          data: [...hist, ...Array(20).fill(null)],
          borderColor: '#3699ff',
          backgroundColor: 'rgba(54,153,255,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 4
        },
        {
          label: 'Pronóstico 3 meses',
          data: [...Array(past).fill(null), ...p3],
          borderColor: '#00c853',
          borderDash: [8, 4],
          pointRadius: 5
        },
        {
          label: 'Pronóstico 12 meses',
          data: [...Array(past).fill(null), ...p12],
          borderColor: '#ff6b6b',
          borderDash: [8, 4],
          pointRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        title: { display: true, text: 'Proyección de Consumo - IA Predictiva', font: { size: 16, weight: 'bold' } }
      },
      scales: { y: { beginAtZero: true } }
    }
  });

  console.log('GRÁFICA PINTADA CON ÉXITO');
}

  private generateLabels(past: number, future: number): string[] {
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const now = new Date();
  const result: string[] = [];

  // HISTÓRICO: índice 0 = enero → ajusta -1
  for (let i = 0; i < past; i++) {
    const monthIndex = i; // 0 = Ene, 1 = Feb, ..., 9 = Oct
    const d = new Date(now.getFullYear(), monthIndex, 1);
    result.push(`${months[monthIndex]} ${d.getFullYear()}`);
  }

  // FUTURO: desde el mes siguiente
  for (let i = 1; i <= future; i++) {
    const monthIndex = (now.getMonth() + i) % 12;
    const year = now.getFullYear() + Math.floor((now.getMonth() + i) / 12);
    result.push(`${months[monthIndex]} ${year}`);
  }

  return result;
}

 

  // ← TUS FUNCIONES ORIGINALES, DEVUELTAS Y MEJORADAS
  getSeverityBadge(severity: number): string {
    if (severity >= 4) return 'bg-danger';
    if (severity === 3) return 'bg-warning';
    if (severity === 2) return 'bg-info';
    return 'bg-secondary';
  }

  getSeverityText(severity: number): string {
    if (severity >= 4) return 'Crítica';
    if (severity === 3) return 'Alta';
    if (severity === 2) return 'Media';
    return 'Baja';
  }

  private getFallbackReport(): Report {
    return {
      narrativa_global: 'Sistema en modo local. Consumo estable detectado.',
      proyeccion_consumo: { '3_meses': [1200,1300,1400], '6_meses': [1200,1300,1400,1350,1450,1500], '12_meses': Array(12).fill(1200).map((_,i)=>1200+i*50) },
      insights: [],
      generated_at: new Date().toISOString(),
      confianza: 0.89
    };
  }

  goBack(): void {
    this.router.navigate(['..']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.chart?.destroy();
  }
} */