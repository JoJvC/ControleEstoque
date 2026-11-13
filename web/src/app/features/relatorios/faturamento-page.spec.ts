import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { FaturamentoPage } from './faturamento-page';
import { periodoPadrao } from './periodo';

const FATURAMENTO = '/api/vendas/v1/relatorios/faturamento';
const PRODUTOS = '/api/estoque/v1/produtos';
const PADRAO = periodoPadrao();

// valores propositalmente incoerentes entre si: a tela não pode recalcular nada
const RELATORIO = {
  totalBruto: 1234.5,
  totalDesconto: 34.5,
  totalLiquido: 7777,
  porProduto: [
    { produtoId: 'p1', nome: 'Água 20L', quantidade: 7, totalLiquido: 555.55 },
    { produtoId: 'p2', nome: 'Galão cheio', quantidade: 2, totalLiquido: 99.9 },
  ],
  porDia: [{ dia: '2026-11-02', totalLiquido: 321.1 }],
};

async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
}

const consulta = (http: HttpTestingController) => http.expectOne((r) => r.url === FATURAMENTO);

async function montar() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(FaturamentoPage);
  fixture.detectChanges();
  await assentar(fixture);
  http.expectOne(PRODUTOS).flush([
    { id: 'p1', nome: 'Água 20L' },
    { id: 'p2', nome: 'Galão cheio' },
  ]);
  consulta(http).flush(RELATORIO);
  await assentar(fixture);
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    http,
    el,
    texto: () => (el.textContent ?? '').replace(/\s+/g, ' '),
    buscar: () =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Buscar'))!,
    data: async (rotulo: 'De' | 'Até', valor: string) => {
      const campo = Array.from(el.querySelectorAll('ce-form-field'))
        .find((f) => f.textContent?.includes(rotulo))!
        .querySelector('input') as HTMLInputElement;
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
      await assentar(fixture);
    },
    produto: async (valor: string) => {
      const select = el.querySelector('ce-select select') as HTMLSelectElement;
      select.value = valor;
      select.dispatchEvent(new Event('change'));
      await assentar(fixture);
    },
  };
}

describe('FaturamentoPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('ao abrir busca o período padrão sem produtoId', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    TestBed.createComponent(FaturamentoPage).detectChanges();
    const req = consulta(http);
    expect(req.request.params.get('inicio')).toBe(PADRAO.inicio);
    expect(req.request.params.get('fim')).toBe(PADRAO.fim);
    expect(req.request.params.has('produtoId')).toBe(false);
    req.flush(RELATORIO);
    http.expectOne(PRODUTOS).flush([]);
  });

  it('aceite F9: exibe exatamente os totais e o porProduto do servidor, sem recalcular', async () => {
    const { texto, el } = await montar();
    const t = texto();
    const totais = Array.from(el.querySelectorAll('.total')).map((d) =>
      Array.from(d.children).map((c) => (c.textContent ?? '').replace(/\s/g, ' ').trim()),
    );
    expect(totais).toEqual([
      ['Total bruto', 'R$ 1.234,50'],
      ['Desconto', 'R$ 34,50'],
      ['Total líquido', 'R$ 7.777,00'],
    ]);
    const linhas = Array.from(el.querySelectorAll('.tabela tbody tr')).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) =>
        (td.textContent ?? '').replace(/\s/g, ' ').trim(),
      ),
    );
    expect(linhas.slice(0, 2)).toEqual([
      ['Água 20L', '7', 'R$ 555,55'],
      ['Galão cheio', '2', 'R$ 99,90'],
    ]);
    expect(linhas[2]).toEqual(['02/11/2026', 'R$ 321,10']);
    // soma das linhas (655,45) e bruto - desconto (1.200,00) não aparecem
    expect(t).not.toContain('655,45');
    expect(t).not.toContain('1.200,00');
  });

  it('gesto: altera período e produto, busca, e depois "todos" tira o produtoId', async () => {
    const { http, fixture, buscar, data, produto } = await montar();
    await data('De', '2026-10-05');
    await data('Até', '2026-10-20');
    await produto('p2');
    buscar().click();
    const req = consulta(http);
    expect(req.request.params.get('inicio')).toBe('2026-10-05');
    expect(req.request.params.get('fim')).toBe('2026-10-20');
    expect(req.request.params.get('produtoId')).toBe('p2');
    req.flush(RELATORIO);
    await assentar(fixture);

    await produto('');
    buscar().click();
    const todos = consulta(http);
    expect(todos.request.params.get('inicio')).toBe('2026-10-05');
    expect(todos.request.params.get('fim')).toBe('2026-10-20');
    expect(todos.request.params.has('produtoId')).toBe(false);
    todos.flush(RELATORIO);
  });

  it('bloqueio: início depois do fim mostra a mensagem e não dispara requisição', async () => {
    const { http, fixture, buscar, data, texto } = await montar();
    await data('De', '2026-11-20');
    await data('Até', '2026-11-10');
    buscar().click();
    await assentar(fixture);
    http.verify();
    expect(texto()).toContain('A data inicial não pode ser depois da data final.');
  });

  it('erro da API mostra a mensagem e "Tentar de novo" refaz a busca', async () => {
    const { http, fixture, buscar, el, texto } = await montar();
    buscar().click();
    consulta(http).flush(
      { code: 'ERRO', message: 'x', traceId: 't' },
      { status: 500, statusText: 'Erro' },
    );
    await assentar(fixture);
    expect(texto()).toContain('Não foi possível carregar o relatório');
    const tentar = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Tentar de novo'),
    )!;
    tentar.click();
    consulta(http).flush(RELATORIO);
  });
});
