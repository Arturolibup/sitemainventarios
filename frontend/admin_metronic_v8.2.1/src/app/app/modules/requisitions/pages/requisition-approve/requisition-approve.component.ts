import { Component, OnInit, OnDestroy, ChangeDetectorRef, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Chart } from 'chart.js/auto';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { RequisitionService } from '../../services/requisition.service';
import { NotificationService } from 'src/app/services/notification.service';
import { AiService } from 'src/modules/ai/services/ai.service';

@Component({
  selector: 'app-requisition-approve',
  templateUrl: './requisition-approve.component.html',
  styleUrls: ['./requisition-approve.component.scss']
})
export class RequisitionApproveComponent implements OnInit, OnDestroy, AfterViewInit {

  @ViewChild('chartCanvas', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  chart!: Chart;

  loading = false;
  analyzing = false; // ← NUEVO: Spinner del botón IA
  reqId!: number;
  form!: FormGroup;
  destroy$ = new Subject<void>();
  previousMonths: string[] = [];
  

  currentYear = new Date().getFullYear();

getMonthName(monthsOffset: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + monthsOffset);
  return date.toLocaleString('es-MX', { month: 'long' });
}
  // 🔹 Resumen IA
  iaSummary = {
    trend: 'estable',
    confidence: 0,
    alerts: 0,
  };

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private requisitionService: RequisitionService,
    private aiService: AiService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.reqId = Number(this.route.snapshot.paramMap.get('id'));
    this.initForm();
    this.loadDetail();
    this.notificationService.joinRoom('requisitions');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.notificationService.leaveRoom('requisitions');
  }

  ngAfterViewInit(): void {
    if (this.items.length > 0 && this.chartCanvas) {
      this.createConsumptionChart();
    }
  }

  private initForm(): void {
    this.form = this.fb.group({
      id: [null],
      title: [''],
      date1: [''],
      status: [''],
      area_name: [''],
      subarea_name: [''],
      requested_at: [''],
      approved_at: [''],
      observations: [''],
      items: this.fb.array([])
    });
  }

  get items(): FormArray {
    return this.form.get('items') as FormArray;
  }

  private getPreviousMonths(requestedAt: string): string[] {
    const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const date = new Date(requestedAt);
    return Array.from({ length: 3 }, (_, i) => {
      const prevDate = new Date(date.getFullYear(), date.getMonth() - (3 - i), 1);
      return `${months[prevDate.getMonth()]} ${prevDate.getFullYear()}`;
    });
  }

  /** Carga detalle + análisis IA */
  private async loadDetail(): Promise<void> {
    this.loading = true;
    try {
      const req = await this.requisitionService
        .getById(this.reqId)
        .pipe(map((res: any) => res?.data || res))
        .toPromise();

      if (!req) throw new Error('No se encontró la requisición.');

      this.previousMonths = req.requested_at
        ? this.getPreviousMonths(req.requested_at)
        : ['Mes -3', 'Mes -2', 'Mes -1'];

      this.form.patchValue({
        id: req.id,
        title: req.call?.title || '-',
        status: req.status,
        area_name: req.area?.name || '-',
        subarea_name: req.subarea?.name || '-',
        requested_at: req.requested_at
          ? new Date(req.requested_at).toLocaleDateString('es-MX')
          : '-',
        approved_at: req.approved_at
          ? new Date(req.approved_at).toLocaleDateString('es-MX')
          : '-',
        date1: req.requested_at
          ? new Date(req.requested_at).toLocaleDateString('es-MX', { month: 'long' })
          : '-',
        observations: req.observations || '',
      });

      this.items.clear();

      const productIds = (req.items || []).map((it: any) => it.product?.id).filter(Boolean);
      let stockMap: { [productId: number]: number } = {};

      if (productIds.length > 0) {
        try {
          const stockResponse = await this.requisitionService
            .getStockByProducts(productIds)
            .toPromise();
          stockMap = (stockResponse || []).reduce((acc: any, curr: any) => {
            acc[curr.product_id] = curr.stock || 0;
            return acc;
          }, {});
        } catch {
          Swal.fire('Advertencia', 'No se pudo cargar el stock real.', 'warning');
        }
      }

      // CARGAR RECOMENDACIONES IA (opcional)
      let aiRecs: any[] = [];
      try {
        const aiResponse = await this.aiService.analyzeRequisition(this.reqId).toPromise();
        aiRecs = aiResponse?.recommendations || [];
      } catch (err) {
        console.warn('IA no disponible:', err);
      }

      const aiMap = aiRecs.reduce((acc: any, rec: any) => {
        if (rec.requisition_item_id){
          acc[rec.requisition_item_id] = rec;
        }
        return acc;
      }, {});

      let totalConfidence = 0;
      let totalFlags = 0;
      let totalSuggested = 0;
      let totalRequested = 0;

      (req.items || []).forEach((it: any) => {
      const itemId = it.id; // ← Este es el requisition_item_id
      const ai = aiMap[itemId] || {}; // ← Mapeo correcto
      const stock = stockMap[it.product?.id] ?? 0;

      // ACUMULAR PARA EL RESUMEN IA (¡DESCOMENTADO!)
      totalConfidence += ai.confidence || 0;
      totalSuggested += ai.suggested_qty || 0;
      totalRequested += it.requested_qty || 0;
      if ((ai.flags || []).length > 0) totalFlags += 1;

      this.items.push(
        this.fb.group({
          item_id: [it.id],
          requisition_item_id: [it.id],
          product_id: [it.product?.id],
          product_name: [it.product?.title || 'Producto'],
          unit_name: [it.unit?.name || '-'],
          requested_qty: [it.requested_qty ?? 0],
          approved_qty: [
            it.approved_qty ?? it.requested_qty ?? 0,
            [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/), this.maxStockValidator()]
          ],
          real_stock: [stock],

          // DATOS DE LA IA (AHORA SÍ LLEGAN)
          prev_month_1: [ai.prev_month_1 ?? 0],
          prev_month_2: [ai.prev_month_2 ?? 0],
          prev_month_3: [ai.prev_month_3 ?? 0],
          recommended_qty: [ai.suggested_qty ?? 0],
          reason: [ai.reason || ''],
          confidence: [ai.confidence ?? 0],
          ai_flags: [ai.flags || []],
          qty_oficio: [ai.qty_oficio ?? 0],
          qty_requisicion: [ai.qty_requisicion ?? 0],
          sugerencia_preventiva: [ai.sugerencia_preventiva || '']
        })
      );
    });

      const avgConfidence = totalConfidence / (aiRecs.length || 1);
      const trendRatio = totalSuggested / (totalRequested || 1);
      this.iaSummary = {
        confidence: +(avgConfidence * 100).toFixed(1),
        alerts: totalFlags,
        trend: trendRatio > 1.05 ? 'alza' : trendRatio < 0.95 ? 'baja' : 'estable',
      };

      this.loading = false;
      this.cdr.detectChanges();
      this.createConsumptionChart();
    } catch (err) {
      this.loading = false;
      Swal.fire('Error', 'No se pudo cargar la requisición.', 'error');
    }
  }

  // ← AQUÍ ESTÁ EL MÉTODO QUE QUERÍAS
  async analyzeWithAI() {
  this.analyzing = true;
  console.log('🚀 INICIANDO ANÁLISIS IA PARA REQUISICIÓN:', this.reqId);

  try {
    const res = await this.aiService.analyzeRequisition(this.reqId).toPromise();
    console.log('✅ RESPUESTA COMPLETA DE LA IA:', res);
    console.log('📊 ¿TIENE RECOMMENDATIONS?', !!res?.recommendations);
    console.log('📈 CANTIDAD DE RECOMENDACIONES:', res?.recommendations?.length);

    if (res?.recommendations?.length > 0) {
      this.updateRecommendations(res.recommendations);
      this.notificationService.success('¡IA analizó correctamente!');
    } else {
      console.warn('⚠️ LA IA NO DEVOLVIÓ RECOMENDACIONES');
      this.notificationService.info('Sin recomendaciones de IA');
    }
  } catch (err: any) {
    console.error('💥 ERROR EN IA:', err);
    console.error('💥 ERROR STATUS:', err?.status);
    console.error('💥 ERROR MESSAGE:', err?.error);
    this.notificationService.error('Error al conectar con IA');
  } finally {
    this.analyzing = false;
  }
}

  updateRecommendations(recommendations: any[]) {
  console.log('IA: Actualizando recomendaciones', recommendations);

  // MAPEO CORRECTO POR requisition_item_id
  const aiMap = recommendations.reduce((acc: any, rec: any) => {
    if (rec.requisition_item_id) {
      acc[rec.requisition_item_id] = rec;
    }
    return acc;
  }, {});

  let totalConfidence = 0;
  let totalFlags = 0;
  let totalSuggested = 0;
  let totalRequested = 0;

  this.items.controls.forEach((control: any) => {
    // Buscamos por requisition_item_id (prioridad) o item_id (fallback)
    const itemId = control.get('requisition_item_id')?.value || control.get('item_id')?.value;
    const ai = aiMap[itemId];

    if (ai && itemId) {
      console.log(`IA: Actualizando item_id ${itemId} → ${ai.product_name || 'Producto'}`, {
        prev_month_1: ai.prev_month_1,
        suggested_qty: ai.suggested_qty,
        qty_oficio: ai.qty_oficio
      });

      control.patchValue({
        prev_month_1: ai.prev_month_1 || 0,
        prev_month_2: ai.prev_month_2 || 0,
        prev_month_3: ai.prev_month_3 || 0,

        qty_oficio: ai.qty_oficio || 0,
        qty_requisicion: ai.qty_requisicion || 0,
        total_oficio: ai.total_oficio || 0,
        total_requisicion: ai.total_requisicion || 0,

        recommended_qty: ai.suggested_qty || 0,
        suggested_qty: ai.suggested_qty || 0, // si usas ambos nombres

        reason: ai.reason || '',
        notes: ai.reason || control.get('notes')?.value || '',
        confidence: ai.confidence || 0,
        ai_flags: ai.flags || [],
        accion: ai.accion || 'aprobar',
        alerta: ai.alerta || null,
        sugerencia_preventiva: ai.sugerencia_preventiva || ''
      });

      // Acumular para resumen IA
      totalConfidence += ai.confidence || 0;
      totalFlags += (ai.flags || []).length > 0 ? 1 : 0;
      totalSuggested += ai.suggested_qty || 0;
      totalRequested += control.get('requested_qty')?.value || 0;
    }
  });

  // Actualizar resumen general de IA
  const avgConfidence = recommendations.length > 0 ? totalConfidence / recommendations.length : 0;
  const trendRatio = totalRequested > 0 ? totalSuggested / totalRequested : 1;

  this.iaSummary = {
    confidence: +avgConfidence.toFixed(1),
    alerts: totalFlags,
    trend: trendRatio > 1.05 ? 'alza' : trendRatio < 0.95 ? 'baja' : 'estable'
  };

  // Actualizar gráfico y vista
  this.createConsumptionChart();
  this.cdr.detectChanges();
}

  private maxStockValidator() {
    return (control: any): { [key: string]: any } | null => {
      const parent = control.parent;
      if (!parent) return null;
      const approved = Number(control.value) || 0;
      const stock = Number(parent.get('real_stock')?.value) || 0;
      return approved > stock ? { maxStock: { max: stock } } : null;
    };
  }

  goBack(): void {
    this.router.navigate(['/requisitions/approve']);
  }

  approve(): void {
    const currentStatus = this.form.get('status')?.value;
    if (currentStatus === 'approved' || currentStatus === 'rejected') {
      Swal.fire('Atención', 'Esta requisición ya ha sido procesada.', 'info');
      return;
    }

    if (this.form.invalid || this.items.invalid) {
      this.form.markAllAsTouched();
      this.items.markAllAsTouched();
      Swal.fire({
        title: 'Atención',
        text: 'Corrige las cantidades aprobadas (deben ser 0 o más).',
        icon: 'warning',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    const payload = {
      observations: this.form.get('observations')?.value || '',
      items: this.items.controls.map((control) => {
        const value = control.value;
        return {
          item_id: value.item_id,
          approved_qty: Number(value.approved_qty ?? 0) || 0,
          unit_id: value.unit_id || null,
        };
      }),
    };

    Swal.fire({
      title: '¿Aprobar y generar salida?',
      text: 'Se guardarán las cantidades y se generará el vale de salida automáticamente.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, aprobar y generar',
      cancelButtonText: 'Cancelar',
    }).then((result) => {
      if (!result.isConfirmed) return;

      this.loading = true;

      this.requisitionService.approve(this.reqId, payload)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response: any) => {
            this.loading = false;
            if (response.draft_url) {
              const pdfWindow = window.open(response.draft_url, '_blank',
                'noopener,noreferrer');
                if (!pdfWindow){
                  this.notificationService.warning(
                    'El PDF se genero y guardo, pero fue bloqueado. Permite ventanas Emergentes.');
                  }
              }
            Swal.fire({
              title: '¡Aprobada!',
              html: `
                <p>Folio: <strong>${response.exit_folio}</strong></p>
                <p>El borrador se abrió para imprimir.</p>
                <p><strong>Sube el vale firmado después.</strong></p>
              `,
              icon: 'success'
            }).then(() => {
              this.router.navigate(['requisitions/approve']);
            });
          },
          error: (err) => {
            this.loading = false;
            const msg = err.error?.message || 'No se pudo aprobar';
            Swal.fire('Error', msg, 'error');
          },
        });
    });
  }

  createConsumptionChart(): void {
    const canvas = this.chartCanvas?.nativeElement;
    if (!canvas || this.items.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (this.chart) this.chart.destroy();

    const labels = this.previousMonths;

    const datasets = this.items.controls.slice(0, 5).map((control: any, i) => {
      const data = control.value;
      return {
        label: data.product_name,
        data: [data.prev_month_3 || 0, data.prev_month_2 || 0, data.prev_month_1 || 0],
        borderColor: this.getColor(i),
        backgroundColor: this.getColor(i, 0.1),
        fill: false,
        tension: 0.4
      };
    });

    this.chart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  getColor(i: number, alpha = 1): string {
    const colors = ['#3699ff', '#1bc5bd', '#ffa800', '#f64e60', '#8950fc'];
    const color = colors[i % colors.length];
    return alpha < 1 ? color.replace(')', `, ${alpha})`).replace('#', 'rgba(') : color;
  }
}