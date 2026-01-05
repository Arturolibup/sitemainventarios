/// <reference types="@angular/localize" />

import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

// 🧹 Eliminador automático de overlays bloqueantes (Metronic splash)
window.addEventListener('DOMContentLoaded', () => {
  const overlays = [
    'splash-screen',
    'kt_splash_screen',
    'kt_page_loading',
    'page-loader'
  ];

  overlays.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.remove();
      console.log('🧹 Overlay eliminado:', id);
    }
  });

  // Limpia SVGs invisibles que bloquean clics
  const svgs = document.querySelectorAll('svg[style*="position: absolute"]');
  svgs.forEach((svg: any) => {
    if (svg.style.opacity === '0' || svg.style.top === '-100%') {
      svg.remove();
      console.log('🧹 SVG overlay eliminado');
    }
  });

  // Asegura que el body sea visible e interactivo
  document.body.style.opacity = '1';
  document.body.style.pointerEvents = 'auto';
  document.body.style.visibility = 'visible';
});

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err) => console.error(err));