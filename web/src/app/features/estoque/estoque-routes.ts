import { Routes } from '@angular/router';

export const ESTOQUE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./estoque-page').then((m) => m.EstoquePage),
  },
  {
    path: 'abastecimento',
    loadComponent: () => import('./abastecimento-page').then((m) => m.AbastecimentoPage),
  },
];
