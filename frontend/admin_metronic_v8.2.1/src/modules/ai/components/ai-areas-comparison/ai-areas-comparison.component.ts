import { Component, AfterViewInit, OnDestroy, Input, SimpleChanges, OnChanges, ChangeDetectorRef } from '@angular/core';
import { AiService } from '../../services/ai.service';
import { Chart, ChartConfiguration } from 'chart.js';
import Swal from 'sweetalert2';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-ai-areas-comparison',
  
  templateUrl: './ai-areas-comparison.component.html',
  styleUrls: ['./ai-areas-comparison.component.scss']
})
export class AiAreasComparisonComponent implements AfterViewInit, OnDestroy {
  private chart!: Chart;
  private charts: { [key: string]: Chart } = {};
  @Input() filters: any = {};
  
  // Datos del dashboard
  dashboardData: any = null;
  loading = false;
  
  // Filtros locales para esta pestaña
  localFilters = {
    year: new Date().getFullYear(),
    area_id: 'all',
    subarea_id: 'all',
    category_id: 'all',
    date_from: '',
    date_to: ''
  };

  // 🔹 LISTAS PARA FILTROS
  years: number[] = [];
  areas: any[] = [];
  subareas: any[] = [];
  categories: any[] = [];

  // 🔹 PROPIEDADES PARA FECHAS (SOLUCIÓN AL ERROR)
  currentYear: number;
  previousYear: number;

  constructor(private aiService: AiService, private cdr:ChangeDetectorRef) {

     // 🔹 INICIALIZAR FECHAS EN CONSTRUCTOR
    this.currentYear = new Date().getFullYear();
    this.previousYear = this.currentYear - 1;
    this.generateYears();
  }

  ngAfterViewInit(): void {
   
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
     Object.values(this.charts).forEach(chart => chart.destroy());
    this.chart?.destroy();
  }

 
  private generateYears(): void {
  this.years = [this.currentYear, this.previousYear, this.currentYear - 2];
}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.filters && this.filters) {
      // Combinamos los filtros globales con los locales, pero los locales tienen prioridad
      this.localFilters = { ...this.localFilters, ...this.filters };
      this.loadDashboardData();
    }
  }

  
 ngOnInit(): void {
  this.loadCatalogs(); // ← AQUÍ SE CARGAN ÁREAS Y CATEGORÍAS
}

private loadCatalogs(): void {
  // CARGAR ÁREAS
  this.aiService.getAreas().subscribe({
    next: (res: any) => {
      this.areas = Array.isArray(res) ? res : (res.areas || []);
      this.cdr.detectChanges();
    },
    error: () => this.areas = []
  });

  // CARGAR CATEGORÍAS
  this.aiService.getCategorias().subscribe({
    next: (res: any) => {
      this.categories = Array.isArray(res) ? res : (res.data || res.categories || []);
      this.cdr.detectChanges();
    },
    error: () => this.categories = []
  });
}

// CARGAR SUBÁREAS AL CAMBIAR ÁREA
onAreaChange(event: any): void {
  const areaId = event.target.value;
  this.localFilters.area_id = areaId;

  if (areaId && areaId !== 'all') {
    this.loadSubareas(+areaId);
  } else {
    this.subareas = [];
    this.localFilters.subarea_id = 'all';
  }
  this.loadDashboardData();
}

private loadSubareas(areaId: number): void {
  this.aiService.getSubareasByArea(areaId).subscribe({
    next: (res: any) => {
      this.subareas = Array.isArray(res) ? res : (res.subareas || []);
      this.localFilters.subarea_id = 'all';
      this.cdr.detectChanges();
    },
    error: () => {
      this.subareas = [];
      this.localFilters.subarea_id = 'all';
    }
  });
}

  loadDashboardData(): void {
  if (this.loading) return; // ← Evita llamadas duplicadas

  this.loading = true;
  this.cdr.detectChanges(); // Fuerza actualización del spinner

  this.aiService.getAreaComparisonDashboard(this.localFilters).subscribe({
    next: (res) => {
      if (res.success) {
        this.dashboardData = res.data;
        this.renderAllCharts();
      } else {
        this.showError('No se pudieron cargar los datos');
      }
    },
    error: (err) => {
      console.error('Error dashboard:', err);
      this.showError('Error de conexión');
      // ✅ FORZAR loading = false incluso si falla
    },
    complete: () => {
      this.loading = false; // ← Siempre se ejecuta
      this.cdr.detectChanges();
    }
  });
}

  private renderAllCharts(): void {
    this.renderAreaConsumptionChart();
    this.renderTrendChart();
    this.renderCategoryDistributionChart();
  }

  // 🔹 GRÁFICA 1: CONSUMO POR ÁREA - VERSIÓN CORREGIDA
private renderAreaConsumptionChart(): void {
  const ctx = document.getElementById('areaConsumptionChart') as HTMLCanvasElement;
  if (!ctx || !this.dashboardData?.area_consumption) return;

  this.charts['areaConsumption']?.destroy();
  
  const data = this.dashboardData.area_consumption;
  const labels = Object.keys(data);
  const values = Object.values(data).map(v => Number(v)); // 🔹 CONVERTIR A NUMBER

  const config: ChartConfiguration<'bar'> = { // 🔹 ESPECIFICAR TIPO
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Consumo por Área',
        data: values, // 🔹 AHORA ES number[]
        backgroundColor: '#3699ff',
        borderColor: '#3699ff',
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { 
          callbacks: { 
            label: (context) => `${context.label}: ${context.parsed.y} unidades` 
          } 
        }
      },
      scales: {
        y: { 
          beginAtZero: true,
          title: { display: true, text: 'Unidades' }
        },
        x: {
          title: { display: true, text: 'Áreas' }
        }
      }
    }
  };

  this.charts['areaConsumption'] = new Chart(ctx, config);
}

// 🔹 GRÁFICA 2: TENDENCIA TEMPORAL - VERSIÓN CORREGIDA
private renderTrendChart(): void {
  const ctx = document.getElementById('trendChart') as HTMLCanvasElement;
  if (!ctx || !this.dashboardData?.trend_data) return;

  this.charts['trend']?.destroy();
  
  const trendData = this.dashboardData.trend_data;
  const labels = trendData.map((item: any) => {
    const [year, month] = item.period.split('-');
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  });
  
  const values = trendData.map((item: any) => Number(item.total)); // 🔹 CONVERTIR A NUMBER

  const config: ChartConfiguration<'line'> = { // 🔹 ESPECIFICAR TIPO
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Tendencia de Consumo',
        data: values, // 🔹 AHORA ES number[]
        borderColor: '#1bc5bd',
        backgroundColor: 'rgba(27, 197, 189, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#1bc5bd',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        tooltip: { 
          callbacks: { 
            label: (context) => `${context.parsed.y} unidades` 
          } 
        }
      },
      scales: {
        y: {
          title: { display: true, text: 'Unidades' }
        }
      }
    }
  };

  this.charts['trend'] = new Chart(ctx, config);
}

  

  private renderCategoryDistributionChart(): void {
  const ctx = document.getElementById('categoryDistributionChart') as HTMLCanvasElement;
  if (!ctx || !this.dashboardData?.category_distribution) return;

  this.charts['category']?.destroy();
  
  const data = this.dashboardData.category_distribution;
  const labels = Object.keys(data);
  const values = Object.values(data).map(v => Number(v)); // 🔹 CONVERTIR A NUMBER

  const config: ChartConfiguration<'doughnut'> = { // 🔹 ESPECIFICAR TIPO
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: values, // 🔹 AHORA ES number[]
        backgroundColor: [
          '#3699ff', '#1bc5bd', '#ffa800', '#f64e60', '#9561e2',
          '#627eea', '#f6c343', '#50cd89', '#7239ea', '#009ef7'
        ],
        borderWidth: 3,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { 
          position: 'right',
          labels: {
            padding: 15,
            usePointStyle: true
          }
        },
        tooltip: { 
          callbacks: { 
            label: (context) => {
              const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
              const percentage = ((context.parsed / total) * 100).toFixed(1);
              return `${context.label}: ${context.parsed} unidades (${percentage}%)`;
            }
          } 
        }
      }
    }
  };

  this.charts['category'] = new Chart(ctx, config);
}

  // Métodos para actualizar filtros locales
  onYearChange(event: any): void {
    this.localFilters.year = event.target.value;
    this.loadDashboardData();
  }

  

  onSubareaChange(event: any): void {
    this.localFilters.subarea_id = event.target.value;
    this.loadDashboardData();
  }

  onCategoryChange(event: any): void {
    this.localFilters.category_id = event.target.value;
    this.loadDashboardData();
  }

  onDateFromChange(event: any): void {
    this.localFilters.date_from = event.target.value;
    if (this.localFilters.date_from && this.localFilters.date_to) {
      this.loadDashboardData();
    }
  }

  onDateToChange(event: any): void {
    this.localFilters.date_to = event.target.value;
    if (this.localFilters.date_from && this.localFilters.date_to) {
      this.loadDashboardData();
    }
  }

  resetFilters(): void {
    this.localFilters = {
      year: new Date().getFullYear(),
      area_id: 'all',
      subarea_id: 'all',
      category_id: 'all',
      date_from: '',
      date_to: ''
    };
    this.loadDashboardData();
  }

   // 🔹 UTILIDADES
  private showError(message: string): void {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: message,
      timer: 3000
    });
  }

  formatNumber(num: number): string {
    return num?.toLocaleString('es-MX') || '0';
  }

  getStockColor(difference: number): string {
    if (difference >= 0) return 'text-success';
    if (difference > -10) return 'text-warning';
    return 'text-danger';
  }

  getStatusBadge(status: string): string {
    const statusMap: any = {
      'pending_sf_validation': 'bg-warning',
      'validate_sf': 'bg-info',
      'pending_warehouse': 'bg-primary',
      'partially_received': 'bg-orange',
      'completed': 'bg-success',
      'draft': 'bg-secondary',
      'sent': 'bg-warning',
      'approved': 'bg-success',
      'rejected': 'bg-danger'
    };
    return statusMap[status] || 'bg-secondary';
  }

  getStatusText(status: string): string {
    const statusText: any = {
      'pending_sf_validation': 'Pendiente Validación SF',
      'validate_sf': 'Validando SF',
      'pending_warehouse': 'Pendiente Almacén',
      'partially_received': 'Parcialmente Recibido',
      'completed': 'Completado',
      'draft': 'Borrador',
      'sent': 'Enviado',
      'approved': 'Aprobado',
      'rejected': 'Rechazado'
    };
    return statusText[status] || status;
  }


//no se si poner esto de abajo 
/*
private loadWithFallback(): void {
  const params = this.filters?.product_id && this.filters.product_id !== 'all' 
    ? this.filters 
    : { year: new Date().getFullYear(), ...this.filters };

  this.aiService.getLatestReport(params).subscribe({
    next: (res) => {
      const data = res.data?.by_area || {};
      this.renderChart(data);
    },
    error: () => {
      this.renderChart(this.getFallbackAreaData());
      Swal.fire({ icon: 'warning', title: 'Sin conexión', text: 'Gráfica en modo offline.' });
    }
  });
}

  private renderChart(data: any): void {
    try {
      this.chart?.destroy();
      const ctx = document.getElementById('areasChart') as HTMLCanvasElement;
      if (!ctx) return;

      this.chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: Object.keys(data),
          datasets: [{
            data: Object.values(data),
            backgroundColor: ['#3699ff', '#1bc5bd', '#ffa800', '#f64e60', '#9561e2'],
            borderWidth: 3,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'right', labels: { padding: 20 } },
            tooltip: { callbacks: { label: ctx => `${ctx.label}: ${ctx.raw} unidades` } }
          },
          animation: { duration: 1500 }
        }
      });
    } catch (e) {
      console.warn('Chart error:', e);
    }
  }

  private getFallbackAreaData(): any {
    return { 'Área A': 1200, 'Área B': 900, 'Área C': 700 };
  }

  */
}
