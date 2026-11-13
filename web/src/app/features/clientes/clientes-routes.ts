import { Routes } from '@angular/router';

import { permissaoGuard } from '../../core/permissions/permissao-guard';

export const CLIENTES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./clientes-page').then((m) => m.ClientesPage),
  },
  {
    path: 'novo',
    canActivate: [permissaoGuard('clientes.cadastrar')],
    loadComponent: () => import('./cliente-form-page').then((m) => m.ClienteFormPage),
  },
  {
    path: ':id',
    loadComponent: () => import('./cliente-detalhe-page').then((m) => m.ClienteDetalhePage),
  },
  {
    path: ':id/editar',
    canActivate: [permissaoGuard('clientes.cadastrar')],
    loadComponent: () => import('./cliente-form-page').then((m) => m.ClienteFormPage),
  },
];
