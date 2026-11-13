import { Routes } from '@angular/router';

import { permissaoGuard } from '../../core/permissions/permissao-guard';

export const RELATORIOS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [permissaoGuard('relatorios.ver')],
    loadComponent: () => import('./relatorios-page').then((m) => m.RelatoriosPage),
  },
  {
    path: 'faturamento',
    canActivate: [permissaoGuard('relatorios.ver')],
    loadComponent: () => import('./faturamento-page').then((m) => m.FaturamentoPage),
  },
  {
    path: 'vendas-por-funcionario',
    canActivate: [permissaoGuard('relatorios.ver')],
    loadComponent: () =>
      import('./vendas-por-funcionario-page').then((m) => m.VendasPorFuncionarioPage),
  },
  {
    path: 'caixa',
    canActivate: [permissaoGuard('relatorios.ver')],
    loadComponent: () => import('./caixa-relatorio-page').then((m) => m.CaixaRelatorioPage),
  },
  {
    path: 'fiado',
    canActivate: [permissaoGuard('relatorios.ver')],
    loadComponent: () => import('./fiado-page').then((m) => m.FiadoPage),
  },
  {
    path: 'cascos',
    canActivate: [permissaoGuard('relatorios.ver')],
    loadComponent: () => import('./cascos-page').then((m) => m.CascosPage),
  },
  {
    path: 'sucata',
    canActivate: [permissaoGuard('relatorios.ver')],
    loadComponent: () => import('./sucata-page').then((m) => m.SucataPage),
  },
  {
    path: 'estoque',
    canActivate: [permissaoGuard('relatorios.ver')],
    loadComponent: () => import('./estoque-relatorio-page').then((m) => m.EstoqueRelatorioPage),
  },
  {
    path: 'conta-funcionarios',
    canActivate: [permissaoGuard('relatorios.ver')],
    loadComponent: () => import('./conta-funcionarios-page').then((m) => m.ContaFuncionariosPage),
  },
];
