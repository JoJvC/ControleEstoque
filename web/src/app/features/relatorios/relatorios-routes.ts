import { Routes } from '@angular/router';

import { permissaoGuard } from '../../core/permissions/permissao-guard';

export const RELATORIOS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [permissaoGuard('relatorios.ver')],
    loadComponent: () => import('./relatorios-page').then((m) => m.RelatoriosPage),
  },
];
