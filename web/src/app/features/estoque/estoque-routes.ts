import { Routes } from '@angular/router';

import { permissaoGuard } from '../../core/permissions/permissao-guard';

export const ESTOQUE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./estoque-page').then((m) => m.EstoquePage),
  },
  {
    path: 'abastecimento',
    canActivate: [permissaoGuard('estoque.editar')],
    loadComponent: () => import('./abastecimento-page').then((m) => m.AbastecimentoPage),
  },
];
