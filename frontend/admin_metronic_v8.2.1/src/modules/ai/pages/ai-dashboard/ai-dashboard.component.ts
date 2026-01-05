import { Component, OnInit, AfterViewInit, OnDestroy, Input, ChangeDetectorRef, NgZone } from '@angular/core';
import { AiService } from '../../services/ai.service';
import { AuthService } from 'src/app/modules/auth';
import { Chart, ChartConfiguration } from 'chart.js';
import Swal from 'sweetalert2';
import { Subject, takeUntil } from 'rxjs';
import { Router } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { VehicleDashboardComponent } from '../../components/vehicle-dashboard.component/vehicle-dashboard.component';
import { AiAreasComparisonComponent } from '../../components/ai-areas-comparison/ai-areas-comparison.component';
import { AiChatPanelComponent } from '../../components/ai-chat-panel/ai-chat-panel.component';
import { AiGlobalInsightsComponent } from '../../components/ai-global-insights/ai-global-insights.component';
import { AiPriorityProductsComponent } from '../../components/ai-priority-products/ai-priority-products.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';


@Component({
  selector: 'app-ai-dashboard',
  
  templateUrl: './ai-dashboard.component.html',
  styleUrls: ['./ai-dashboard.component.scss']
})
export class AiDashboardComponent implements OnInit, AfterViewInit, OnDestroy {

  globalFilters: any = {
    year: new Date().getFullYear(),
    area_id: 'all',
    subarea_id: 'all',
    category_id: 'all',
    product_id: 'all',
    
  };

  private destroy$ = new Subject<void>();
  private chartForecast: Chart | null = null;
  private chartComparison: Chart | null = null;
  private router: Router; // (no lo usamos, pero lo dejo por si luego lo integras)
  

  @Input() filters: any = {};

  loading = false;
  data: any = null;
  activeTab: string = 'dashboard';

  

  stats = {
  totalConsumption: 0,
  activeAreas: 0,
  nextMonth: 0,
  trendPercent: '—',
  trendIcon: ''
};
  error: string | null = null;
  forecastEntries: { key: string; value: number }[] = [];

  years: number[] = [];
  areas: any[] = [];
  subareas: any[] = [];
  categories: any[] = [];
  products: any[] = [];
  filteredProducts: any[] = [];

  

  constructor(
    private aiService: AiService,
    private authService: AuthService,
    private location: Location,
    private cdr: ChangeDetectorRef,
    private ngzone: NgZone,
  ) {}

  ngOnInit(): void {
    console.log('✅ AiDashboardComponent inicializado');

    this.generateYears();

    // 🔹 Aseguramos defaults en filters para evitar undefined raros
    if (!this.filters.year) {
      this.filters.year = this.years[0];
    }
    this.filters.area_id ??= 'all';
    this.filters.subarea_id ??= 'all';
    this.filters.category_id ??= 'all';
    this.filters.product_id ??= 'all';
    this.filters.product_search ??= '';

    this.loadInitialDataWithFallback();
    this.loadGlobalReportWithRetry();
  }

  ngAfterViewInit(): void {
    // Reintento por si el DOM aún no está listo
    setTimeout(() => this.safeRenderCharts(), 300);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.chartForecast?.destroy();
    this.chartComparison?.destroy();
  }

  generateYears(): void {
    const current = new Date().getFullYear();
    this.years = [current, current - 1, current - 2];
  }

  // =======================
  // CARGA INICIAL DE CATÁLOGOS
  // =======================
  loadInitialDataWithFallback(): void {
    // 🔹 ÁREAS → backend devuelve { total, areas: [...] }
    this.aiService.getAreas()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res:any) => {
          console.log('🌐 Áreas recibidas:', res);
          this.areas = Array.isArray(res) ? res : (res.areas || []);
        },
        error: () => {
          this.areas = [];
          this.showWarning('No se pudieron cargar las áreas. Usando modo offline.');
        }
      });

    // 🔹 CATEGORÍAS → probablemente { total, categories: [...] } o similar
    this.aiService.getCategorias()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          console.log('📂 Categorías recibidas:', res);
          this.categories = Array.isArray(res)
            ? res
            : (res.categories || res.data || []);
        },
        error: () => {
          this.categories = [];
          this.showWarning('No se pudieron cargar las categorías.');
        }
      });

    // 🔹 PRODUCTOS → { products: [...] }
    this.aiService.searchProducts('')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          console.log('📦 Productos recibidos:', res);
          const list = Array.isArray(res?.products)
            ? res.products
            : (res?.products ? Object.values(res.products) : []);
          this.products = list;
          this.filteredProducts = list;
        },
        error: () => {
          this.products = [];
          this.filteredProducts = [];
          this.showWarning('No se pudieron cargar los productos.');
        }
      });
  }


  onAreaChange(event: any): void {
  const newAreaId = event.target.value;
  this.filters.area_id = newAreaId;
  console.log('📍 Área seleccionada:', newAreaId);

  if (newAreaId && newAreaId !== 'all') {
    this.loadSubareas();
  } else {
    this.subareas = [];
    this.filters.subarea_id = 'all';
  }

  // 🔹 Refrescamos el dashboard siempre que cambie área
  this.onFilterChange();
}

  // =======================
  // SUBÁREAS / PRODUCTOS SEGÚN FILTRO
  // =======================
  loadSubareas(): void {
  // 🔹 Si no hay área seleccionada, limpiar subáreas
  if (!this.filters.area_id || this.filters.area_id === 'all') {
    this.subareas = [];
    this.filters.subarea_id = 'all';
    return;
  }

  // 🔹 Cargar subáreas del área seleccionada
  this.aiService.getSubareasByArea(+this.filters.area_id)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res: any) => {
        console.log('🔍 Respuesta cruda de getSubareasByArea:', res);
        // ✅ Si viene como array directo, úsalo tal cual
        this.subareas = Array.isArray(res) 
          ? res
          : (res.subareas ?? []);

        console.log('📋 Subáreas cargadas para área', this.filters.area_id, this.subareas);

        // 🔹 Si la subárea previa ya no pertenece a esta área, resetear
        const subareaIds = this.subareas.map((s: any) => s.id);
        if (!subareaIds.includes(this.filters.subarea_id)) {
          this.filters.subarea_id = 'all';
        }

        // 🔹 Actualizar filtros y recargar dashboard
        this.onFilterChange();
      },
      error: (err) => {
        console.error('❌ Error al cargar subáreas:', err);
        this.subareas = [];
        this.filters.subarea_id = 'all';
        this.showWarning('No se pudieron cargar las subáreas.'); // ✅ mantienes tu alerta
      }
    });
}


  loadProducts(): void {
    if (this.filters.category_id === 'all') {
      this.filteredProducts = this.products;
    } else {
      this.filteredProducts = this.products.filter(
        (p: any) => p.product_categorie_id == this.filters.category_id
      );
    }
  }

  filterProducts(): void {
    const term = (this.filters.product_search || '').toLowerCase();
    this.filteredProducts = this.products.filter((p: any) =>
      p.title.toLowerCase().includes(term)
    );
  }

  onFilterChange(): void {
  // 🟢 Normalizar búsqueda de producto
  const searchTerm = (this.filters.product_search || '').trim().toLowerCase();
  const foundProduct = this.products.find(
    (p: any) => p.title.toLowerCase() === searchTerm
  );

  // Si no hay coincidencia exacta, intentamos parcial
  if (!foundProduct && searchTerm.length > 2) {
    const partial = this.products.find(
      (p: any) => p.title.toLowerCase().includes(searchTerm)
    );
    if (partial) this.filters.product_id = partial.product_id;
    else this.filters.product_id = 'all';
  } else {
    this.filters.product_id = foundProduct ? foundProduct.product_id : 'all';
  }

  console.log('🧭 Filtros aplicados:', this.filters);

  // 🔄 Refrescamos el dashboard
  this.loadGlobalReportWithRetry();
}


// =======================
// REACCIÓN CUANDO CAMBIA PRODUCTO EN EL INPUT
// =======================
onProductSelected(event: any): void {
  const value = event.target.value.trim().toLowerCase();

  // 🔍 Buscamos coincidencia exacta o parcial
  const selected = this.products.find((p: any) =>
    p.title.toLowerCase() === value || p.title.toLowerCase().includes(value)
  );

  if (selected) {
    this.filters.product_id = selected.id || selected.product_id;
    console.log('🎯 Producto seleccionado:', selected.title);
  } else {
    this.filters.product_id = 'all';
  }

  // 🔄 Disparamos actualización
  this.loadGlobalReportWithRetry();
}

hasDataToRender(): boolean {
  return !!(
    this.data &&
    (
      (this.data.forecast && Object.keys(this.data.forecast).length > 0) ||
      (this.data.by_area && Object.keys(this.data.by_area).length > 0)
    )
  );
}

setActiveTab(tab: string): void {
  console.log('🟦 Cambiando pestaña a:', tab);
  this.activeTab = tab;

  // 🔹 Forzamos actualización del componente visible
  this.cdr.detectChanges();

  // 🔹 Limpieza visual si cambia de dashboard a otra pestaña
  if (tab !== 'dashboard') {
    this.chartForecast?.destroy();
    this.chartComparison?.destroy();
  }
}


  // =======================
  // CARGA DEL REPORTE GLOBAL
  // =======================
  loadGlobalReportWithRetry(): void {
  console.log('🚀 Entrando a loadGlobalReportWithRetry() con filtros:', this.filters);
  this.loading = true;
  this.error = null;

  this.aiService.getLatestReport(this.cleanFilters(this.filters))
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res) => {
        console.log('✅ Respuesta IA:', res);

        if (res.error) {
          this.handleIaError(res.message);
          return;
        }

        // 🔹 Normalizar datos y evitar undefined
        this.data = res.data || this.getFallbackData();
        if (!this.data.by_area) this.data.by_area = {};
        if (!this.data.forecast) this.data.forecast = {};
        if (!this.data.top_products) this.data.top_products = [];

        // 🔹 Límite Top 100 productos
        if (Array.isArray(this.data.top_products)) {
          this.data.top_products = this.data.top_products.slice(0, 100);
        }

        this.processForecastData();
        this.safeRenderCharts();
        this.updateStats();

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error IA:', err);
        this.handleIaError(err.message || 'Error de conexión con IA');
        this.loading = false;
      }
    });
}


  private updateStats(): void {
  this.stats.totalConsumption = this.getTotalConsumption();
  this.stats.activeAreas = this.getActiveAreasCount();
  this.stats.nextMonth = this.getNextMonthForecast();
  this.stats.trendPercent = this.getTrendPercentage();
  this.stats.trendIcon = this.getTrendIcon();
}
  

  private handleIaError(message: string): void {
      this.data = this.getFallbackData();
      this.processForecastData();
      this.safeRenderCharts();

      Swal.fire({
        icon: 'warning',
        title: 'IA No Disponible',
        html: `
          <p><strong>${message}</strong></p>
          <p class="text-muted">Se muestran datos locales de respaldo.</p>
          <small>Contacta al administrador.</small>
        `,
        confirmButtonText: 'Entendido',
        allowOutsideClick: false
      });
    }

  private cleanFilters(f: any): any {
    return Object.fromEntries(
      Object.entries(f).filter(([_, v]) => v && v !== 'all')
    );
  }

  // =======================
  // GRÁFICAS
  // =======================
  private safeRenderCharts(): void {
  try {
    this.chartForecast?.destroy();
    this.chartComparison?.destroy();

    setTimeout(() => {
      // === GRÁFICO 1: PRONÓSTICO ===
      const ctx1 = document.getElementById('chartForecast') as HTMLCanvasElement | null;
      if (ctx1 && this.forecastEntries.length > 0) {
        const labels = this.forecastEntries.map(f => this.formatMonth(f.key));
        const values = this.forecastEntries.map(f => f.value);

        const config: ChartConfiguration = {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Proyección IA',
              data: values,
              borderColor: '#3699ff',
              backgroundColor: 'rgba(54,153,255,0.15)',
              fill: true,
              tension: 0.4,
              pointRadius: 3,
              pointHoverRadius: 5,
            }]
          },
          options: {
            responsive: true,
            plugins: {
              tooltip: {
                callbacks: {
                  label: ctx => {
                    const val = ctx.parsed?.y ?? 0;
                    return `${val.toLocaleString()} unidades`;
                  }
                }
              }
            }
          }
        };
        this.chartForecast = new Chart(ctx1, config);
      }

      // === GRÁFICO 2: CONSUMO POR ÁREA (TOP 20) ===
      const ctx2 = document.getElementById('chartComparison') as HTMLCanvasElement | null;
      if (ctx2 && this.data?.by_area) {
        // 🔹 Ordenar y limitar
        const sortedEntries = Object.entries(this.data.by_area)
          .sort((a: any, b: any) => Number(b[1]) - Number(a[1]))
          .slice(0, 20);

        const areaNames = sortedEntries.map(([area]) => area);
        const values = sortedEntries.map(([_, v]) => Number(v));

        const total = values.reduce((a, b) => a + b, 0);

        const config: ChartConfiguration = {
          type: 'bar',
          data: {
            labels: areaNames,
            datasets: [{
              label: 'Consumo Total',
              data: values,
              backgroundColor: '#1bc5bd',
              borderRadius: 6,
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            scales: { x: { beginAtZero: true }, y: { grid: { display: false } } },
            plugins: {
              tooltip: {
                callbacks: {
                  label: (context) => {
                    const val = context.parsed?.x ?? 0;
                    if (!val) return 'Sin datos';
                    const percent = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
                    return `${val.toLocaleString()} u (${percent}%)`;
                  }
                }
              }
            }
          }
        };
        this.chartComparison = new Chart(ctx2, config);
      }

      // 🔹 Render forzado
      this.ngzone.runOutsideAngular(() => {
        setTimeout(() => this.cdr.detectChanges(), 0);
      });
      this.loading = false;
    }, 150);
  } catch (e) {
    console.warn('⚠️ Error renderizando gráficos:', e);
  }
}



  private formatMonth(month: string): string {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const num = parseInt(month, 10);
    return (num >= 1 && num <= 12) ? months[num - 1] : month;
  }

  private processForecastData(): void {
  try {
    const raw = this.data?.forecast;
    if (!raw || typeof raw !== 'object' || Object.keys(raw).length === 0) {
      console.warn('⚠️ Sin datos de forecast, usando fallback');
      this.forecastEntries = [];
      return;
    }

    // 🔹 Convertimos y validamos únicamente lo que viene del servidor
    this.forecastEntries = Object.entries(raw)
      .map(([key, value]) => {
        const num = Number(value);
        return !isNaN(num) ? { key, value: num } : null;
      })
      .filter((e): e is { key: string; value: number } => e !== null)
      .sort((a, b) => parseInt(a.key, 10) - parseInt(b.key, 10));

    console.log('📈 forecastEntries (solo reales de IA):', this.forecastEntries);
  } catch (error) {
    console.error('❌ Error procesando forecast:', error);
    this.forecastEntries = [];
  }
}

  private getFallbackData(): any {
  return {
    forecast: { '1': 800, '2': 850, '3': 790, '4': 920, '5': 870 },
    by_area: {
      'Área A': 1200,
      'Área B': 950,
      'Área C': 700,
      'Área D': 540,
      'Área E': 400
    },
    top_products: [
      { producto: 'Papel Bond A4', area: 'Área A', cantidad: 340 },
      { producto: 'Tóner HP 12A', area: 'Área B', cantidad: 220 },
      { producto: 'Lápices No.2', area: 'Área C', cantidad: 180 },
      { producto: 'Marcadores', area: 'Área D', cantidad: 90 },
      { producto: 'Engrapadoras', area: 'Área E', cantidad: 75 }
    ]
  };
}

  private showWarning(message: string): void {
    Swal.fire({ icon: 'warning', title: 'Advertencia', text: message, timer: 3000 });
  }

  private showError(message: string): void {
    Swal.fire({ icon: 'error', title: 'Error', text: message });
  }

  // =======================
  // MÉTRICAS PARA LAS CARDS
  // =======================
  getTotalConsumption(): number {
    if (!this.data?.by_area) return 0;

    return Object.values(this.data.by_area)
      .map(v => typeof v === 'string' ? parseInt(v, 10) : v)
      .filter((v): v is number => typeof v === 'number' && !isNaN(v))
      .reduce((a, b) => a + b, 0);
  }

  getActiveAreasCount(): number {
    return this.data?.by_area ? Object.keys(this.data.by_area).length : 0;
  }

  getNextMonthForecast(): number {
    if (this.forecastEntries.length === 0) return 0;
    const last = this.forecastEntries[this.forecastEntries.length - 1];
    return last?.value ?? 0;
  }

  getTrendPercentage(): string {
    if (this.forecastEntries.length <= 1) return '—';
    const first = this.forecastEntries[0];
    const last = this.forecastEntries[this.forecastEntries.length - 1];
    if (!first?.value || !last?.value) return '—';
    const percent = ((last.value - first.value) / first.value) * 100;
    return percent.toFixed(1) + '%';
  }

  getTrendIcon(): string {
    if (this.forecastEntries.length <= 1) return '';
    const first = this.forecastEntries[0];
    const last = this.forecastEntries[this.forecastEntries.length - 1];
    if (!first?.value || !last?.value) return '';
    return last.value > first.value ? 'fa-arrow-up text-success' : 'fa-arrow-down text-danger';
  }

  goBack(): void {
    this.location.back();
  }

  resetFilters(): void {
  this.filters = {
    year: new Date().getFullYear(),
    area_id: 'all',
    subarea_id: 'all',
    category_id: 'all',
    product_id: 'all',
    product_search: 'all'
  };
  this.subareas = [];
  this.filteredProducts = this.products;
  console.log('🔄 Filtros reiniciados:', this.filters);
  //this.globalFilters = { ...this.globalFilters, ...filters };
  this.loadGlobalReportWithRetry();
}

updateFilters(filters: any) {
    this.globalFilters = { ...this.globalFilters, ...filters };
  }

// =======================
// MANEJO DE SUB-COMPONENTES (Tabs)
// =======================
onTabLoaded(tabName: string): void {
  console.log(`📊 Componente de pestaña cargado: ${tabName}`);
}

refreshCurrentTab(): void {
  switch (this.activeTab) {
    case 'insights':
      this.loadGlobalReportWithRetry();
      break;
    case 'products':
      this.loadGlobalReportWithRetry();
      break;
    case 'areas':
      this.loadGlobalReportWithRetry();
      break;
    case 'chat':
      console.log('💬 Chat IA listo.');
      break;
    case 'vehicles':
      // 🔥 LLAMADO CORRECTO al dashboard vehicular
      console.log('🚗 Actualizando Dashboard de Vehículos');
      break;
    default:
      this.safeRenderCharts();
  }
}
/*
private generateYearsList(): void {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 2; // últimos 10 años
  const endYear = currentYear + 5;   // próximos 5 años por si lo ocupas

  this.yearsList = [];

  for (let y = endYear; y >= startYear; y--) {
    this.yearsList.push(y);
  }
}*/
}
