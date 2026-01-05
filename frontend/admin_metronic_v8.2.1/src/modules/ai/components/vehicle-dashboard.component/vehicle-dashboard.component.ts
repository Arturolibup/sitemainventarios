import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  ElementRef,
} from '@angular/core';

import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';

import { Observable, Subscription, forkJoin } from 'rxjs';
import { AiService } from '../../services/ai.service';

import {
  Chart,
  registerables,
} from 'chart.js';

import Tagify from '@yaireo/tagify';
import { CommonModule } from '@angular/common';

Chart.register(...registerables);

@Component({
  selector: 'app-vehicle-dashboard',
 
 
  templateUrl: './vehicle-dashboard.component.html',
  styleUrls: ['./vehicle-dashboard.component.scss'],
})
export class VehicleDashboardComponent
  implements OnInit, AfterViewInit, OnDestroy {

  /**************************************
   * VIEWCHILD — INPUTS TAGIFY
   **************************************/
  @ViewChild('subareaInput') subareaInput!: ElementRef<HTMLInputElement>;
  @ViewChild('areaInput') areaInput!: ElementRef<HTMLInputElement>;
  @ViewChild('productInput') productInput!: ElementRef<HTMLInputElement>;
  @ViewChild('providerInput') providerInput!: ElementRef<HTMLInputElement>;
  @ViewChild('numeroEcoInput') numeroEcoInput!: ElementRef<HTMLInputElement>;
  @ViewChild('marcaRefaccionInput') marcaRefaccionInput!: ElementRef<HTMLInputElement>;
  @ViewChild('marcaVehiculoInput') marcaVehiculoInput!: ElementRef<HTMLInputElement>;
  @ViewChild('tipoVehiculoInput') tipoVehiculoInput!: ElementRef<HTMLInputElement>;

  @ViewChild('partidaInput') partidaInput!: ElementRef<HTMLInputElement>;
  @ViewChild('modeloInput') modeloInput!: ElementRef<HTMLInputElement>;
  @ViewChild('cilindroInput') cilindroInput!: ElementRef<HTMLInputElement>;
  @ViewChild('colorInput') colorInput!: ElementRef<HTMLInputElement>;
  @ViewChild('estadoInput') estadoInput!: ElementRef<HTMLInputElement>;

  /**************************************
   * CHARTS
   **************************************/
  @ViewChild('monthlyChartCanvas') monthlyChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('topVehiclesChartCanvas') topVehiclesChartCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('topAreasChartCanvas') topAreasChartCanvas!: ElementRef<HTMLCanvasElement>;

  filtersForm!: FormGroup;

  summary: any = null;
  tables: any = null;
  detail: any = null;

  insights: any = null;
  iaLoading = false;
  iaLastUpdated: Date | null = null;

  monthlyChart?: Chart;
  topVehiclesChart?: Chart;
  topAreasChart?: Chart;

  private subs: Subscription[] = [];

  /**************************************
   * INSTANCIAS TAGIFY
   **************************************/
  private subareaTagify: any;
  private areaTagify: any;
  private productTagify: any;
  private providerTagify: any;
  private numeroEcoTagify: any;
  private marcaRefTagify: any;
  private marcaVehiculoTagify: any;
  private tipoVehiculoTagify: any;
  private partidaTagify: any;
  private modeloTagify: any;
  private cilindroTagify: any;
  private colorTagify: any;
  private estadoTagify: any;

  /**************************************
   * CATALOGOS EN FORMATO TAGIFY
   **************************************/
  areaOptions: any[] = [];         // [{ value }]
  subareaOptions: any[] = [];      // [{ value, area_nombre }]
  productOptions: any[] = [];      // [{ value }]
  providerOptions: any[] = [];     // [{ value }]
  vehicleOptions: any[] = [];      // [{ value, placa, marca_vehiculo, tipo_vehiculo }]
  yearsList: number[] = [];

  marcaRefaccionOptions: any[] = []; // [{ value }]
  marcaVehiculoOptions: any[] = [];  // [{ value }]
  tipoVehiculoOptions: any[] = [];   // [{ value }]

  partidaOptions: any[] = [];     // [{ value }]
  modeloOptions: any[] = [];      // [{ value }]
  cilindroOptions: any[] = [];    // [{ value }]
  colorOptions: any[] = [];       // [{ value }]
  estadoOptions: any[] = [];      // [{ value }]

  isLoading$: Observable<boolean>;

  constructor(
    private fb: FormBuilder,
    private aiService: AiService
  ) {
    this.isLoading$ = this.aiService.isLoading$;
  }

  /**************************************
   * INIT
   **************************************/
  ngOnInit(): void {
    this.generateYearsList();
    this.buildForm();
    this.loadTagifyCatalogs();
    this.loadDashboard();
  }

  ngAfterViewInit(): void {
    this.initTagify();
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());

    this.monthlyChart?.destroy();
    this.topAreasChart?.destroy();
    this.topVehiclesChart?.destroy();

    this.destroyTagify();
  }

  private destroyTagify(): void {
    this.subareaTagify?.destroy();
    this.areaTagify?.destroy();
    this.productTagify?.destroy();
    this.providerTagify?.destroy();
    this.numeroEcoTagify?.destroy();
    this.marcaRefTagify?.destroy();
    this.marcaVehiculoTagify?.destroy();
    this.tipoVehiculoTagify?.destroy();
    this.partidaTagify?.destroy();
    this.modeloTagify?.destroy();
    this.cilindroTagify?.destroy();
    this.colorTagify?.destroy();
    this.estadoTagify?.destroy();
  }

  /**************************************
   * FORM
   **************************************/
  private buildForm(): void {
    const now = new Date();

    this.filtersForm = this.fb.group({
      fecha_desde: [null],
      fecha_hasta: [null],
      anio: [now.getFullYear()],
      mes: [null],

      area: [''],
      subarea: [''],
      numero_eco: [''],
      proveedor_nombre: [''],
      producto: [''],

      marca_refaccion: [''],
      marca_vehiculo: [''],
      tipo_vehiculo: [''],

      partida: [''],
      modelo: [''],
      cilindro: [''],
      color: [''],
      estado_actual: [''],

      importe_min: [null],
      importe_max: [null],
    });
  }

  private buildFilters(): any {
    const raw = this.filtersForm.value;
    const filters: any = {};

    Object.keys(raw).forEach((key) => {
      const v = raw[key];
      if (v !== null && v !== undefined && v !== '') {
        filters[key] = v;
      }
    });

    return filters;
  }

  private generateYearsList(): void {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 2; // últimos 10 años
  const endYear = currentYear + 5;   // próximos 5 años por si lo ocupas

  this.yearsList = [];

  for (let y = endYear; y >= startYear; y--) {
    this.yearsList.push(y);
  }
}

  /**************************************
   * CARGA DE CATÁLOGOS DEL SERVICIO
   **************************************/
  private loadTagifyCatalogs(): void {
    const sub = this.aiService.getVehicleDashboardFilters().subscribe({
      next: (res: any) => {
        console.log('CATÁLOGOS RECIBIDOS:', res);

        // ÁREAS → [{ value }]
        const areasRaw = res.areas ?? [];
        this.areaOptions = areasRaw.map((a: any) => ({
          value: a.name,
        }));

        // SUBÁREAS → [{ value, area_nombre }]
        const subareasRaw = res.subareas ?? [];
        this.subareaOptions = subareasRaw.map((s: any) => {
          const area = areasRaw.find((a: any) => a.id === s.area_id);
          return {
            value: s.name,
            area_nombre: area ? area.name : '',
          };
        });

        // PRODUCTOS → [{ value }]
        this.productOptions = (res.products ?? []).map((p: any) => ({
          value: p.title,
        }));

        // PROVEEDORES → [{ value }]
        this.providerOptions = (res.providers ?? []).map((p: any) => ({
          value: p.full_name,
        }));

        // VEHÍCULOS → [{ value, placa, marca_vehiculo, tipo_vehiculo }]
        this.vehicleOptions = (res.vehicles ?? []).map((v: any) => ({
          value: v.numero_eco,
          placa: v.placa,
          marca_vehiculo: v.marca_vehiculo,
          tipo_vehiculo: v.tipo_vehiculo,
        }));

        // CAMPOS STRING → [{ value }]
        this.marcaRefaccionOptions = (res.marcas_refaccion ?? []).map((x: string) => ({ value: x }));
        this.marcaVehiculoOptions  = (res.marcas_vehiculo ?? []).map((x: string) => ({ value: x }));
        this.tipoVehiculoOptions   = (res.tipos_vehiculo ?? []).map((x: string) => ({ value: x }));
        this.partidaOptions        = (res.partidas ?? []).map((x: string) => ({ value: x }));
        this.modeloOptions         = (res.modelos ?? []).map((x: string) => ({ value: x }));
        this.cilindroOptions       = (res.cilindros ?? []).map((x: string) => ({ value: x }));
        this.colorOptions          = (res.colores ?? []).map((x: string) => ({ value: x }));
        this.estadoOptions         = (res.estados ?? []).map((x: string) => ({ value: x }));

        // Actualiza whitelists de Tagify si ya existen
        this.updateTagifyWhitelists();
      },
      error: (err) => console.error('Error cargando catálogos', err),
    });

    this.subs.push(sub);
  }

  /**************************************
   * TAGIFY INIT — TODO TAGIFY VA SOBRE
   * ARRAYS YA FORMATEADOS [{ value, ... }]
   **************************************/
  private initTagify(): void {
    const build = (
      input: ElementRef<HTMLInputElement> | undefined,
      whitelist: any[],
      onChange: (v: any) => void
    ) => {
      if (!input) return null;

      const instance = new Tagify(input.nativeElement, {
        enforceWhitelist: false,
        maxTags: 1,
        dropdown: { enabled: 0 },
        whitelist,
      });

      instance.on('change', () => {
        const v = (instance.value && instance.value[0]) || null;
        onChange(v);
      });

      return instance;
    };

    /** Subárea */
    this.subareaTagify = build(
      this.subareaInput,
      this.subareaOptions, // [{ value, area_nombre }]
      (v: any) => {
        this.filtersForm.patchValue({
          subarea: v?.value ?? '',
          area: v?.area_nombre ?? '',
        });
      }
    );

    /** Área */
    this.areaTagify = build(
      this.areaInput,
      this.areaOptions, // [{ value }]
      (v: any) => {
        this.filtersForm.patchValue({ area: v?.value ?? '' });
      }
    );

    /** Producto */
    this.productTagify = build(
      this.productInput,
      this.productOptions, // [{ value }]
      (v: any) => {
        this.filtersForm.patchValue({ producto: v?.value ?? '' });
      }
    );

    /** Proveedor */
    this.providerTagify = build(
      this.providerInput,
      this.providerOptions, // [{ value }]
      (v: any) => {
        this.filtersForm.patchValue({ proveedor_nombre: v?.value ?? '' });
      }
    );

    /** Vehículo (número económico) */
    this.numeroEcoTagify = build(
      this.numeroEcoInput,
      this.vehicleOptions, // [{ value, placa, marca_vehiculo, tipo_vehiculo }]
      (v: any) => {
        this.filtersForm.patchValue({
          numero_eco: v?.value ?? '',
          marca_vehiculo: v?.marca_vehiculo ?? '',
          tipo_vehiculo: v?.tipo_vehiculo ?? '',
        });
      }
    );

    /** Marca refacción */
    this.marcaRefTagify = build(
      this.marcaRefaccionInput,
      this.marcaRefaccionOptions, // [{ value }]
      (v: any) => {
        this.filtersForm.patchValue({ marca_refaccion: v?.value ?? '' });
      }
    );

    /** Marca vehículo */
    this.marcaVehiculoTagify = build(
      this.marcaVehiculoInput,
      this.marcaVehiculoOptions, // [{ value }]
      (v: any) => {
        this.filtersForm.patchValue({ marca_vehiculo: v?.value ?? '' });
      }
    );

    /** Tipo vehículo */
    this.tipoVehiculoTagify = build(
      this.tipoVehiculoInput,
      this.tipoVehiculoOptions, // [{ value }]
      (v: any) => {
        this.filtersForm.patchValue({ tipo_vehiculo: v?.value ?? '' });
      }
    );

    /** Partida */
    this.partidaTagify = build(
      this.partidaInput,
      this.partidaOptions, // [{ value }]
      (v: any) => {
        this.filtersForm.patchValue({ partida: v?.value ?? '' });
      }
    );

    /** Modelo */
    this.modeloTagify = build(
      this.modeloInput,
      this.modeloOptions, // [{ value }]
      (v: any) => {
        this.filtersForm.patchValue({ modelo: v?.value ?? '' });
      }
    );

    /** Cilindro */
    this.cilindroTagify = build(
      this.cilindroInput,
      this.cilindroOptions, // [{ value }]
      (v: any) => {
        this.filtersForm.patchValue({ cilindro: v?.value ?? '' });
      }
    );

    /** Color */
    this.colorTagify = build(
      this.colorInput,
      this.colorOptions, // [{ value }]
      (v: any) => {
        this.filtersForm.patchValue({ color: v?.value ?? '' });
      }
    );

    /** Estado actual */
    this.estadoTagify = build(
      this.estadoInput,
      this.estadoOptions, // [{ value }]
      (v: any) => {
        this.filtersForm.patchValue({ estado_actual: v?.value ?? '' });
      }
    );
  }

  /**************************************
   * UPDATE WHITELISTS
   **************************************/
  private updateTagifyWhitelists(): void {
    if (this.subareaTagify)
      this.subareaTagify.settings.whitelist = this.subareaOptions;

    if (this.areaTagify)
      this.areaTagify.settings.whitelist = this.areaOptions;

    if (this.productTagify)
      this.productTagify.settings.whitelist = this.productOptions;

    if (this.providerTagify)
      this.providerTagify.settings.whitelist = this.providerOptions;

    if (this.numeroEcoTagify)
      this.numeroEcoTagify.settings.whitelist = this.vehicleOptions;

    if (this.marcaRefTagify)
      this.marcaRefTagify.settings.whitelist = this.marcaRefaccionOptions;

    if (this.marcaVehiculoTagify)
      this.marcaVehiculoTagify.settings.whitelist = this.marcaVehiculoOptions;

    if (this.tipoVehiculoTagify)
      this.tipoVehiculoTagify.settings.whitelist = this.tipoVehiculoOptions;

    if (this.partidaTagify)
      this.partidaTagify.settings.whitelist = this.partidaOptions;

    if (this.modeloTagify)
      this.modeloTagify.settings.whitelist = this.modeloOptions;

    if (this.cilindroTagify)
      this.cilindroTagify.settings.whitelist = this.cilindroOptions;

    if (this.colorTagify)
      this.colorTagify.settings.whitelist = this.colorOptions;

    if (this.estadoTagify)
      this.estadoTagify.settings.whitelist = this.estadoOptions;
  }

  /**************************************
   * LOAD DASHBOARD
   **************************************/
  loadDashboard(): void {
    const filters = this.buildFilters();

    const sub = forkJoin({
      summary: this.aiService.getVehicleDashboardSummary(filters),
      tables: this.aiService.getVehicleDashboardTables(filters),
      detail: this.aiService.getVehicleDashboardDetail(1, 20, filters),
      insights: this.aiService.getVehicleDashboardInsights(filters),
    }).subscribe({
      next: (res) => {
        this.summary = res.summary;
        this.tables = res.tables;
        this.detail = res.detail;
        //this.insights = res.insights;

        this.renderCharts();
      },
      error: (err) => console.error('Error loadDashboard()', err),
    });

    this.subs.push(sub);

    this.loadIaInsights(filters);
  }

  private loadIaInsights(filters: any): void {
    this.iaLoading = true;
    this.insights = null;

    const subIa = this.aiService.getVehicleDashboardInsights(filters).subscribe({
      next: (analysis: string) => {
        this.insights = analysis;
        this.iaLastUpdated = new Date();
      },
      error: (err) => {
        console.error('Error IA insights', err);
        this.insights = 'No fue posible obtener el análisis IA para estos filtros.';
      },
      complete: () => {
        this.iaLoading = false;
      }
    });

    this.subs.push(subIa);
  }


  reloadIaOnly(): void {
    const filters = this.buildFilters();
    this.loadIaInsights(filters);
  }

    mesesList = [
    { value: 1, label: "Enero" },
    { value: 2, label: "Febrero" },
    { value: 3, label: "Marzo" },
    { value: 4, label: "Abril" },
    { value: 5, label: "Mayo" },
    { value: 6, label: "Junio" },
    { value: 7, label: "Julio" },
    { value: 8, label: "Agosto" },
    { value: 9, label: "Septiembre" },
    { value: 10, label: "Octubre" },
    { value: 11, label: "Noviembre" },
    { value: 12, label: "Diciembre" }
  ];


  onApplyFilters(): void {
    this.loadDashboard();
  }

  onResetFilters(): void {
    const now = new Date();
    this.filtersForm.reset({ anio: now.getFullYear() });

    // limpiar tags visuales
    this.destroyTagify();
    this.initTagify();

    this.loadDashboard();
  }

  /**************************************
   * CHARTS
   **************************************/
  private renderCharts(): void {
    // mensual
    const monthly = this.summary?.charts?.monthly ?? [];
    const labels = monthly.map(
      (x: any) => `${x.anio}-${String(x.mes).padStart(2, '0')}`
    );
    const values = monthly.map((x: any) => Number(x.total_mes));

    this.monthlyChart?.destroy();
    if (this.monthlyChartCanvas && labels.length) {
      this.monthlyChart = new Chart(this.monthlyChartCanvas.nativeElement, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Gasto mensual', data: values }] },
      });
    }

    // top vehículos
    const topVehicles = this.summary?.charts?.top_vehicles ?? [];
    const tvLabels = topVehicles.map(
      (v: any) => `${v.numero_eco} (${v.vehiculo_placa})`
    );
    const tvValues = topVehicles.map((v: any) => Number(v.total));

    this.topVehiclesChart?.destroy();
    if (this.topVehiclesChartCanvas && tvLabels.length) {
      this.topVehiclesChart = new Chart(this.topVehiclesChartCanvas.nativeElement, {
        type: 'bar',
        data: { labels: tvLabels, datasets: [{ data: tvValues }] },
        options: { indexAxis: 'y' },
      });
    }

    // top áreas
    const topAreas = this.summary?.charts?.top_areas ?? [];
    const taLabels = topAreas.map((a: any) => a.area_nombre);
    const taValues = topAreas.map((a: any) => Number(a.total));

    this.topAreasChart?.destroy();
    if (this.topAreasChartCanvas && taLabels.length) {
      this.topAreasChart = new Chart(this.topAreasChartCanvas.nativeElement, {
        type: 'bar',
        data: { labels: taLabels, datasets: [{ data: taValues }] },
        options: { indexAxis: 'y' },
      });
    }
  }

  /**************************************
   * FORMAT CURRENCY
   **************************************/
  formatCurrency(v: any): string {
    const num = Number(v || 0);
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(num);
  }

  /**************************************
   * PDF
   **************************************/
  downloadPdf(): void {
    const filters = this.buildFilters();

    const sub = this.aiService.exportVehicleDashboardPdf(filters).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dashboard_vehiculos.pdf';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: err => console.error('Error al descargar PDF', err),
    });

    this.subs.push(sub);
  }

  /**************************************
   * IA SUMMARY TEXT
   **************************************/
  get iaSummaryText(): string {
  if (!this.insights) return 'Aún no hay análisis IA.';

  // si ya es string, lo devolvemos directo
  if (typeof this.insights === 'string') {
    return this.insights;
  }

  // si llega un objeto lo transformamos en texto legible
  return JSON.stringify(this.insights, null, 2);
}



  /**************************************
   * COPIAR TEXTO IA
   **************************************/
  copyIaText(): void {
    const text = this.iaSummaryText;
    if (!navigator.clipboard || !text) return;

    navigator.clipboard.writeText(text).then(
      () => {
        console.log('Texto IA copiado al portapapeles.');
      },
      (err) => {
        console.error('Error al copiar IA:', err);
      }
    );
  }
}