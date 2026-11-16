import { Routes } from '@angular/router';

export const FINANCEIRO_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'caixa' },
  {
    path: 'caixa',
    loadComponent: () => import('./caixa-page').then((m) => m.CaixaPage),
  },
  {
    path: 'caixas',
    loadComponent: () => import('./caixas-lista-page').then((m) => m.CaixasListaPage),
  },
  {
    path: 'caixas/:id',
    loadComponent: () => import('./caixa-detalhe-page').then((m) => m.CaixaDetalhePage),
  },
];
