import { Routes } from '@angular/router';

import { permissaoGuard } from '../../core/permissions/permissao-guard';

export const VENDAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./vendas-lista-page').then((m) => m.VendasListaPage),
  },
  {
    path: 'nova',
    canActivate: [permissaoGuard('vendas.registrar')],
    loadComponent: () => import('./pdv-page').then((m) => m.PdvPage),
  },
  {
    path: 'editar/:id',
    canActivate: [permissaoGuard('vendas.editar')],
    loadComponent: () => import('./pdv-page').then((m) => m.PdvPage),
  },
  {
    path: 'detalhe/:id',
    loadComponent: () => import('./venda-detalhe-page').then((m) => m.VendaDetalhePage),
  },
];
