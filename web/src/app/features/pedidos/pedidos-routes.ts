import { Routes } from '@angular/router';

import { permissaoGuard } from '../../core/permissions/permissao-guard';

export const PEDIDOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pedidos-lista-page').then((m) => m.PedidosListaPage),
  },
  {
    path: 'novo',
    canActivate: [permissaoGuard('vendas.registrar')],
    loadComponent: () => import('./pedido-novo-page').then((m) => m.PedidoNovoPage),
  },
  {
    path: ':id/conclusao',
    canActivate: [permissaoGuard('vendas.registrar')],
    loadComponent: () => import('./pedido-conclusao-page').then((m) => m.PedidoConclusaoPage),
  },
  {
    path: ':id',
    loadComponent: () => import('./pedido-detalhe-page').then((m) => m.PedidoDetalhePage),
  },
];
