import { Routes } from '@angular/router';

export const PRODUTOS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./produtos-lista-page').then((m) => m.ProdutosListaPage),
  },
  {
    path: 'novo',
    loadComponent: () => import('./produto-form-page').then((m) => m.ProdutoFormPage),
  },
  {
    path: ':id/editar',
    loadComponent: () => import('./produto-form-page').then((m) => m.ProdutoFormPage),
  },
];
