import { Routes } from '@angular/router';

import { permissaoGuard } from '../../core/permissions/permissao-guard';

export const RH_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./rh-page').then((m) => m.RhPage),
  },
  {
    path: 'cargos',
    canActivate: [permissaoGuard('rh.gerir')],
    loadComponent: () => import('./cargos-page').then((m) => m.CargosPage),
  },
];
