import { Routes } from '@angular/router';

export const RELATORIOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./relatorios-page').then((m) => m.RelatoriosPage),
  },
];
