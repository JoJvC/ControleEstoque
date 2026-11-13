import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';

import { PERMISSOES } from '../../core/permissions/permissoes';
import { rodarGuardDaRota } from '../../core/permissions/testing';
import { RELATORIOS_ROUTES } from './relatorios-routes';

const GUARDADAS: Record<string, string> = {
  '': 'relatorios.ver',
  faturamento: 'relatorios.ver',
  'vendas-por-funcionario': 'relatorios.ver',
  caixa: 'relatorios.ver',
  fiado: 'relatorios.ver',
  cascos: 'relatorios.ver',
  sucata: 'relatorios.ver',
  estoque: 'relatorios.ver',
  'conta-funcionarios': 'relatorios.ver',
};

const COMPONENTES: Record<string, string> = {
  '': 'RelatoriosPage',
  faturamento: 'FaturamentoPage',
  'vendas-por-funcionario': 'VendasPorFuncionarioPage',
  caixa: 'CaixaRelatorioPage',
  fiado: 'FiadoPage',
  cascos: 'CascosPage',
  sucata: 'SucataPage',
  estoque: 'EstoqueRelatorioPage',
  'conta-funcionarios': 'ContaFuncionariosPage',
};

describe('RELATORIOS_ROUTES', () => {
  it.each(Object.entries(GUARDADAS))('rota "%s" exige %s', (path, chave) => {
    const rota = RELATORIOS_ROUTES.find((r) => r.path === path)!;
    expect(rota.canActivate).toHaveLength(1);
    const negado = rodarGuardDaRota(rota, []);
    expect(negado).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(negado as UrlTree)).toBe('/');
    expect(rodarGuardDaRota(rota, ['*'])).toBe(true);
    expect(rodarGuardDaRota(rota, [chave])).toBe(true);
    expect(PERMISSOES.map((p) => p.chave)).toContain(chave);
  });

  it.each(Object.entries(COMPONENTES))('rota "%s" carrega %s', async (path, nome) => {
    const rota = RELATORIOS_ROUTES.find((r) => r.path === path)!;
    const componente = await (rota.loadComponent as () => Promise<{ name: string }>)();
    expect(componente.name).toContain(nome);
  });

  it('rotas de consulta continuam sem guard', () => {
    for (const r of RELATORIOS_ROUTES.filter(
      (r) => !((r.path ?? '') in GUARDADAS) && !r.redirectTo,
    )) {
      expect(r.canActivate).toBeUndefined();
    }
  });
});
