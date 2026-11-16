import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { lerPadraoPagina } from '../../ui/organisms/padrao-pagina.testing';
import { RhPage } from './rh-page';
import { assentar, configurar } from './testing';

const FUNCIONARIOS = '/api/rh/v1/funcionarios';
const CARGOS = '/api/rh/v1/cargos';
const ANA = {
  id: 'f1',
  nome: 'Ana',
  telefone: null,
  cargoId: 'c1',
  cargo: 'Caixa',
  valorDiaria: 100,
  ativo: true,
};
const CAIXA = { id: 'c1', nome: 'Caixa', nativo: false, permissoes: [] };

async function montar(permissoes: string[], desktop = false) {
  configurar(permissoes, desktop);
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(RhPage);
  fixture.detectChanges();
  await assentar(fixture);
  const el = fixture.nativeElement as HTMLElement;
  const aba = (texto: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('[aria-label="Seção"] button')).find((b) =>
      b.textContent?.includes(texto),
    )!;
  return { fixture, http, el, aba };
}

describe('RhPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sem rh.gerir: Sem acesso, sem abas, links nem botões de ação', async () => {
    const t = await montar([]);
    expect(t.el.querySelector('ce-empty-state')!.textContent).toContain('Sem acesso');
    expect(t.el.textContent).toContain('Seu cargo não tem a permissão rh.gerir. Peça ao ADM.');
    expect(t.el.querySelector('[aria-label="Seção"]')).toBeNull();
    expect(t.el.querySelector('a')).toBeNull();
    expect(t.el.querySelector('ce-barra-acao')).toBeNull();
    expect(t.el.querySelector('ce-funcionarios-page, ce-cargos-page')).toBeNull();
    expect(lerPadraoPagina(t.el).voltar).toBe(true);
  });

  it('com rh.gerir: começa em Funcionários e o clique em Cargos troca aba e conteúdo', async () => {
    const t = await montar(['rh.gerir']);
    t.http.expectOne(FUNCIONARIOS).flush([ANA]);
    await assentar(t.fixture);
    expect(t.el.querySelector('ce-app-header h1')!.textContent).toContain('Funcionários e cargos');
    expect(t.el.querySelector('ce-app-header')!.classList).toContain('app-header--onda');
    expect(t.aba('Funcionários').getAttribute('aria-pressed')).toBe('true');
    expect(t.aba('Cargos').getAttribute('aria-pressed')).toBe('false');
    expect(t.el.querySelector('ce-funcionarios-page')!.textContent).toContain('Ana');

    t.aba('Cargos').click();
    await assentar(t.fixture);
    t.http.expectOne(CARGOS).flush([CAIXA]);
    await assentar(t.fixture);
    expect(t.aba('Funcionários').getAttribute('aria-pressed')).toBe('false');
    expect(t.aba('Cargos').getAttribute('aria-pressed')).toBe('true');
    expect(t.el.querySelector('ce-funcionarios-page')).toBeNull();
    expect(t.el.querySelector('ce-cargos-page')!.textContent).toContain('Caixa');
    expect(t.el.querySelector('ce-cargos-page ce-app-header')!.textContent).toContain('+ Novo');
    expect(t.el.querySelector('ce-barra-acao')).toBeNull();
  });

  it('celular: cabeçalho da página com voltar e sem ação; as listas embutidas usam a seção', async () => {
    const t = await montar(['rh.gerir']);
    t.http.expectOne(FUNCIONARIOS).flush([ANA]);
    await assentar(t.fixture);
    const [pagina, secao] = Array.from(t.el.querySelectorAll<HTMLElement>('ce-app-header'));
    expect(lerPadraoPagina(t.el, pagina)).toMatchObject({ voltar: true, acoes: [], barras: 0 });
    expect(secao.closest('ce-funcionarios-page')).not.toBeNull();
    expect(secao.querySelector('h2')!.textContent).toContain('Funcionários');
    expect(secao.querySelector('.topo--onda')).toBeNull();
    expect(lerPadraoPagina(t.el, secao).acoes).toEqual(['+ Novo']);
  });

  it('desktop: ce-app-header com voltar no lugar do h1 da grade e detalhe pedindo um funcionário', async () => {
    const t = await montar(['rh.gerir'], true);
    t.http.expectOne(FUNCIONARIOS).flush([ANA]);
    await assentar(t.fixture);
    expect(t.el.querySelector('ce-rh-grade')).not.toBeNull();
    expect(t.el.querySelector('ce-rh-grade h1')).toBeNull();
    const pagina = t.el.querySelector<HTMLElement>('ce-app-header')!;
    expect(pagina.closest('ce-rh-grade')).toBeNull();
    expect(pagina.querySelector('h1')!.textContent).toContain('Funcionários e cargos');
    expect(lerPadraoPagina(t.el, pagina)).toMatchObject({ voltar: true, acoes: [], barras: 0 });
    expect(t.el.querySelector('.mestre ce-funcionarios-page')!.textContent).toContain('Ana');
    expect(t.el.querySelector('.mestre ce-funcionarios-page ce-app-header h2')).not.toBeNull();
    expect(t.el.querySelector('ce-barra-acao')).toBeNull();
    expect(t.el.querySelector('.detalhe ce-empty-state')!.textContent).toContain(
      'Escolha um funcionário na lista',
    );

    t.aba('Cargos').click();
    await assentar(t.fixture);
    t.http.expectOne(CARGOS).flush([CAIXA]);
    await assentar(t.fixture);
    expect(t.el.querySelector('.mestre ce-funcionarios-page')).toBeNull();
    expect(t.el.querySelector('.detalhe ce-cargos-page')!.textContent).toContain('Caixa');
  });
});
