import { Component, EventEmitter, Input, OnInit, ChangeDetectorRef, Output } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import Swal from 'sweetalert2';
import { forkJoin, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { CarsService } from '../service/cars.service';
import { ToastrService } from 'ngx-toastr';
import { Marca, Subarea, Tipo, Vehicle } from 'src/app/models/interfaces';



@Component({
  selector: 'app-edit-car',
  templateUrl: './edit-car.component.html',
  styleUrls: ['./edit-car.component.scss']
})
export class EditCarComponent implements OnInit {
  @Input() vehicleId!: number;
  @Input() vehicleData?: Vehicle;
  @Output() onSave: EventEmitter<Vehicle> = new EventEmitter();

  isLoading = false;
  form: FormGroup;
  subareas: Subarea[] = [];
  marcas: Marca[] = [];
  tipos: Tipo[] = [];
  estadosActuales = ['BUENO', 'REGULAR', 'MALO'];
  estadosAsigna = ['FORANEA', 'LOCAL', 'TRANSITORIO'];
  IMAGEN_VEHICULO?: File;
  IMAGEN_PREVISUALIZA?: string;


  subareaSearch = new FormControl<Subarea | null>(null, [Validators.required]);
  marcaSearch = new FormControl<Marca | null>(null, [Validators.required]);
  tipoSearch = new FormControl<Tipo | null>(null, [Validators.required]);

  constructor(
    public modal: NgbActiveModal,
    private carsService: CarsService,
    private toast: ToastrService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = new FormGroup({
      numero_eco: new FormControl('', [Validators.required, Validators.maxLength(50)]),
      subarea_asigna: new FormControl(null, [Validators.required]),
      marca_id: new FormControl(null, [Validators.required]),
      tipo_id: new FormControl(null, [Validators.required]),
      modelo: new FormControl('', [Validators.required, Validators.maxLength(100)]),
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
      state: new FormControl(1)
    });
  }

  ngOnInit(): void {
  this.isLoading = true;
  forkJoin({
    subareas: this.carsService.getSubareas(),
    marcas: this.carsService.getMarcas()
  }).subscribe({
    next: ({ subareas, marcas }) => {
      this.subareas = subareas.subareas || [];
      this.marcas = marcas.marcas || [];
      this.loadVehicle(); // Cargar vehículo después de tener subáreas y marcas
      this.isLoading = false;
      this.cdr.detectChanges();
    },
    error: () => {
      this.isLoading = false;
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron cargar los datos iniciales',
        confirmButtonText: 'Aceptar',
        customClass: { confirmButton: 'btn btn-danger' }
      });
    }
  });

  // Sincronizar tipoSearch con tipo_id
  this.tipoSearch.valueChanges.subscribe((value: Tipo | null) => {
      console.log('tipoSearch cambió:', value);
      if (value && value.id) {
        this.onTypeChange(value);
      } else {
        this.form.patchValue({ tipo_id: null }, { emitEvent: false });
      }
    });

  
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
      this.form.get(field)?.valueChanges.pipe(debounceTime(500)).subscribe(value => {
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
    reader.onloadend = () => {
      this.IMAGEN_PREVISUALIZA = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  subareaFormatter = (subarea: any): string => subarea?.name || '';
  marcaFormatter = (marca: any): string => marca?.nombre || '';
  tipoFormatter = (tipo: any): string => tipo?.nombre || '';

  private _filterSubareas(value: string | Subarea): Subarea[] {
    const filterValue = typeof value === 'string' ? value.toLowerCase() : value.name.toLowerCase();
    return this.subareas.filter(subarea => subarea.name.toLowerCase().includes(filterValue)).slice(0, 10);
  }

  private _filterMarcas(value: string | Marca): Marca[] {
    const filterValue = typeof value === 'string' ? value.toLowerCase() : value.nombre.toLowerCase();
    return this.marcas.filter(marca => marca.nombre.toLowerCase().includes(filterValue)).slice(0, 10);
  }

  private _filterTipos(value: string | Tipo): Tipo[] {
    const filterValue = typeof value === 'string' ? value.toLowerCase() : value.nombre.toLowerCase();
    return this.tipos.filter(tipo => tipo.nombre.toLowerCase().includes(filterValue)).slice(0, 10);
  }

  searchSubareas = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      map(term => term.length < 1 ? [] : this._filterSubareas(term))
    );

  searchMarcas = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      map(term => term.length < 1 ? [] : this._filterMarcas(term))
    );

  searchTipos = (text$: Observable<string>) =>
    text$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      map(term => term.length < 1 ? [] : this._filterTipos(term))
    );

  loadSubareas() {
    this.isLoading = true;
    this.carsService.getSubareas().subscribe({
      next: (resp: any) => {
        this.subareas = resp.subareas || [];
        console.log ( "subareas cargadas primero", this.subareas);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar las subáreas',
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
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar las marcas',
          confirmButtonText: 'Aceptar',
          customClass: { confirmButton: 'btn btn-danger' }
        });
      }
    });
  }

  loadVehicle() {
  this.isLoading = true;
  this.carsService.getVehicle(this.vehicleId).subscribe({
    next: (resp: any) => {
      const v = resp.vehicle;
      console.log('Respuesta del vehículo:', v);
      this.form.patchValue({
        numero_eco: v.numero_eco,
        subarea_asigna: v.subarea?.id,
        marca_id: v.marca?.id,
        tipo_id: v.tipo?.id,
        modelo: v.modelo,
        placa: v.placa,
        placa_anterior: v.placa_anterior,
        cilindro: v.cilindro,
        numero_serie: v.numero_serie,
        numero_inven: v.numero_inven,
        color: v.color,
        estado_actual: v.estado_actual || 'BUENO',
        estado_asigna: v.estado_asigna || 'LOCAL',
        area_name: v.subarea?.area?.name || '',
        state: v.state
      });

      if (v.subarea) {
        const subarea = this.subareas.find(s => s.id === v.subarea.id);
        console.log('Subarea encontrada en la lista:', subarea);
        console.log('Asignando a subareaSearch:', subarea);
        if (subarea) {
          this.subareaSearch.setValue(subarea);
          this.onSubareaChange(subarea);
        } else {
          console.warn('Subarea no encontrada en la lista:', v.subarea);
        }
      }

      if (v.marca) {
        const marca = this.marcas.find(m => m.id === v.marca.id);
        console.log('Marca encontrada en la lista:', marca);
        console.log('Asignando a marcaSearch:', marca);
        if (marca) {
          this.marcaSearch.setValue(marca);
          this.loadTiposForMarca(marca, v.tipo.id); //carga los tipos y asigna tipoSearch
        }
      }

      if (v.tipo) {
          console.log('Tipo encontrado:', v.tipo);
          // La asignación de tipoSearch se maneja en onMarcaChange para garantizar que los tipos estén cargados
        }

      if (v.imagen_vehiculo) {
        this.IMAGEN_PREVISUALIZA = v.imagen_vehiculo;
      }

      this.isLoading = false;
      this.cdr.detectChanges();
    },
    error: () => {
      this.isLoading = false;
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar el vehículo',
        confirmButtonText: 'Aceptar',
        customClass: { confirmButton: 'btn btn-danger' }
      });
    }
  });
}


private loadTiposForMarca(marca: Marca, tipoId: number | null) {
    this.isLoading = true;
    this.carsService.getTiposByMarca(marca.id).subscribe({
      next: (resp: { tipos: Tipo[] }) => {
        this.tipos = resp.tipos || [];
        console.log('Tipos cargados:', this.tipos);
        if (tipoId) {
          const tipo = this.tipos.find(t => t.id === tipoId);
          if (tipo) {
            console.log('Asignando a tipoSearch:', tipo);
            // MODIFICACIÓN: Usar setTimeout para asegurar que ngbTypeahead esté listo (línea 347)
            setTimeout(() => {
              this.tipoSearch.setValue(tipo);
              this.onTypeChange(tipo);
              this.cdr.detectChanges();
            }, 0);
          } else {
            console.warn('Tipo no encontrado en la lista:', tipoId);
            this.tipoSearch.setValue(null);
          }
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudieron cargar los tipos',
          confirmButtonText: 'Aceptar',
          customClass: { confirmButton: 'btn btn-danger' }
        });
        this.cdr.detectChanges();
      }
    });
  }
  
  onMarcaChange(marca: Marca | null) {
    const marcaId = marca?.id || null;
    console.log('Marca seleccionada:', marca);
    this.form.patchValue({ marca_id: marcaId, add_new_tipo: false, new_tipo: '' });
    this.marcaSearch.setValue(marca);
    this.tipos = [];
    this.tipoSearch.setValue(null);
    if (marcaId) {
      this.isLoading = true;
      this.carsService.getTiposByMarca(marcaId).subscribe({
        next: (resp: { tipos: Tipo[] }) => {
          this.tipos = resp.tipos || [];
          console.log('Tipos cargados:', this.tipos);
          const tipoId = this.form.get('tipo_id')?.value as number | null;
          console.log('Buscando tipo con ID:', tipoId);
          const tipo = this.tipos.find(t => t.id === tipoId);
          if (tipo) {
            console.log('Asignando a tipoSearch:', tipo);
            this.tipoSearch.setValue(tipo);
            this.onTypeChange(tipo);
          } else {
            console.warn('Tipo no encontrado en la lista:', tipoId);
            this.tipoSearch.setValue(null);
          }
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.isLoading = false;
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudieron cargar los tipos',
            confirmButtonText: 'Aceptar',
            customClass: { confirmButton: 'btn btn-danger' }
          });
          this.cdr.detectChanges();
        }
      });
    } else {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  onSubareaChange(subarea: Subarea | null) {
    console.log ("Subarea seleccionada:", subarea);
    const subareaId = subarea?.id || null;
    this.form.patchValue({ subarea_asigna: subareaId, area_name: subarea?.area?.name || '' });
    this.subareaSearch.setValue(subarea);
    this.cdr.detectChanges();
  }

  onTypeChange(tipo: Tipo | null) {
    console.log('Tipo seleccionado:', tipo);
    const tipoId = tipo?.id || null;
    this.form.patchValue({ tipo_id: tipoId });
    this.tipoSearch.setValue(tipo, { emitEvent: false });
    //this.cdr.detectChanges();
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
        this.marcaSearch.setValue(resp.marca);
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
      next: (resp: { tipo: Tipo }) => {
        this.tipos.push(resp.tipo);
        this.form.patchValue({ tipo_id: resp.tipo.id, add_new_tipo: false });
        this.tipoSearch.setValue(resp.tipo);
        this.onTypeChange(resp.tipo);
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
        this.cdr.detectChanges();
      }
    });
  }

  validateUniqueness(field: string, value: string) {
    if (!value) return;
    this.isLoading = true;
    this.carsService.validateUniqueness(field, value, this.vehicleId).subscribe({
      next: (resp: { exists: boolean }) => {
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

  update() {
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
    // Agregar area_id derivado de subarea
    const subarea = this.subareas.find(s => s.id === values.subarea_asigna);
    if (subarea?.area?.id) {
      formData.append('area_id', subarea.area.id.toString());
    }

    this.carsService.updateVehicle(this.vehicleId, formData).subscribe({
      next: (resp: { vehicle: Vehicle; message?: string }) => {
        Swal.fire({
          icon: 'success',
          title: 'Éxito',
          text: resp.message || 'Vehículo actualizado con éxito',
          confirmButtonText: 'Aceptar',
          customClass: { confirmButton: 'btn btn-success' }
        });
        this.onSave.emit(resp.vehicle);
        this.cdr.detectChanges();
        this.modal.close(resp.vehicle);
        this.isLoading = false;
      },
      error: (err: any) => {
        this.isLoading = false;
        let message = 'Error al actualizar el vehículo';
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
}//