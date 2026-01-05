import { Component, OnInit, OnDestroy, Input, ChangeDetectorRef } from '@angular/core';
import { AiService } from '../../services/ai.service';
import { Subject, takeUntil } from 'rxjs';
import { Chart, ChartConfiguration } from 'chart.js';
import Swal from 'sweetalert2';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
//import pdfMake from 'pdfmake/build/pdfmake';
//import pdfFonts from 'pdfmake/build/vfs_fonts';
//(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;

@Component({
  selector: 'app-ai-priority-products',
  
  templateUrl: './ai-priority-products.component.html',
  styleUrls: ['./ai-priority-products.component.scss']
})
export class AiPriorityProductsComponent implements OnInit, OnDestroy {
  @Input() filters: any;
  private destroy$ = new Subject<void>();
  loading = false;
  products: any[] = [];
  selectedProduct: any = null;
  chart: Chart | null = null;

  constructor(private aiService: AiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    console.log('✅ AiPriorityProductsComponent iniciado con filtros:', this.filters);
    this.loadPriorityProducts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.chart?.destroy();
  }

  // =============================
  // 🔹 CARGAR PRODUCTOS PRIORITARIOS IA
  // =============================
  loadPriorityProducts(): void {
  this.loading = true;
  this.aiService.getInsights(this.filters)
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: (res: any) => {
        console.log('📦 Respuesta IA:', res);
        console.log('🔍 Estructura exacta:', JSON.stringify(res, null, 2));

        // 🔹 Tipamos explícitamente los elementos de la lista
        const data = Array.isArray(res.data) ? res.data : [];

        this.products = data
          .map((p: any) => ({
            ...p,
            title: p.producto || p.title,
            category: p.categoria || p.category || '—',
          }))
          .sort((a: { severity: number }, b: { severity: number }) => b.severity - a.severity);


        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error IA:', err);
        this.loading = false;
        Swal.fire({
          icon: 'warning',
          title: 'IA no disponible',
          text: 'No se pudieron obtener productos prioritarios.',
        });
      }
    });
}

  // =============================
  // 🔹 SELECCIONAR PRODUCTO Y GRAFICAR
  // =============================
  selectProduct(product: any): void {
    this.selectedProduct = product;
    this.renderProductChart(product);
  }

  private renderProductChart(product: any): void {
    this.chart?.destroy();

    if (!product || !product.monthly_trend || product.monthly_trend.length === 0) {
      console.warn('⚠️ Sin datos mensuales para:', product.title);
      return;
    }

    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const labels = meses.slice(0, product.monthly_trend.length);
    const values = product.monthly_trend.map((v: any) => Number(v) || 0);
    const umbral = Number(product.umbral ?? 0);

    // ======================================
    // 🧠 IA Local Predictiva (3 meses extra)
    // ======================================
    const projection = this.calculateLocalForecast(values, 3);
    const futureLabels = ['+1', '+2', '+3'];
    const allLabels = [...labels, ...futureLabels];

    // Color dinámico según severidad
    const colorMap: any = {
      5: '#dc3545', // rojo
      4: '#fd7e14', // naranja
      3: '#ffc107', // amarillo
      2: '#17a2b8', // azul
      1: '#198754'  // verde
    };
    const lineColor = colorMap[product.severity] || '#3699ff';

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          {
            label: 'Consumo real',
            data: [...values, null, null, null],
            borderColor: lineColor,
            backgroundColor: 'rgba(54,153,255,0.15)',
            tension: 0.35,
            fill: true,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: 'Umbral de seguridad',
            data: Array(allLabels.length).fill(umbral),
            borderColor: '#ff0000',
            borderDash: [8, 5],
            borderWidth: 2,
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Proyección IA (3 meses)',
            data: [...Array(values.length).fill(null), ...projection],
            borderColor: '#6c757d',
            borderDash: [4, 4],
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 3,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Unidades' }
          },
          x: {
            title: { display: true, text: 'Meses (últimos + proyección)' }
          }
        },
        plugins: {
          legend: { display: true, position: 'bottom' },
          tooltip: {
            callbacks: {
              label: ctx => {
                const val = ctx?.parsed?.y ?? 0;
                const label = ctx.dataset.label;
                if (label === 'Umbral de seguridad') return `Umbral: ${umbral.toLocaleString()} unidades`;
                if (label === 'Proyección IA (3 meses)') return `Proyección IA: ${val.toLocaleString()} unidades`;
                const diff = val - umbral;
                const estado =
                  diff < 0 ? '🔴 Bajo' :
                  diff < umbral * 0.5 ? '🟠 Riesgo' :
                  '🟢 OK';
                return `${val.toLocaleString()} unidades (${estado})`;
              }
            }
          },
          title: {
            display: true,
            text: `Tendencia y proyección (${product.title}) — Promedio: ${product.promedio_mensual ?? 'N/D'} / Umbral: ${umbral}`
          }
        }
      }
    };

    const ctx = document.getElementById('productChart') as HTMLCanvasElement;
    if (ctx) this.chart = new Chart(ctx, config);
  }

  // =====================================
  // 🧮 ALGORITMO LOCAL DE PRONÓSTICO IA
  // =====================================
  private calculateLocalForecast(data: number[], futureMonths: number = 3): number[] {
    if (!data.length) return Array(futureMonths).fill(0);

    // Tomamos últimos 4 valores reales
    const recent = data.slice(-4);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;

    // Calculamos pendiente (tendencia lineal simple)
    const slope = (recent[recent.length - 1] - recent[0]) / (recent.length - 1);

    // Generamos proyección
    const forecast: number[] = [];
    for (let i = 1; i <= futureMonths; i++) {
      const val = Math.max(avg + slope * i, 0);
      forecast.push(Number(val.toFixed(0)));
    }
    return forecast;
  }


  // 🧠 ABRIR ANÁLISIS EXTENDIDO
// =============================
/*
openAnalysisModa(product: any): void {
  if (!product) return;

  const sugerencia = this.getPurchaseSuggestion(product);
  const justificacion = this.getIaJustification(product);

  Swal.fire({
    title: `📈 Análisis IA - ${product.title}`,
    html: `
      <p><strong>Stock actual:</strong> ${product.stock_actual} unidades</p>
      <p><strong>Umbral:</strong> ${product.umbral}</p>
      <p><strong>Promedio mensual:</strong> ${product.promedio_mensual ?? 'N/D'}</p>
      <hr>
      <h5>🧠 Sugerencia IA:</h5>
      <p>${sugerencia}</p>
      <h5>📋 Justificación:</h5>
      <p>${justificacion}</p>
    `,
    showCancelButton: true,
    confirmButtonText: '📄 Exportar PDF',
    cancelButtonText: 'Cerrar',
    preConfirm: async () => {
      this.exportAiPdf(product, sugerencia, justificacion);
    }
  });
}
*/

openAnalysisModal(product: any): void {
  if (!product) return;

  this.aiService.analyzeProduct(product, product.monthly_trend).subscribe({
    next: (res: any) => {
      const data = res.data || {};
      const sugerencia = data.suggestion || this.getPurchaseSuggestion(product);
      const justificacion = data.justification || this.getIaJustification(product);
      const projection = data.projection || this.calculateLocalForecast(product.monthly_trend, 3);

      this.renderProductChart({ ...product, monthly_trend: [...product.monthly_trend, ...projection] });

      Swal.fire({
        title: `📈 Análisis IA - ${product.title}`,
        html: `
          <p><strong>Stock actual:</strong> ${product.stock_actual} unidades</p>
          <p><strong>Umbral:</strong> ${product.umbral}</p>
          <hr>
          <h5>🧠 Sugerencia IA:</h5>
          <p>${sugerencia}</p>
          <h5>📋 Justificación:</h5>
          <p>${justificacion}</p>
        `,
        showCancelButton: true,
        confirmButtonText: '📄 Exportar PDF',
        cancelButtonText: 'Cerrar',
        preConfirm: async () => {
          this.exportAiPdf(product, sugerencia, justificacion);
        }
      });
    },
    error: err => {
      console.error('Error IA:', err);
      Swal.fire('Error', 'No se pudo generar el análisis IA.', 'error');
    }
  });
}

// =============================
// 💡 LÓGICA DE SUGERENCIA IA LOCAL
// =============================
getPurchaseSuggestion(product: any): string {
  const stock = product.stock_actual ?? 0;
  const umbral = product.umbral ?? 0;
  const promedio = product.promedio_mensual ?? 0;

  if (stock < umbral)
    return `Se recomienda comprar ${(umbral * 2 - stock).toFixed(0)} unidades para cubrir demanda y mantener nivel de seguridad.`;
  if (stock < promedio)
    return `Reponer al menos ${(promedio - stock).toFixed(0)} unidades para evitar escasez.`;
  return `El nivel de stock actual es adecuado, no se requiere compra inmediata.`;
}

getIaJustification(product: any): string {
  const stock = product.stock_actual ?? 0;
  const umbral = product.umbral ?? 0;
  const promedio = product.promedio_mensual ?? 0;

  if (stock < umbral)
    return `El consumo reciente supera el nivel de seguridad. Se prevé agotamiento en menos de un mes.`;
  if (stock < promedio)
    return `El consumo medio mensual es mayor que el stock disponible, indicando una posible ruptura de stock.`;
  return `El stock cubre la demanda proyectada. Monitorear en próximas semanas.`;
}

// =============================
// 🧾 EXPORTAR PDF COMPLETO (DOMPDF)
// =============================
async exportAiPdf(product: any, suggestion: string, justification: string) {
  const canvas = document.getElementById('productChart') as HTMLCanvasElement;
  const chartBase64 = canvas ? canvas.toDataURL('image/png') : null;

  const analysis = { suggestion, justification };

  this.aiService.exportProductPdf({ product, analysis, chartBase64 }).subscribe({
    next: (blob: Blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Reporte_IA_${product.title}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
    error: err => {
      console.error('Error exportando PDF IA:', err);
      Swal.fire('Error', 'No se pudo generar el PDF IA.', 'error');
    }
  });
}

  // =============================
  // 🔹 UTILIDADES
  // =============================
  getSeverityBadge(sev: number): string {
    switch (sev) {
      case 5: return 'badge bg-danger';
      case 4: return 'badge bg-warning text-dark';
      case 3: return 'badge bg-info text-dark';
      case 2: return 'badge bg-success';
      default: return 'badge bg-secondary';
    }
  }

  getSeverityText(sev: number): string {
    switch (sev) {
      case 5: return 'Crítico';
      case 4: return 'Alto';
      case 3: return 'Medio';
      case 2: return 'Bajo';
      default: return 'Normal';
    }
  }
}







