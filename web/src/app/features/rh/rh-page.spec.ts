import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

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
    expect(t.el.querySelector('ce-barra-acao')!.textContent).toContain('Novo cargo');
  });

  it('desktop: grade mestre-detalhe sem ce-app-header e detalhe pedindo um funcionário', async () => {
    const t = await montar(['rh.gerir'], true);
    t.http.expectOne(FUNCIONARIOS).flush([ANA]);
    await assentar(t.fixture);
    expect(t.el.querySelector('ce-rh-grade')).not.toBeNull();
    expect(t.el.querySelector('ce-app-header')).toBeNull();
    expect(t.el.querySelector('ce-rh-grade h1')!.textContent).toContain('Funcionários e cargos');
    expect(t.el.querySelector('.mestre ce-funcionarios-page')!.textContent).toContain('Ana');
    // a barra 'Novo funcionário' fica só na coluna do mestre (CSS encurta quando tem na-grade)
    expect(t.el.querySelector('.mestre ce-barra-acao')!.classList).toContain('na-grade');
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
