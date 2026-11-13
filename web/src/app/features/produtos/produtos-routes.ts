import { Routes } from '@angular/router';

import { permissaoGuard } from '../../core/permissions/permissao-guard';

export const PRODUTOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./produtos-lista-page').then((m) => m.ProdutosListaPage),
  },
  {
    path: 'novo',
    canActivate: [permissaoGuard('estoque.editar')],
    loadComponent: () => import('./produto-form-page').then((m) => m.ProdutoFormPage),
  },
  {
    path: ':id/editar',
    canActivate: [permissaoGuard('estoque.editar')],
    loadComponent: () => import('./produto-form-page').then((m) => m.ProdutoFormPage),
  },
];
