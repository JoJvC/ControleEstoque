import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { periodoPadrao } from './periodo';
import { VendasPorPeriodoPage } from './vendas-por-periodo-page';

const FATURAMENTO = '/api/vendas/v1/relatorios/faturamento';
const PADRAO = periodoPadrao();

const RELATORIO = {
  totalBruto: 300,
  totalDesconto: 0,
  totalLiquido: 300,
  porProduto: [],
  porDia: [
    { dia: '2026-11-10', totalLiquido: 190, recebido: 150, fiadoGerado: 40 },
    { dia: '2026-11-11', totalLiquido: 0, recebido: 0, fiadoGerado: 0 },
    { dia: '2026-11-12', totalLiquido: 20.5, recebido: 20.5, fiadoGerado: 0 },
  ],
  porCategoria: [],
  recebido: 170.5,
  fiadoGerado: 40,
};

const normalizar = (s: string | null | undefined) =>
  (s ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();

async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
  fixture.detectChanges();
}

const consulta = (http: HttpTestingController) => http.expectOne((r) => r.url === FATURAMENTO);

async function montar(resposta: object = RELATORIO) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(VendasPorPeriodoPage);
  fixture.detectChanges();
  const req = consulta(http);
  if (resposta instanceof Error) {
    req.flush({ title: 'falhou' }, { status: 500, statusText: 'Erro' });
  } else {
    req.flush(resposta);
  }
  await assentar(fixture);
  const el = fixture.nativeElement as HTMLElement;
  const barras = () => Array.from(el.querySelectorAll<SVGGElement>('g[role="listitem"]'));
  return {
    fixture,
    http,
    el,
    navegar,
    barras,
    painel: () => normalizar(el.querySelector('[aria-live="polite"]')?.textContent),
    texto: () => normalizar(el.textContent),
    buscar: () =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Buscar'))!,
    tecla: async (alvo: Element, key: string) => {
      alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      await assentar(fixture);
    },
    data: async (rotulo: 'De' | 'Até', valor: string) => {
      const campo = Array.from(el.querySelectorAll('ce-form-field'))
        .find((f) => f.textContent?.includes(rotulo))!
        .querySelector('input') as HTMLInputElement;
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
      await assentar(fixture);
    },
  };
}

describe('VendasPorPeriodoPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('ao abrir busca o período padrão e, ao mudar o filtro, busca de novo', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(VendasPorPeriodoPage);
    fixture.detectChanges();
    const req = consulta(http);
    expect(req.request.params.get('inicio')).toBe(PADRAO.inicio);
    expect(req.request.params.get('fim')).toBe(PADRAO.fim);
    expect(req.request.params.has('produtoId')).toBe(false);
    req.flush(RELATORIO);
    await assentar(fixture);

    const el = fixture.nativeElement as HTMLElement;
    const campo = Array.from(el.querySelectorAll('ce-form-field'))
      .find((f) => f.textContent?.includes('De'))!
      .querySelector('input') as HTMLInputElement;
    campo.value = '2026-10-01';
    campo.dispatchEvent(new Event('input'));
    await assentar(fixture);
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Buscar'))!
      .click();
    expect(consulta(http).request.params.get('inicio')).toBe('2026-10-01');
  });

  it('mostra os totais do período, uma barra por dia com rótulo, legenda e o padrão do fiado', async () => {
    const { el, barras } = await montar();
    expect(
      Array.from(el.querySelectorAll('.total')).map(
        (t) =>
          `${normalizar(t.querySelector('dt')?.textContent)} ${normalizar(t.querySelector('dd')?.textContent)}`,
      ),
    ).toEqual(['Recebido R$ 170,50', 'Fiado gerado R$ 40,00']);
    expect(el.querySelector('ce-page-placeholder')).toBeNull();

    expect(barras().map((b) => normalizar(b.getAttribute('aria-label')))).toEqual([
      '10/11: recebido R$ 150,00; fiado gerado R$ 40,00; total R$ 190,00',
      '11/11: recebido R$ 0,00; fiado gerado R$ 0,00; total R$ 0,00',
      '12/11: recebido R$ 20,50; fiado gerado R$ 0,00; total R$ 20,50',
    ]);
    const svg = el.querySelector('svg[role="group"]')!;
    expect(svg.querySelector('title')?.textContent).toContain('Vendas por dia');
    expect(normalizar(svg.querySelector('desc')?.textContent)).toBe(
      '3 dias. Recebido R$ 170,50, fiado gerado R$ 40,00.',
    );
    expect(svg.querySelector('pattern#ce-listras-fiado')).not.toBeNull();

    const legenda = normalizar(el.querySelector('.legenda')?.textContent);
    expect(legenda).toContain('Recebido');
    expect(legenda).toContain('Fiado gerado');
    expect(el.querySelectorAll('.legenda svg')).toHaveLength(2);
  });

  it('só a barra ativa entra na ordem de tabulação (roving tabindex)', async () => {
    const { barras } = await montar();
    expect(barras().map((b) => b.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
  });

  it('tabela alternativa com caption, cabeçalhos e uma linha por dia', async () => {
    const { el } = await montar();
    const tabela = el.querySelector('table')!;
    expect(normalizar(tabela.querySelector('caption')?.textContent)).toBe(
      'Recebido e fiado gerado por dia',
    );
    expect(
      Array.from(tabela.querySelectorAll('thead th')).map((th) => [
        normalizar(th.textContent),
        th.getAttribute('scope'),
      ]),
    ).toEqual([
      ['Dia', 'col'],
      ['Recebido', 'col'],
      ['Fiado gerado', 'col'],
      ['Total', 'col'],
    ]);
    const linhas = Array.from(tabela.querySelectorAll('tbody tr')).map((tr) =>
      Array.from(tr.children).map((c) => normalizar(c.textContent)),
    );
    expect(linhas).toEqual([
      ['10/11/2026', 'R$ 150,00', 'R$ 40,00', 'R$ 190,00'],
      ['11/11/2026', 'R$ 0,00', 'R$ 0,00', 'R$ 0,00'],
      ['12/11/2026', 'R$ 20,50', 'R$ 0,00', 'R$ 20,50'],
    ]);
    expect(tabela.querySelector('tbody th')?.getAttribute('scope')).toBe('row');
  });

  it('série vazia: estado vazio, sem gráfico', async () => {
    const { el, texto } = await montar({ ...RELATORIO, porDia: [], recebido: 0, fiadoGerado: 0 });
    expect(texto()).toContain('Nenhuma venda no período');
    expect(el.querySelector('svg[role="group"]')).toBeNull();
    expect(el.querySelector('table')).toBeNull();
  });

  it('erro do servidor: mensagem e Tentar de novo refaz a consulta', async () => {
    const { el, texto, http, fixture } = await montar(new Error('x'));
    expect(texto()).toContain('Não foi possível carregar o relatório');
    expect(el.querySelector('svg[role="group"]')).toBeNull();
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Tentar de novo'))!
      .click();
    consulta(http).flush(RELATORIO);
    await assentar(fixture);
    expect(el.querySelector('svg[role="group"]')).not.toBeNull();
  });

  it('gesto: setas, Home e End movem o foco entre as barras e atualizam o painel aria-live', async () => {
    const { barras, painel, tecla } = await montar();
    barras()[0].focus();
    expect(document.activeElement).toBe(barras()[0]);
    expect(painel()).toContain('10/11');

    await tecla(barras()[0], 'ArrowRight');
    expect(document.activeElement).toBe(barras()[1]);
    expect(painel()).toContain('11/11');
    expect(barras().map((b) => b.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);

    await tecla(barras()[1], 'End');
    expect(document.activeElement).toBe(barras()[2]);
    expect(painel()).toContain('12/11');

    await tecla(barras()[2], 'ArrowRight');
    expect(document.activeElement).toBe(barras()[2]);

    await tecla(barras()[2], 'ArrowLeft');
    expect(document.activeElement).toBe(barras()[1]);
    expect(painel()).toContain('11/11');

    await tecla(barras()[1], 'Home');
    expect(document.activeElement).toBe(barras()[0]);
    expect(painel()).toContain('10/11');
  });

  it('gesto: tecla fora das setas não move o foco nem o painel', async () => {
    const { barras, painel, tecla } = await montar();
    barras()[0].focus();
    await tecla(barras()[0], 'a');
    expect(document.activeElement).toBe(barras()[0]);
    expect(painel()).toContain('10/11');
  });

  it('gesto: clicar numa barra atualiza o painel', async () => {
    const { barras, painel, fixture } = await montar();
    barras()[2].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await assentar(fixture);
    expect(painel()).toContain('12/11');
    expect(barras()[2].getAttribute('tabindex')).toBe('0');
  });

  it('o botão voltar navega para /relatorios', async () => {
    const { el, navegar } = await montar();
    el.querySelector<HTMLButtonElement>('button[aria-label="Voltar"]')!.click();
    expect(navegar).toHaveBeenCalledWith('/relatorios');
  });
});
