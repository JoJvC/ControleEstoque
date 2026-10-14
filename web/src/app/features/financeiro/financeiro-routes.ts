import { Routes } from '@angular/router';

export const FINANCEIRO_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'caixa' },
  {
    path: 'caixa',
    loadComponent: () => import('./caixa-page').then((m) => m.CaixaPage),
  },
];
