import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';

import { PERMISSOES } from '../../core/permissions/permissoes';
import { rodarGuardDaRota } from '../../core/permissions/testing';
import { RELATORIOS_ROUTES } from './relatorios-routes';

// O hub é a rota pai ('') e os 10 relatórios são os filhos dela.
const PAI = RELATORIOS_ROUTES[0];
const TODAS = [PAI, ...(PAI.children ?? [])];

const GUARDADAS: Record<string, string> = {
  '': 'relatorios.ver',
  faturamento: 'relatorios.ver',
  'vendas-por-funcionario': 'relatorios.ver',
  caixa: 'relatorios.ver',
  fiado: 'relatorios.ver',
  cascos: 'relatorios.ver',
  sucata: 'relatorios.ver',
  estoque: 'relatorios.ver',
  lucro: 'estoque.custos',
  'conta-funcionarios': 'relatorios.ver',
  'vendas-por-periodo': 'relatorios.ver',
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
  lucro: 'LucroRelatorioPage',
  'conta-funcionarios': 'ContaFuncionariosPage',
  'vendas-por-periodo': 'VendasPorPeriodoPage',
};

describe('RELATORIOS_ROUTES', () => {
  it('o hub é a única rota de topo e tem os 10 relatórios como filhos', () => {
    expect(RELATORIOS_ROUTES).toHaveLength(1);
    expect(PAI.path).toBe('');
    expect(PAI.children?.map((r) => r.path)).toEqual(
      Object.keys(GUARDADAS).filter((p) => p !== ''),
    );
  });

  it.each(Object.entries(GUARDADAS))('rota "%s" exige %s', (path, chave) => {
    const rota = TODAS.find((r) => r.path === path)!;
    expect(rota.canActivate).toHaveLength(1);
    const negado = rodarGuardDaRota(rota, []);
    expect(negado).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(negado as UrlTree)).toBe('/');
    expect(rodarGuardDaRota(rota, ['*'])).toBe(true);
    expect(rodarGuardDaRota(rota, [chave])).toBe(true);
    expect(PERMISSOES.map((p) => p.chave)).toContain(chave);
  });

  it.each(Object.entries(COMPONENTES))('rota "%s" carrega %s', async (path, nome) => {
    const rota = TODAS.find((r) => r.path === path)!;
    const componente = await (rota.loadComponent as () => Promise<{ name: string }>)();
    expect(componente.name).toContain(nome);
  });

  it('rotas de consulta continuam sem guard', () => {
    for (const r of TODAS.filter((r) => !((r.path ?? '') in GUARDADAS) && !r.redirectTo)) {
      expect(r.canActivate).toBeUndefined();
    }
  });
});
