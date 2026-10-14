import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localePt from '@angular/common/locales/pt';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { provideAppConfig } from './core/config/app-config';
import { apiErrorInterceptor } from './core/http/api-error-interceptor';
import { correlationIdInterceptor } from './core/http/correlation-id-interceptor';
import { provideStorage } from './core/platform/storage-service';
import { provideMedia } from './core/platform/web-media-service';
import { providePrint } from './core/platform/web-print-service';

registerLocaleData(localePt);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([correlationIdInterceptor, apiErrorInterceptor])),
    provideAppConfig(),
    provideStorage(),
    provideMedia(),
    providePrint(),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
  ],
};
