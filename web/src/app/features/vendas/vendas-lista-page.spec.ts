import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { ClienteResponse } from '../../core/api/models/clientes';
import { VendaDetalheResponse } from '../../core/api/models/vendas';
import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { VendasListaPage } from './vendas-lista-page';

const URL_VENDAS = '/api/vendas/v1/vendas';
const URL_CLIENTES = '/api/clientes/v1/clientes';

function venda(id: string, clienteId = 'c-1'): VendaDetalheResponse {
  return {
    id,
    clienteId,
    funcionarioId: 'f-1',
    enderecoEntregaId: null,
    data: '2026-01-02T10:30:00',
    totalBruto: 100,
    totalDesconto: 0,
    totalLiquido: 100,
    statusPagamento: 'PARCIAL',
    observacao: null,
    cupomEmitido: true,
    cupomNumero: null,
    cupomEmitidoEm: null,
    itens: [],
    pagamentos: [],
    cascosDevolvidos: 0,
    sucataEntregue: 0,
  };
}

function cliente(id: string, nome: string): ClienteResponse {
  return { id, nome, telefone: null, observacoes: null, enderecos: [] };
}

async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
}

async function montar(inicial: VendaDetalheResponse[] = []) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(VendasListaPage);
  const el = fixture.nativeElement as HTMLElement;
  const vendas = () => http.expectOne((r) => r.url === URL_VENDAS && r.params.get('page') === '1');
  const t = {
    fixture,
    http,
    el,
    navegar,
    vendas,
    texto: () => (el.textContent ?? '').replace(/\s+/g, ' '),
    botao: (texto: string) => {
      const achado = Array.from(el.querySelectorAll('button')).find((b) =>
        b.textContent?.includes(texto),
      );
      if (!achado) {
        throw new Error(`botão "${texto}" não encontrado`);
      }
      return achado;
    },
    digitar: async (input: HTMLInputElement, valor: string) => {
      input.value = valor;
      input.dispatchEvent(new Event('input'));
      await assentar(fixture);
    },
    // O ce-search-box emite após o debounce de 300 ms.
    buscarCliente: async (nome: string) => {
      await t.digitar(el.querySelector<HTMLInputElement>('ce-search-box input')!, nome);
      await new Promise((r) => setTimeout(r, 350));
      await assentar(fixture);
    },
    datas: () => el.querySelectorAll<HTMLInputElement>('ce-input input[type="date"]'),
  };
  fixture.detectChanges();
  vendas().flush(inicial);
  await assentar(fixture);
  return t;
}

describe('VendasListaPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('ao abrir busca sem filtros; lista vazia mostra o estado vazio', async () => {
    const t = await montar([]);
    expect(t.texto()).toContain('Nenhuma venda');
  });

  it('a linha mostra placeholder, depois o nome e, no 404, "Cliente removido"', async () => {
    const t = await montar([venda('v-1', 'c-1'), venda('v-2', 'c-2'), venda('v-3', 'c-1')]);
    expect(t.texto()).toContain('Carregando cliente…');
    expect(t.texto()).toContain('R$ 100,00');
    expect(t.texto()).toContain('Parcial');
    expect(t.texto()).toContain('Cupom emitido');
    expect(t.texto()).toContain('02/01/2026 10:30');

    t.http.expectOne(`${URL_CLIENTES}/c-1`).flush(cliente('c-1', 'Maria'));
    t.http
      .expectOne(`${URL_CLIENTES}/c-2`)
      .flush(
        { code: 'CLIENTE_NAO_ENCONTRADO', message: 'x', traceId: 't' },
        { status: 404, statusText: 'Not Found' },
      );
    await assentar(t.fixture);
    expect(t.texto()).toContain('Maria');
    expect(t.texto()).toContain('Cliente removido');
    expect(t.texto()).not.toContain('Carregando cliente…');
  });

  it('filtro de cliente: selecionar busca com clienteId; limpar busca sem clienteId', async () => {
    const t = await montar([]);
    await t.buscarCliente('mar');
    t.http
      .expectOne((r) => r.url === URL_CLIENTES && r.params.get('nome') === 'mar')
      .flush([cliente('c-1', 'Maria')]);
    await assentar(t.fixture);

    t.botao('Maria').click();
    await assentar(t.fixture);
    const filtrada = t.http.expectOne(
      (r) => r.url === URL_VENDAS && r.params.get('clienteId') === 'c-1',
    );
    expect(filtrada.request.params.get('page')).toBe('1');
    filtrada.flush([]);
    await assentar(t.fixture);
    expect(t.texto()).toContain('Maria');

    t.botao('Limpar').click();
    await assentar(t.fixture);
    const limpa = t.vendas();
    expect(limpa.request.params.has('clienteId')).toBe(false);
    limpa.flush([]);
  });

  it('termo vazio não chama a API de clientes e 4xx na busca aparece inline', async () => {
    const t = await montar([]);
    await t.buscarCliente('x');
    t.http
      .expectOne((r) => r.url === URL_CLIENTES)
      .flush(
        { code: 'VALIDACAO', message: 'termo inválido', traceId: 't' },
        { status: 400, statusText: 'Bad Request' },
      );
    await assentar(t.fixture);
    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain('termo inválido');

    await t.buscarCliente('');
    t.http.expectNone((r) => r.url === URL_CLIENTES);
    expect(t.el.querySelector('[role="alert"]')).toBeNull();
  });

  it('filtro de período: alterar as datas busca com inicio/fim', async () => {
    const t = await montar([]);
    await t.digitar(t.datas()[0], '2026-01-01');
    t.vendas().flush([]);
    await assentar(t.fixture);

    await t.digitar(t.datas()[1], '2026-01-31');
    const req = t.vendas();
    expect(req.request.params.get('inicio')).toBe('2026-01-01');
    expect(req.request.params.get('fim')).toBe('2026-01-31');
    req.flush([]);
  });

  it('"Carregar mais" busca page=2 e mostra os itens acrescidos', async () => {
    const primeira = Array.from({ length: 20 }, (_, i) => venda(`v-${i}`));
    const t = await montar(primeira);
    t.http.expectOne(`${URL_CLIENTES}/c-1`).flush(cliente('c-1', 'Maria'));
    await assentar(t.fixture);
    expect(t.el.querySelectorAll('ce-list-item')).toHaveLength(20);

    t.botao('Carregar mais').click();
    await assentar(t.fixture);
    t.http
      .expectOne((r) => r.url === URL_VENDAS && r.params.get('page') === '2')
      .flush([venda('v-20', 'c-1')]);
    await assentar(t.fixture);
    expect(t.el.querySelectorAll('ce-list-item')).toHaveLength(21);
  });

  it('clicar na linha navega para o detalhe', async () => {
    const t = await montar([venda('v-9')]);
    t.http.expectOne(`${URL_CLIENTES}/c-1`).flush(cliente('c-1', 'Maria'));
    t.el.querySelector<HTMLElement>('ce-list-item button')!.click();
    expect(t.navegar).toHaveBeenCalledWith('/vendas/detalhe/v-9');
  });

  it('erro 4xx da lista mostra a userMessage inline', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(VendasListaPage);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === URL_VENDAS)
      .flush(
        { code: 'VALIDACAO', message: 'período inválido', traceId: 't' },
        { status: 400, statusText: 'Bad Request' },
      );
    await assentar(fixture);
    expect(fixture.nativeElement.textContent).toContain('período inválido');
  });
});
