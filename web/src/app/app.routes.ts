import { isDevMode } from '@angular/core';
import { Routes } from '@angular/router';

import { operatorGuard } from './core/operator/operator-guard';
import { ShellLayout } from './layouts/shell-layout/shell-layout';

const DEV_ROUTES: Routes = isDevMode()
  ? [
      {
        path: 'dev/ui',
        loadComponent: () =>
          import('./features/dev/ui-showcase-page').then((m) => m.UiShowcasePage),
      },
    ]
  : [];

export const routes: Routes = [
  ...DEV_ROUTES,
  {
    path: 'operador',
    loadComponent: () =>
      import('./features/operador/select-operator-page').then((m) => m.SelectOperatorPage),
  },
  {
    path: '',
    component: ShellLayout,
    canActivate: [operatorGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
      },
      {
        path: 'vendas',
        loadChildren: () => import('./features/vendas/vendas-routes').then((m) => m.VENDAS_ROUTES),
      },
      {
        path: 'clientes',
        loadChildren: () =>
          import('./features/clientes/clientes-routes').then((m) => m.CLIENTES_ROUTES),
      },
      {
        path: 'estoque',
        loadChildren: () =>
          import('./features/estoque/estoque-routes').then((m) => m.ESTOQUE_ROUTES),
      },
      {
        path: 'produtos',
        loadChildren: () =>
          import('./features/produtos/produtos-routes').then((m) => m.PRODUTOS_ROUTES),
      },
      {
        path: 'marcas',
        loadComponent: () => import('./features/produtos/marcas-page').then((m) => m.MarcasPage),
      },
      {
        path: 'financeiro',
        loadChildren: () =>
          import('./features/financeiro/financeiro-routes').then((m) => m.FINANCEIRO_ROUTES),
      },
      {
        path: 'rh',
        loadChildren: () => import('./features/rh/rh-routes').then((m) => m.RH_ROUTES),
      },
      {
        path: 'relatorios',
        loadChildren: () =>
          import('./features/relatorios/relatorios-routes').then((m) => m.RELATORIOS_ROUTES),
      },
      {
        path: 'mais',
        loadComponent: () => import('./features/mais/mais-page').then((m) => m.MaisPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
