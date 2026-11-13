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
  {
    path: 'funcionarios',
    canActivate: [permissaoGuard('rh.gerir')],
    loadComponent: () => import('./funcionarios-page').then((m) => m.FuncionariosPage),
  },
  {
    path: 'funcionarios/:id',
    canActivate: [permissaoGuard('rh.gerir')],
    loadComponent: () => import('./funcionario-page').then((m) => m.FuncionarioPage),
  },
];
