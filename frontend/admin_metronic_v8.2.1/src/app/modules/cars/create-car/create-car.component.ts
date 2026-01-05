import { Component, EventEmitter, Output, OnInit, ChangeDetectorRef } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import Swal from 'sweetalert2';
import { Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { CarsService } from '../service/cars.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-create-car',
  templateUrl: './create-car.component.html',
  styleUrls: ['./create-car.component.scss']
})
export class CreateCarComponent implements OnInit {
  @Output() vehicleC: EventEmitter<any> = new EventEmitter();

  isLoading: boolean = false;
  form: FormGroup;
  subareas: any[] = [];
  marcas: any[] = [];
  tipos: any[] = [];
  estadosActuales: string[] = ['BUENO', 'REGULAR', 'MALO'];
  estadosAsigna: string[] = ['FORANEA', 'LOCAL', 'TRANSITORIO'];
  IMAGEN_VEHICULO: any;
  IMAGEN_PREVISUALIZA: any;

  // Controles para búsqueda/display en typeahead
  subareaSearch = new FormControl('');
  marcaSearch = new FormControl('');
  tipoSearch = new FormControl('');

  constructor(
    public modal: NgbActiveModal,
    public carsService: CarsService,
    public toast: ToastrService,
    private cdr: ChangeDetectorRef // Inyectado para resolver NG0100
  ) {
    this.form = new FormGroup({
      numero_eco: new FormControl('', [Validators.required, Validators.maxLength(50)]),
      subarea_asigna: new FormControl(null, [Validators.required]),
      marca_id: new FormControl(null, [Validators.required]),
      tipo_id: new FormControl(null),
      modelo: new FormControl(''),
      placa: new FormControl('', [Validators.maxLength(50)]),
      placa_anterior: new FormControl('', [Validators.maxLength(50)]),
      cilindro: new FormControl('', [Validators.maxLength(50)]),
      numero_serie: new FormControl('', [Validators.maxLength(100)]),
      numero_inven: new FormControl('', [Validators.maxLength(100)]),
      color: new FormControl('', [Validators.maxLength(50)]),
      estado_actual: new FormControl('BUENO'),
      estado_asigna: new FormControl('LOCAL'),
      add_new_marca: new FormControl(false),
      add_new_tipo: new FormControl(false),
      new_marca: new FormControl({ value: '', disabled: true }),
      new_tipo: new FormControl({ value: '', disabled: true }),
      area_name: new FormControl({ value: '', disabled: true }),
      state: new FormControl('', [Validators.required])
    });
  }

  ngOnInit(): void {
    this.loadSubareas();
    this.loadMarcas();

    // Habilitar/deshabilitar campos nuevos basados en checkboxes
    this.form.get('add_new_marca')?.valueChanges.subscribe(value => {
      const newMarcaControl = this.form.get('new_marca');
      if (value) {
        newMarcaControl?.enable();
        newMarcaControl?.setValidators([Validators.required, Validators.maxLength(50)]);
      } else {
        newMarcaControl?.disable();
        newMarcaControl?.clearValidators();
        newMarcaControl?.setValue('');
      }
      newMarcaControl?.updateValueAndValidity();
    });

    this.form.get('add_new_tipo')?.valueChanges.subscribe(value => {
      const newTipoControl = this.form.get('new_tipo');
      const tipoIdControl = this.form.get('tipo_id');
      const modeloControl = this.form.get('modelo');
      if (value) {
        newTipoControl?.enable();
        newTipoControl?.setValidators([Validators.required, Validators.maxLength(50)]);
        tipoIdControl?.clearValidators();
        modeloControl?.clearValidators();
      } else {
        newTipoControl?.disable();
        newTipoControl?.clearValidators();
        newTipoControl?.setValue('');
        tipoIdControl?.setValidators([Validators.required]);
        modeloControl?.setValidators([Validators.required]);
      }
      newTipoControl?.updateValueAndValidity();
      tipoIdControl?.updateValueAndValidity();
      modeloControl?.updateValueAndValidity();
    });

    // Validaciones en blur para unicidad con debounce
    ['numero_eco', 'placa', 'numero_serie', 'numero_inven'].forEach(field => {
      this.form.get(field)?.valueChanges.pipe(debounceTime(500)).subscribe(value => { // Aumentado debounce para mejor UX
        if (value?.trim()) this.validateUniqueness(field, value.trim().toUpperCase());
      });
    });
  }

  toUpperCase(field: string) {
    const value = this.form.get(field)?.value;
    if (value && typeof value === 'string') {
      this.form.get(field)?.setValue(value.toUpperCase(), { emitEvent: false });
    }
  }

  processFile($event: any) {
    const file = $event.target.files[0];
    if (!file?.type.startsWith('image/')) {
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'El archivo no es una imagen válida',
        confirmButtonText: 'Aceptar',
        customClass: { confirmButton: 'btn btn-warning' }
      });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'La imagen no debe exceder 2MB',
        confirmButtonText: 'Aceptar',
        customClass: { confirmButton: 'btn btn-warning' }
      });
      return;
    }
    this.IMAGEN_VEHICULO = file;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      this.IMAGEN_PREVISUALIZA = reader.result;
      this.cdr.detectChanges(); // Forzar detección para preview inmediata
    };
  }
  subareaFormatter = (subarea: any): string => {
  if (!subarea) return '';
  return `${subarea.name}`; // Ej: "UNIDAD DE INVESTIGACION (DIRECCION...)"
};
  
  marcaFormatter = (marca: any): string => marca?.nombre || '';
  tipoFormatter = (tipo: any): string => tipo?.nombre || '';

  private _filterSubareas(value: string): any[] {
    const filterValue = value.toLowerCase();
    return this.subareas.filter(subarea => subarea.name.toLowerCase().includes(filterValue)).slice(0, 10); // Simplificado, asumiendo datos únicos del backend
  }

  private _filterMarcas(value: string): any[] {
    const filterValue = value.toLowerCase();
    return this.marcas.filter(marca => marca.nombre.toLowerCase().includes(filterValue)).slice(0, 10);
  }

  private _filterTipos(value: string): any[] {
    const filterValue = value.toLowerCase();
    return this.tipos.filter(tipo => tipo.nombre.toLowerCase().includes(filterValue)).slice(0, 10);
  }

  searchSubareas = (text$: Observable<string>) => text$.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    map(term => term.length < 1 ? [] : this._filterSubareas(term))
  );

  searchMarcas = (text$: Observable<string>) => text$.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    map(term => term.length < 1 ? [] : this._filterMarcas(term))
  );

  searchTipos = (text$: Observable<string>) => text$.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    map(term => term.length < 1 ? [] : this._filterTipos(term))
  );

  loadSubareas() {
    this.isLoading = true;
    this.carsService.getSubareas().subscribe({
      next: (resp: any) => {
        this.subareas = resp.subareas || [];
        this.isLoading = false;
        this.cdr.detectChanges(); // Forzar detección después de carga asíncrona
      },
      error: (err: any) => {
        this.isLoading = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar las subáreas. Verifica la conexión al servidor.',
          confirmButtonText: 'Aceptar',
          customClass: { confirmButton: 'btn btn-danger' }
        });
      }
    });
  }

  loadMarcas() {
    this.isLoading = true;
    this.carsService.getMarcas().subscribe({
      next: (resp: any) => {
        this.marcas = resp.marcas || [];
        this.isLoading = false;
        this.cdr.detectChanges(); // Forzar detección
      },
      error: (err: any) => {
        this.isLoading = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar las marcas. Verifica la conexión al servidor.',
          confirmButtonText: 'Aceptar',
          customClass: { confirmButton: 'btn btn-danger' }
        });
      }
    });
  }

  onMarcaChange(marca: any) {
    const marcaId = marca?.id || null;
    this.form.patchValue({ marca_id: marcaId, tipo_id: null, add_new_tipo: false, add_new_marca: false, new_tipo: '' });
    this.marcaSearch.setValue(marca?.nombre || '');
    this.tipos = [];
    if (marcaId) {
      this.isLoading = true;
      this.carsService.getTiposByMarca(marcaId).subscribe({
        next: (resp: any) => {
          this.tipos = resp.tipos || [];
          this.isLoading = false;
          this.cdr.detectChanges();
          this.form.get('add_new_marca')?.disable(); // ❌ Desactivar "Agregar nueva marca"
          this.form.get('add_new_tipo')?.disable();
        },
        error: (err: any) => {
          this.isLoading = false;
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar los tipos',
            confirmButtonText: 'Aceptar',
            customClass: { confirmButton: 'btn btn-danger' }
          });
        }
      });
    }
  }

  onSubareaChange(subarea: any) {
    const subareaId = subarea?.id || null;
    this.form.patchValue({ subarea_asigna: subareaId });
    this.subareaSearch.setValue(subarea?.name || '');
    this.form.patchValue({ area_name: subarea?.area?.name || '' });
  }

  onTypeChange(tipo: any) {
    const tipoId = tipo?.id || null;
    this.form.patchValue({ tipo_id: tipoId });
    this.tipoSearch.setValue(tipo?.nombre || '');
  }

  createMarca() {
    const newMarca = this.form.get('new_marca')?.value?.trim().toUpperCase();
    if (!newMarca) {
      Swal.fire({
        icon: 'warning',
        title: 'Validación',
        text: 'El nombre de la nueva marca es requerido',
        confirmButtonText: 'Aceptar',
        customClass: { confirmButton: 'btn btn-warning' }
      });
      return;
    }
    this.isLoading = true;
    this.carsService.createMarca({ nombre: newMarca }).subscribe({
      next: (resp: any) => {
        this.marcas.push(resp.marca);
        this.form.patchValue({ marca_id: resp.marca.id, add_new_marca: false });
        this.marcaSearch.setValue(resp.marca.nombre);
        this.isLoading = false;
        this.cdr.detectChanges();
        Swal.fire({
          icon: 'success',
          title: 'Éxito',
          text: 'Marca creada y seleccionada',
          confirmButtonText: 'Aceptar',
          customClass: { confirmButton: 'btn btn-success' }
        });
      },
      error: (err: any) => {
        this.isLoading = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.message || 'No se pudo crear la marca',
          confirmButtonText: 'Aceptar',
          customClass: { confirmButton: 'btn btn-danger' }
        });
      }
    });
  }

  createTipo() {
    const newTipo = this.form.get('new_tipo')?.value?.trim().toUpperCase();
    const marcaId = this.form.get('marca_id')?.value;
    if (!newTipo) {
      Swal.fire({
        icon: 'warning',
        title: 'Validación',
        text: 'El nombre del nuevo tipo es requerido',
        confirmButtonText: 'Aceptar',
        customClass: { confirmButton: 'btn btn-warning' }
      });
      return;
    }
    if (!marcaId) {
      Swal.fire({
        icon: 'warning',
        title: 'Validación',
        text: 'Selecciona una marca primero',
        confirmButtonText: 'Aceptar',
        customClass: { confirmButton: 'btn btn-warning' }
      });
      return;
    }
    this.isLoading = true;
    this.carsService.createTipo({ nombre: newTipo, marca_id: marcaId }).subscribe({
      next: (resp: any) => {
        this.tipos.push(resp.tipo);
        this.form.patchValue({ tipo_id: resp.tipo.id, add_new_tipo: false });
        this.tipoSearch.setValue(resp.tipo.nombre);
        this.isLoading = false;
        this.cdr.detectChanges();
        Swal.fire({
          icon: 'success',
          title: 'Éxito',
          text: 'Tipo creado y seleccionado',
          confirmButtonText: 'Aceptar',
          customClass: { confirmButton: 'btn btn-success' }
        });
      },
      error: (err: any) => {
        this.isLoading = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.message || 'No se pudo crear el tipo',
          confirmButtonText: 'Aceptar',
          customClass: { confirmButton: 'btn btn-danger' }
        });
      }
    });
  }

  validateUniqueness(field: string, value: string) {
    if (!value) return;
    this.isLoading = true;
    this.carsService.validateUniqueness(field, value).subscribe({
      next: (resp: any) => {
        if (resp.exists) {
          Swal.fire({
            icon: 'warning',
            title: 'Validación',
            text: `El ${field.replace('_', ' ')} ya existe`,
            confirmButtonText: 'Aceptar',
            customClass: { confirmButton: 'btn btn-warning' }
          });
          this.form.patchValue({ [field]: '' });
        }
        this.isLoading = false;
      },
      error: (err: any) => {
        this.isLoading = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.message || 'Error al validar unicidad',
          confirmButtonText: 'Aceptar',
          customClass: { confirmButton: 'btn btn-danger' }
        });
      }
    });
  }

  store() {
    if (this.form.invalid) {
      Swal.fire({
        icon: 'warning',
        title: 'Validación',
        text: 'Completa todos los campos requeridos',
        confirmButtonText: 'Aceptar',
        customClass: { confirmButton: 'btn btn-warning' }
      });
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    const values = this.form.getRawValue();
    const formData = new FormData();
    formData.append('numero_eco', values.numero_eco.toUpperCase());
    formData.append('subarea_asigna', values.subarea_asigna.toString());
    formData.append('marca_id', values.marca_id.toString());
    if (values.tipo_id) formData.append('tipo_id', values.tipo_id.toString());
    if (values.modelo) formData.append('modelo', values.modelo.toUpperCase());
    if (values.placa) formData.append('placa', values.placa.toUpperCase());
    if (values.placa_anterior) formData.append('placa_anterior', values.placa_anterior.toUpperCase());
    if (values.cilindro) formData.append('cilindro', values.cilindro.toUpperCase());
    if (values.numero_serie) formData.append('numero_serie', values.numero_serie.toUpperCase());
    if (values.numero_inven) formData.append('numero_inven', values.numero_inven.toUpperCase());
    if (values.color) formData.append('color', values.color.toUpperCase());
    if (values.estado_actual) formData.append('estado_actual', values.estado_actual);
    if (values.estado_asigna) formData.append('estado_asigna', values.estado_asigna);
    if (this.IMAGEN_VEHICULO) formData.append('imagen_vehiculo', this.IMAGEN_VEHICULO);
    formData.append('state', values.state.toString());

    this.carsService.registerVehicle(formData).subscribe({
      next: (resp: any) => {
        Swal.fire({
          icon: 'success',
          title: 'Éxito',
          text: resp.message || 'Vehículo creado con éxito',
          confirmButtonText: 'Aceptar',
          customClass: { confirmButton: 'btn btn-success' }
        });
        this.vehicleC.emit(resp.vehicle);
        this.cdr.detectChanges(); // Forzar detección antes de cerrar para evitar NG0100
        this.modal.close();
        this.isLoading = false;
      },
      error: (err: any) => {
        this.isLoading = false;
        let message = 'Error al crear el vehículo';
        if (err.status === 422 && err.error.errors) {
          message = Object.values(err.error.errors).flat().join('\n');
        } else if (err.error.message) {
          message = err.error.message;
        }
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: message,
          confirmButtonText: 'Aceptar',
          customClass: { confirmButton: 'btn btn-danger' }
        });
      }
    });
  }
}