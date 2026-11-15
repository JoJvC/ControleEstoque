import { Routes, UrlSegment, UrlMatchResult } from '@angular/router';

import { permissaoGuard } from '../../core/permissions/permissao-guard';

/**
 * '' e ':id' numa rota só: o mestre-detalhe do desktop troca de cliente sem recriar a página
 * (duas rotas reiniciariam a lista e a rolagem a cada clique). `novo` vem antes e tem prioridade.
 */
function listaOuDetalhe(segmentos: UrlSegment[]): UrlMatchResult | null {
  if (segmentos.length > 1) {
    return null;
  }
  return { consumed: segmentos, posParams: segmentos[0] ? { id: segmentos[0] } : undefined };
}

export const CLIENTES_ROUTES: Routes = [
  {
    path: 'novo',
    canActivate: [permissaoGuard('clientes.cadastrar')],
    loadComponent: () => import('./cliente-form-page').then((m) => m.ClienteFormPage),
  },
  {
    matcher: listaOuDetalhe,
    loadComponent: () => import('./clientes-page').then((m) => m.ClientesPage),
  },
  {
    path: ':id/editar',
    canActivate: [permissaoGuard('clientes.cadastrar')],
    loadComponent: () => import('./cliente-form-page').then((m) => m.ClienteFormPage),
  },
];
