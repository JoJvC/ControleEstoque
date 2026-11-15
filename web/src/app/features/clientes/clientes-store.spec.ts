import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigStore } from '../../core/config/app-config';
import { ApiError } from '../../core/http/api-error';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { ClientesStore } from './clientes-store';

const CLIENTES = '/api/clientes/v1/clientes';
const FIADO = '/api/financeiro/v1/clientes/c-1/fiado/pagamentos';

describe('ClientesStore — saldos e operações', () => {
  let store: ClientesStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      ],
    });
    store = TestBed.inject(ClientesStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('carregarSaldos põe os saldos e status ok', () => {
    store.carregarSaldos('c-1');
    expect(store.statusSaldos()).toBe('loading');
    http
      .expectOne(`${CLIENTES}/c-1/saldos`)
      .flush({ saldoCascos: 3, sucataEntregue: 1, saldoFiado: 50 });
    expect(store.saldos()).toEqual({ saldoCascos: 3, sucataEntregue: 1, saldoFiado: 50 });
    expect(store.statusSaldos()).toBe('ok');
    expect(store.erroSaldos()).toBeNull();
  });

  it('4xx guarda a mensagem em erroSaldos', () => {
    store.carregarSaldos('c-1');
    http
      .expectOne(`${CLIENTES}/c-1/saldos`)
      .flush(
        { code: 'CLIENTE_NAO_ENCONTRADO', message: 'x', traceId: 't' },
        { status: 404, statusText: 'Not Found' },
      );
    expect(store.statusSaldos()).toBe('error');
    expect(store.erroSaldos()).toBe('Cliente não encontrado.');
    expect(store.saldos()).toBeNull();
  });

  it('trocar de cliente zera os saldos antes da resposta', () => {
    store.carregarSaldos('c-1');
    http
      .expectOne(`${CLIENTES}/c-1/saldos`)
      .flush({ saldoCascos: 3, sucataEntregue: 1, saldoFiado: 50 });

    store.carregarSaldos('c-2');
    expect(store.saldos()).toBeNull();
    expect(store.statusSaldos()).toBe('loading');
    http
      .expectOne(`${CLIENTES}/c-2/saldos`)
      .flush({ saldoCascos: 0, sucataEntregue: 0, saldoFiado: 0 });
    expect(store.saldos()?.saldoCascos).toBe(0);
  });

  it('resposta atrasada de outro cliente não sobrescreve os saldos atuais', () => {
    store.carregarSaldos('c-1');
    const antiga = http.expectOne(`${CLIENTES}/c-1/saldos`);
    store.carregarSaldos('c-2');
    expect(antiga.cancelled).toBe(true);
    http
      .expectOne(`${CLIENTES}/c-2/saldos`)
      .flush({ saldoCascos: 7, sucataEntregue: 0, saldoFiado: 0 });
    expect(store.saldos()?.saldoCascos).toBe(7);
    expect(store.statusSaldos()).toBe('ok');
  });

  it('devolverCascos: POST /cascos/devolucoes com { quantidade }', async () => {
    const p = store.devolverCascos('c-1', 2);
    const req = http.expectOne(`${CLIENTES}/c-1/cascos/devolucoes`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ quantidade: 2 });
    req.flush({ novoSaldoCascos: 1 });
    expect(await p).toEqual({ novoSaldoCascos: 1 });
  });

  it('converterCascos: POST /cascos/conversoes com { quantidade, valorUnitario }', async () => {
    const p = store.converterCascos('c-1', 2, 30);
    const req = http.expectOne(`${CLIENTES}/c-1/cascos/conversoes`);
    expect(req.request.body).toEqual({ quantidade: 2, valorUnitario: 30 });
    req.flush({ novoSaldoCascos: 0, novoSaldoFiado: 60 });
    expect(await p).toEqual({ novoSaldoCascos: 0, novoSaldoFiado: 60 });
  });

  it('entregarSucata: POST /sucatas com e sem valorConversao', async () => {
    const com = store.entregarSucata('c-1', 3, 15);
    const r1 = http.expectOne(`${CLIENTES}/c-1/sucatas`);
    expect(r1.request.body).toEqual({ quantidade: 3, valorConversao: 15 });
    r1.flush({ totalSucataEntregue: 3, novoSaldoFiado: 5 });
    await com;

    const sem = store.entregarSucata('c-1', 3, null);
    const r2 = http.expectOne(`${CLIENTES}/c-1/sucatas`);
    expect(r2.request.body).toEqual({ quantidade: 3, valorConversao: null });
    r2.flush({ totalSucataEntregue: 6, novoSaldoFiado: 5 });
    await sem;
  });

  it('pagarFiado: POST na Financeiro com { valor, forma }', async () => {
    const p = store.pagarFiado('c-1', 50, 'PIX');
    const req = http.expectOne(FIADO);
    expect(req.request.body).toEqual({ valor: 50, forma: 'PIX' });
    req.flush({ novoSaldoFiado: 0 });
    expect(await p).toEqual({ novoSaldoFiado: 0 });
  });

  it.each([
    ['devolverCascos', () => store.devolverCascos('c-1', 1), `${CLIENTES}/c-1/cascos/devolucoes`],
    [
      'converterCascos',
      () => store.converterCascos('c-1', 1, 1),
      `${CLIENTES}/c-1/cascos/conversoes`,
    ],
    ['entregarSucata', () => store.entregarSucata('c-1', 1, null), `${CLIENTES}/c-1/sucatas`],
    ['pagarFiado', () => store.pagarFiado('c-1', 1, null), FIADO],
  ])('%s propaga o ApiError', async (_nome, chamar, url) => {
    const p = chamar();
    http
      .expectOne(url)
      .flush(
        { code: 'CAIXA_FECHADO', message: 'x', traceId: 't' },
        { status: 409, statusText: 'Conflict' },
      );
    const erro = await p.catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ApiError);
    expect((erro as ApiError).code).toBe('CAIXA_FECHADO');
  });
});

describe('ClientesStore — histórico', () => {
  let store: ClientesStore;
  let http: HttpTestingController;
  const VENDAS = '/api/vendas/v1/vendas';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      ],
    });
    store = TestBed.inject(ClientesStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envia clienteId, page 1 e pageSize 10', () => {
    store.carregarHistorico('c-1');
    expect(store.statusHistorico()).toBe('loading');
    const req = http.expectOne((r) => r.url === VENDAS);
    expect(req.request.params.get('clienteId')).toBe('c-1');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('10');
    req.flush([{ id: 'v-1' }]);
    expect(store.historico()).toHaveLength(1);
    expect(store.statusHistorico()).toBe('ok');
  });

  it('descarta resposta velha quando o id muda', () => {
    store.carregarHistorico('c-1');
    const velha = http.expectOne((r) => r.params.get('clienteId') === 'c-1');
    store.carregarHistorico('c-2');
    expect(velha.cancelled).toBe(true);
    http.expectOne((r) => r.params.get('clienteId') === 'c-2').flush([{ id: 'v-2' }]);
    expect(store.historico()).toEqual([{ id: 'v-2' }]);
  });

  it('erro põe status error', () => {
    store.carregarHistorico('c-1');
    http.expectOne((r) => r.url === VENDAS).flush(null, { status: 500, statusText: 'x' });
    expect(store.statusHistorico()).toBe('error');
  });
});

describe('ClientesStore — filtros e relatórios', () => {
  let store: ClientesStore;
  let http: HttpTestingController;
  const FIADO_REL = '/api/financeiro/v1/relatorios/fiado';
  const CASCOS_REL = '/api/clientes/v1/relatorios/cascos';
  const ANA = { id: 'a', nome: 'Ana', telefone: null, observacoes: null, enderecos: [] };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      ],
    });
    store = TestBed.inject(ClientesStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('abrir carrega os dois relatórios uma vez e trocar de chip não refaz as cargas', () => {
    store.abrir('todos');
    http.expectOne((r) => r.url === CLIENTES).flush([ANA]);
    http.expectOne(FIADO_REL).flush([{ clienteId: 'a', nome: 'Ana', saldoDevedor: 5 }]);
    http.expectOne(CASCOS_REL).flush([{ clienteId: 'a', nome: 'Ana', saldoCascos: 2 }]);
    expect(store.linhas()).toMatchObject([{ id: 'a', saldoFiado: 5, saldoCascos: 2 }]);

    store.definirFiltro('fiado');
    store.definirFiltro('casco');
    store.definirFiltro('casco');
    store.definirFiltro('todos');
    http.expectNone(() => true);
    expect(store.statusLista()).toBe('ok');
  });

  it('abrir em fiado mostra o relatório sem buscar a lista de todos', () => {
    store.abrir('fiado');
    http.expectNone((r) => r.url === CLIENTES);
    http.expectOne(CASCOS_REL).flush([]);
    http.expectOne(FIADO_REL).flush([{ clienteId: 'a', nome: 'Ana', saldoDevedor: 5 }]);
    expect(store.linhas().map((l) => l.nome)).toEqual(['Ana']);
    expect(store.temMaisLista()).toBe(false);
  });

  it('trocar o filtro para fiado e para casco dispara um único GET do relatório de cada', () => {
    store.definirFiltro('fiado');
    http.expectOne(FIADO_REL).flush([]);
    http.expectNone(CASCOS_REL);
    store.definirFiltro('casco');
    http.expectOne(CASCOS_REL).flush([]);
    http.expectNone(FIADO_REL);
  });

  it('voltar a todos com o termo mudado busca a API com o termo', () => {
    store.abrir('fiado');
    http.expectOne(FIADO_REL).flush([]);
    http.expectOne(CASCOS_REL).flush([]);
    store.buscar('an');
    http.expectNone((r) => r.url === CLIENTES);
    store.definirFiltro('todos');
    http.expectOne((r) => r.url === CLIENTES && r.params.get('nome') === 'an').flush([ANA]);
  });

  it('a falha de um relatório não derruba a lista nem o outro relatório', () => {
    store.abrir('todos');
    http.expectOne((r) => r.url === CLIENTES).flush([ANA]);
    http.expectOne(FIADO_REL).flush(null, { status: 500, statusText: 'x' });
    http.expectOne(CASCOS_REL).flush([{ clienteId: 'a', nome: 'Ana', saldoCascos: 2 }]);
    expect(store.statusLista()).toBe('ok');
    expect(store.linhas()).toMatchObject([{ id: 'a', saldoCascos: 2 }]);
    expect(store.linhas()[0].saldoFiado).toBeUndefined();
  });

  it('relatório do chip atual com falha vira erro da lista e recarregar tenta de novo', () => {
    store.abrir('fiado');
    http.expectOne(FIADO_REL).flush(null, { status: 500, statusText: 'x' });
    http.expectOne(CASCOS_REL).flush([]);
    expect(store.statusLista()).toBe('error');
    store.recarregar();
    http.expectOne(FIADO_REL).flush([]);
    expect(store.statusLista()).toBe('ok');
  });
});
