import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { NotificationService } from './notification.service';

interface ErrorMessage {
  message: string;
  details: string[];
}

@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {
  constructor(private notificationService: NotificationService) {}

  intercept(
    req: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        const { message, details } = this.buildMessage(error);
        this.notificationService.error(message, details);
        return throwError(() => error);
      })
    );
  }

  private buildMessage(error: HttpErrorResponse): ErrorMessage {
    if (error.status === 0) {
      return { message: 'No hay conexión con el servidor.', details: [] };
    }

    const details = this.flattenErrors(error.error?.errors);
    let message = this.extractMessage(error) || 'Ha ocurrido un error.';

    switch (error.status) {
      case 401:
        message = 'Sesión expirada o credenciales inválidas.';
        break;
      case 403:
        message = 'No tienes permiso para realizar esta acción.';
        break;
      case 404:
        message = 'Recurso no encontrado.';
        break;
      case 422:
        message = this.extractMessage(error) || 'Datos inválidos.';
        break;
      case 500:
        message = 'Error interno del servidor.';
        break;
    }

    return { message, details };
  }

  private extractMessage(error: HttpErrorResponse): string {
    if (error.error?.message) {
      return error.error.message;
    }

    if (typeof error.error === 'string' && error.error.trim()) {
      return error.error;
    }

    return error.message;
  }

  private flattenErrors(errors: any): string[] {
    if (!errors) return [];

    if (Array.isArray(errors)) {
      return errors.map(String);
    }

    if (typeof errors === 'object') {
      return Object.values(errors).reduce((acc: string[], value: any) => {
        if (Array.isArray(value)) {
          return [...acc, ...value.map(String)];
        }

        if (value) {
          return [...acc, String(value)];
        }

        return acc;
      }, []);
    }

    return [];
  }
}
