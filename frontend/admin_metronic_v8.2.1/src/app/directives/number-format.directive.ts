import { Directive, ElementRef, HostListener, NgZone, OnDestroy, OnInit } from '@angular/core';
import { NgControl } from '@angular/forms';
import { Subscription } from 'rxjs';

@Directive({
  selector: '[appNumberFormat]'
})
export class NumberFormatDirective implements OnInit, OnDestroy {
  private lastFormattedValue: string | null = null;
  private valueChangesSubscription: Subscription | null = null;

  constructor(
    private el: ElementRef<HTMLInputElement>,
    private control: NgControl,
    private ngZone: NgZone
  ) {
    //console.log('🧩 NumberFormatDirective inicializada para:', this.el.nativeElement);
  }

  ngOnInit() {
    this.ngZone.runOutsideAngular(() => {
      // Formatear valor inicial
      setTimeout(() => {
        const value = this.control.control?.value;
        if (value != null && !isNaN(Number(value))) {
          const formatted = Number(value).toLocaleString('es-MX');
          this.el.nativeElement.value = formatted;
          this.lastFormattedValue = formatted;
          //console.log('🧩 Valor inicial formateado:', formatted);
        }
      }, 0);

      // Escuchar cambios programáticos en el FormControl
      const valueChanges = this.control.control?.valueChanges;
      if (valueChanges) {
        this.valueChangesSubscription = valueChanges.subscribe(value => {
          this.ngZone.runOutsideAngular(() => {
            if (value != null && !isNaN(Number(value))) {
              const formatted = Number(value).toLocaleString('es-MX');
              if (formatted !== this.lastFormattedValue) {
                this.el.nativeElement.value = formatted;
                this.lastFormattedValue = formatted;
                //console.log('🧩 valueChanges ejecutado, valor formateado:', formatted);
              }
            }
          });
        });
      }
    });
  }

  ngOnDestroy() {
    if (this.valueChangesSubscription) {
      this.valueChangesSubscription.unsubscribe();
    }
  }

  @HostListener('focus') onFocus() {
    //console.log('🧩 onFocus ejecutado, valor actual:', this.control.control?.value);
    const value = this.control.control?.value;
    if (value === 0 || value === '0') {
      this.control.control?.setValue(null, { emitEvent: false });
      this.el.nativeElement.value = '';
      this.lastFormattedValue = null;
    } else if (value != null && !isNaN(Number(value))) {
      this.el.nativeElement.value = value.toString(); // Mostrar sin comas al editar
    }
  }

  @HostListener('input') onInput() {
    this.ngZone.runOutsideAngular(() => {
      const rawValue = this.el.nativeElement.value.replace(/[^0-9]/g, '');
      //console.log('🧩 onInput ejecutado, valor crudo:', rawValue);

      if (rawValue === '') {
        this.control.control?.setValue(null, { emitEvent: false });
        this.el.nativeElement.value = '';
        this.lastFormattedValue = null;
        return;
      }

      const numValue = Number(rawValue);
      if (isNaN(numValue)) {
        //console.warn('🧩 Valor no numérico detectado:', rawValue);
        this.control.control?.setValue(null, { emitEvent: false });
        this.el.nativeElement.value = '';
        this.lastFormattedValue = null;
        return;
      }

      const formattedValue = numValue.toLocaleString('es-MX');
      if (formattedValue !== this.lastFormattedValue) {
        this.el.nativeElement.value = formattedValue;
        this.control.control?.setValue(numValue, { emitEvent: false });
        this.lastFormattedValue = formattedValue;
        //console.log('🧩 Valor numérico:', numValue, 'Valor formateado:', formattedValue);
      }
    });
  }

  @HostListener('blur') onBlur() {
    //console.log('🧩 onBlur ejecutado, valor actual:', this.control.control?.value);
    this.ngZone.runOutsideAngular(() => {
      const value = this.control.control?.value;
      if (value === null || value === undefined || value === '') {
        this.control.control?.setValue(0, { emitEvent: false });
        this.el.nativeElement.value = '0';
        this.lastFormattedValue = '0';
        //console.log('🧩 onBlur: valor vacío, establecido a 0');
      } else {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          //console.warn('🧩 Valor no numérico en blur:', value);
          this.control.control?.setValue(0, { emitEvent: false });
          this.el.nativeElement.value = '0';
          this.lastFormattedValue = '0';
        } else {
          const formattedValue = numValue.toLocaleString('es-MX');
          // Forzar actualización del valor visual después de un pequeño retraso
          setTimeout(() => {
            this.el.nativeElement.value = formattedValue;
            this.lastFormattedValue = formattedValue;
            //console.log('🧩 onBlur formateado:', formattedValue, 'Valor numérico:', numValue);
          }, 0);
          this.control.control?.setValue(numValue, { emitEvent: false });
        }
      }
    });
  }

  @HostListener('ngModelChange', ['$event']) onModelChange(value: any) {
    this.ngZone.runOutsideAngular(() => {
      if (value != null && !isNaN(Number(value))) {
        const formatted = Number(value).toLocaleString('es-MX');
        if (formatted !== this.lastFormattedValue) {
          this.el.nativeElement.value = formatted;
          this.lastFormattedValue = formatted;
          //console.log('🧩 ngModelChange ejecutado, valor formateado:', formatted);
        }
      }
    });
  }
}