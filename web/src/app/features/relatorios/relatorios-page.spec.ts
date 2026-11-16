import { BreakpointObserver } from '@angular/cdk/layout';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';

import { ConfigStore } from '../../core/config/app-config';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { RelatoriosPage } from './relatorios-page';
import { RELATORIOS_ROUTES } from './relatorios-routes';

const ROTAS = [
  'faturamento',
  'vendas-por-funcionario',
  'caixa',
  'fiado',
  'cascos',
  'sucata',
  'estoque',
  'lucro',
  'conta-funcionarios',
  'vendas-por-periodo',
];

function configurar(permissoes: string[] = ['*']): void {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: StorageService, useValue: new FakeStorage() }],
  });
  TestBed.inject(OperatorStore).select(operadorValido(permissoes));
}

describe('RelatoriosPage', () => {
  it.each([
    [[], false],
    [['relatorios.ver'], false],
    [['estoque.custos'], true],
    [['*'], true],
  ])('card de lucro com %j aparece=%s', (permissoes, aparece) => {
    configurar(permissoes);
    const fixture = TestBed.createComponent(RelatoriosPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(!!el.querySelector('a.card[href="/relatorios/lucro"]')).toBe(aparece);
  });

  it('renderiza um card por relatório com o link da rota filha e sem placeholder', () => {
    configurar();
    const fixture = TestBed.createComponent(RelatoriosPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const links = Array.from(el.querySelectorAll('a.card')).map((a) => a.getAttribute('href'));
    expect(links).toEqual(ROTAS.map((r) => `/relatorios/${r}`));
    expect(el.querySelector('ce-page-placeholder')).toBeNull();
  });

  it('cada um dos 10 cards tem ícone, título e descrição', () => {
    configurar();
    const fixture = TestBed.createComponent(RelatoriosPage);
    fixture.detectChanges();
    const cards = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a.card'));
    expect(cards).toHaveLength(10);
    for (const c of cards) {
      expect(c.querySelector('ce-icon svg')).not.toBeNull();
      expect(c.querySelector('.card__titulo')?.textContent?.trim()).toBeTruthy();
      expect(c.querySelector('.card__descricao')?.textContent?.trim()).toBeTruthy();
    }
    const vendasPorPeriodo = cards.find(
      (c) => c.getAttribute('href') === '/relatorios/vendas-por-periodo',
    )!;
    expect(vendasPorPeriodo.querySelector('.card__titulo')?.textContent).toBe('Vendas por período');
  });

  it.each(ROTAS)('clicar no card "%s" navega para /relatorios/%s', async (rota) => {
    @Component({ template: '' })
    class Dubles {}
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: `relatorios/${rota}`, component: Dubles }]),
        { provide: StorageService, useValue: new FakeStorage() },
      ],
    });
    TestBed.inject(OperatorStore).select(operadorValido(['*']));
    const fixture = TestBed.createComponent(RelatoriosPage);
    fixture.detectChanges();
    const a = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      `a.card[href="/relatorios/${rota}"]`,
    )!;
    a.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(`/relatorios/${rota}`);
  });
});

describe('RelatoriosPage como layout dos relatórios', () => {
  const FATURAMENTO = '/api/vendas/v1/relatorios/faturamento';
  const FIADO = '/api/financeiro/v1/relatorios/fiado';

  async function montar(desktop: boolean) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'relatorios', children: RELATORIOS_ROUTES }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
        { provide: StorageService, useValue: new FakeStorage() },
        {
          provide: BreakpointObserver,
          useValue: { observe: () => of({ matches: desktop, breakpoints: {} }) },
        },
      ],
    });
    TestBed.inject(OperatorStore).select(operadorValido(['*']));
    const http = TestBed.inject(HttpTestingController);
    const harness = await RouterTestingHarness.create();
    const el = harness.fixture.nativeElement as HTMLElement;
    const assentar = async () => {
      for (const r of http.match((q) => q.url === FATURAMENTO)) {
        r.flush({
          totalBruto: 0,
          totalDesconto: 0,
          totalLiquido: 0,
          porProduto: [],
          porDia: [{ dia: '2026-11-10', totalLiquido: 10, recebido: 10, fiadoGerado: 0 }],
          porCategoria: [],
          recebido: 10,
          fiadoGerado: 0,
        });
      }
      for (const r of http.match((q) => q.url === FIADO)) {
        r.flush([]);
      }
      await harness.fixture.whenStable();
      harness.fixture.detectChanges();
    };
    return {
      el,
      router: TestBed.inject(Router),
      ir: async (url: string) => {
        await harness.navigateByUrl(url);
        await assentar();
      },
      assentar,
      cards: () => el.querySelectorAll('a.card'),
      lista: () => Array.from(el.querySelectorAll<HTMLAnchorElement>('nav.lista a')),
      pagina: () => el.querySelector('ce-vendas-por-periodo-page'),
    };
  }

  it('desktop em /relatorios/vendas-por-periodo: lista compacta com 10 links, o ativo com aria-current, e a página ao lado', async () => {
    const { ir, lista, pagina, cards, el } = await montar(true);
    await ir('/relatorios/vendas-por-periodo');
    expect(lista()).toHaveLength(10);
    expect(lista().map((a) => a.getAttribute('href'))).toEqual(
      ROTAS.map((r) => `/relatorios/${r}`),
    );
    for (const a of lista()) {
      expect(a.querySelector('ce-icon')).not.toBeNull();
      expect(a.querySelector('.card__descricao')).toBeNull();
    }
    const ativos = lista().filter((a) => a.getAttribute('aria-current') === 'page');
    expect(ativos.map((a) => a.textContent?.trim())).toEqual(['Vendas por período']);
    expect(pagina()).not.toBeNull();
    expect(cards()).toHaveLength(0);
    // 2 colunas: o contêiner tem exatamente a lista e o wrapper do relatório (o outlet insere a página como irmão).
    const grade = el.querySelector('.layout--lado')!;
    expect(grade).not.toBeNull();
    expect(Array.from(grade.children).map((c) => c.tagName + '.' + c.className)).toEqual([
      'NAV.lista',
      'DIV.relatorio',
    ]);
    expect(grade.querySelector(':scope > .relatorio > ce-vendas-por-periodo-page')).not.toBeNull();
  });

  it('celular na mesma URL: só a página, sem cards nem lista', async () => {
    const { ir, lista, pagina, cards, el } = await montar(false);
    await ir('/relatorios/vendas-por-periodo');
    expect(pagina()).not.toBeNull();
    expect(cards()).toHaveLength(0);
    expect(lista()).toHaveLength(0);
    expect(el.querySelector('.layout--lado')).toBeNull();
  });

  it.each([true, false])(
    '/relatorios com desktop=%s: 10 cards e nenhum relatório',
    async (desktop) => {
      const { ir, lista, pagina, cards, el } = await montar(desktop);
      await ir('/relatorios');
      expect(cards()).toHaveLength(10);
      expect(lista()).toHaveLength(0);
      expect(pagina()).toBeNull();
      expect(el.querySelector('.layout--lado')).toBeNull();
    },
  );

  it('gesto no desktop: clicar em "Fiado" na lista vai para /relatorios/fiado e move o aria-current', async () => {
    const { ir, lista, assentar, router, pagina } = await montar(true);
    await ir('/relatorios/vendas-por-periodo');
    lista()
      .find((a) => a.textContent?.includes('Fiado'))!
      .click();
    await assentar();
    expect(router.url).toBe('/relatorios/fiado');
    const ativos = lista().filter((a) => a.getAttribute('aria-current') === 'page');
    expect(ativos.map((a) => a.textContent?.trim())).toEqual(['Fiado']);
    expect(pagina()).toBeNull();
    expect(lista()).toHaveLength(10);
  });

  it('gesto no celular: clicar no card abre só o relatório e o voltar retorna aos cards', async () => {
    const { ir, cards, assentar, router, lista, el } = await montar(false);
    await ir('/relatorios');
    Array.from(cards())
      .find((a) => a.textContent?.includes('Fiado'))!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await assentar();
    expect(router.url).toBe('/relatorios/fiado');
    expect(el.querySelector('ce-fiado-page')).not.toBeNull();
    expect(cards()).toHaveLength(0);
    expect(lista()).toHaveLength(0);

    el.querySelector<HTMLButtonElement>('button[aria-label="Voltar"]')!.click();
    await assentar();
    expect(router.url).toBe('/relatorios');
    expect(cards()).toHaveLength(10);
    expect(el.querySelector('ce-fiado-page')).toBeNull();
  });
});
