import { Routes } from '@angular/router';

export const CLIENTES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./clientes-page').then((m) => m.ClientesPage),
  },
  {
    path: 'novo',
    loadComponent: () => import('./cliente-form-page').then((m) => m.ClienteFormPage),
  },
  {
    path: ':id',
    loadComponent: () => import('./cliente-detalhe-page').then((m) => m.ClienteDetalhePage),
  },
  {
    path: ':id/editar',
    loadComponent: () => import('./cliente-form-page').then((m) => m.ClienteFormPage),
  },
];
