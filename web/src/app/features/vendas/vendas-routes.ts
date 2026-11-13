import { Routes } from '@angular/router';

export const VENDAS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./vendas-lista-page').then((m) => m.VendasListaPage),
  },
  {
    path: 'nova',
    loadComponent: () => import('./pdv-page').then((m) => m.PdvPage),
  },
  {
    path: 'detalhe/:id',
    loadComponent: () => import('./venda-detalhe-page').then((m) => m.VendaDetalhePage),
  },
];
