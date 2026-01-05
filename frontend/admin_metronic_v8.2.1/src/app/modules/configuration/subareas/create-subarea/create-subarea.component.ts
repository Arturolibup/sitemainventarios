import { Component, EventEmitter, Input, Output, OnInit, ChangeDetectorRef } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { SubareaService } from '../service/subarea.service';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-create-subarea',
  templateUrl: './create-subarea.component.html',
  styleUrls: ['./create-subarea.component.scss']
})
export class CreateSubareaComponent implements OnInit {
  @Input() areasnom: any[] = [];
  @Output() SubareaC: EventEmitter<any> = new EventEmitter();

  form: FormGroup;
  areaSearch = new FormControl('', Validators.required);
  municipios: string[] = [];
  isLoading: boolean = false;

  constructor(
    public modal: NgbActiveModal,
    public subareaService: SubareaService,
    public toast: ToastrService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = new FormGroup({
      name: new FormControl('', [Validators.required, Validators.maxLength(100)]),
      localidad: new FormControl('', [Validators.required, Validators.maxLength(100)]),
      municipio: new FormControl('', [Validators.required, Validators.maxLength(100)]),
      area_id: new FormControl(null, [Validators.required])
    });
  }

  ngOnInit(): void {
    this.getMunicipios();
    
  }

  getMunicipios(): void {
    this.isLoading = true;
    this.subareaService.getMunicipios().subscribe({
      next: (data: any) => {
        if (Array.isArray(data)) {
          this.municipios = data as string[];
        } else {
          this.toast.error('No se pudieron cargar los municipios', 'Error');
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        this.toast.error('Error al cargar los municipios', 'Error');
        this.cdr.detectChanges();
      }
    });
  }

  toUpperCase(field: string): void {
    const control = this.form.get(field);
    const value = control?.value;
    if (value && typeof value === 'string') {
      control?.setValue(value.toUpperCase(), { emitEvent: false });
      if (field === 'name' && value.trim()) {
        this.validateUniqueness(field, value.trim());
      }
    }
  }

  // Se llamará en blur del campo name
  onNameBlur(): void {
    const value = this.form.get('name')?.value?.trim();
    if (value) {
      this.validateUniqueness('name', value);
    }
  }

  areaFormatter = (area: any): string => area?.name || '';

  searchAreas = (text$: Observable<string>) => text$.pipe(
    debounceTime(300),
    distinctUntilChanged(),
    map(term =>
      term.length < 1
        ? []
        : this.areasnom
            .filter(area => area.name.toLowerCase().includes(term.toLowerCase()))
            .slice(0, 10)
    )
  );

  onAreaChange(area: any): void {
    const areaId = area?.id || null;
    this.form.patchValue({ area_id: areaId });
    this.areaSearch.setValue(area?.name || '');
  }

  validateUniqueness(field: string, value: string): void {
    if (!value) return;
    this.isLoading = true;
    this.subareaService.validateUniqueness(field, value).subscribe({
      next: (resp: any) => {
        if (resp.exists) {
          Swal.fire({
            icon: 'warning',
            title: 'Validación',
            text: `La subarea ya Existe`,
            confirmButtonText: 'Aceptar',
            customClass: { confirmButton: 'btn btn-warning' }
          });
          this.form.patchValue({ [field]: '' });
          this.form.get(field)?.setErrors({ unique: true });
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.isLoading = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: `Error al validar el ${field}`,
          confirmButtonText: 'Aceptar',
          customClass: { confirmButton: 'btn btn-danger' }
        });
        this.cdr.detectChanges();
      }
    });
  }

  store(): void {
    if (this.form.invalid || this.areaSearch.invalid) {
      Swal.fire({
        icon: 'warning',
        title: 'Validación',
        text: 'Completa todos los campos requeridos',
        confirmButtonText: 'Aceptar',
        customClass: { confirmButton: 'btn btn-warning' }
      });
      this.form.markAllAsTouched();
      this.areaSearch.markAsTouched();
      return;
    }

    this.isLoading = true;
    const values = this.form.getRawValue();
    const data = {
      name: values.name,
      localidad: values.localidad,
      municipio: values.municipio,
      area_id: values.area_id
    };

    this.subareaService.registerSubarea(data).subscribe({
      next: (resp: any) => {
        if (resp.message === 403) {
          this.toast.error(resp.message_text, 'Validación');
        } else {
          this.toast.success('La subárea se registró correctamente', 'Éxito');
          this.SubareaC.emit(resp.subarea);
          this.modal.close();
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.isLoading = false;
        let message = 'Error al crear la subárea';
        if (err.status === 422 && err.error.errors) {
          message = Object.entries(err.error.errors)
            .map(([field, errors]) => `${field}: ${(errors as string[]).join(', ')}`)
            .join('\n');
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
        this.cdr.detectChanges();
      }
    });
  }
}
