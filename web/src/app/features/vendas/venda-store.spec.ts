import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ClienteResponse } from '../../core/api/models/clientes';
import {
  CreateVendaRequest,
  CupomFiscalResponse,
  VendaDetalheResponse,
} from '../../core/api/models/vendas';
import { ConfigStore } from '../../core/config/app-config';
import { ApiError } from '../../core/http/api-error';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { VendaStore } from './venda-store';

const URL_CUPOM = '/api/vendas/v1/vendas/v-1/cupom-fiscal';
const URL_VENDAS = '/api/vendas/v1/vendas';
const URL_CLIENTES = '/api/clientes/v1/clientes';
const URL_PRODUTOS = '/api/estoque/v1/produtos';

function criarStore(): { store: VendaStore; http: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
    ],
  });
  return { store: TestBed.inject(VendaStore), http: TestBed.inject(HttpTestingController) };
}

describe('VendaStore.emitirCupom', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sucesso: POST sem corpo, resolve com o cupom e não recarrega a lista', async () => {
    const { store, http } = criarStore();
    const cupom: CupomFiscalResponse = { cupomId: 'c1', numero: '123', emitidoEm: '2026-01-01' };
    const promessa = store.emitirCupom('v-1');
    const req = http.expectOne(URL_CUPOM);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush(cupom);
    expect(await promessa).toEqual(cupom);
  });

  it('erro da API: rejeita e não altera status nem vendas', async () => {
    const { store, http } = criarStore();
    const promessa = store.emitirCupom('v-1');
    http.expectOne(URL_CUPOM).flush({ erro: 'x' }, { status: 500, statusText: 'Erro' });
    await expect(promessa).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(store.status()).toBe('idle');
    expect(store.vendas()).toEqual([]);
  });
});

describe('VendaStore.editar', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('PUT na URL da venda com o corpo dado e, em seguida, GET da listagem com os filtros atuais', async () => {
    const { store, http } = criarStore();
    store.buscar({ clienteId: 'c-1' });
    http.expectOne((r) => r.url === URL_VENDAS).flush([]);
    const corpo: CreateVendaRequest = {
      clienteId: 'c-1',
      funcionarioId: 'f-1',
      enderecoEntregaId: null,
      itens: [{ produtoId: 'p-1', quantidade: 3, precoUnitario: 10, desconto: null }],
      pagamentos: [{ forma: 'PIX', valor: 30 }],
      cascosDevolvidos: 2,
      cascosDevolvidosNaHora: false,
      sucataEntregue: 1,
      observacao: null,
    };

    const promessa = store.editar('v-1', corpo);
    const put = http.expectOne(`${URL_VENDAS}/v-1`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual(corpo);
    put.flush({ id: 'v-1' });
    await promessa;

    const lista = http.expectOne((r) => r.url === URL_VENDAS);
    expect(lista.request.method).toBe('GET');
    expect(lista.request.params.get('clienteId')).toBe('c-1');
    lista.flush([]);
  });
});

// ApiError só existe com o interceptor, que o setup acima não tem.
function criarStoreComInterceptor(): { store: VendaStore; http: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
    ],
  });
  return { store: TestBed.inject(VendaStore), http: TestBed.inject(HttpTestingController) };
}

function venda(id: string, clienteId: string): VendaDetalheResponse {
  return {
    id,
    clienteId,
    funcionarioId: 'f-1',
    enderecoEntregaId: null,
    data: '2026-01-02T10:00:00',
    totalBruto: 10,
    totalDesconto: 0,
    totalLiquido: 10,
    statusPagamento: 'PAGA',
    observacao: null,
    cupomEmitido: false,
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

function erro404(code: string) {
  return [
    { code, message: 'x', traceId: 't' },
    { status: 404, statusText: 'Not Found' },
  ] as const;
}

describe('VendaStore listagem', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('buscar: envia filtros e page=1, substitui a lista e temMais com 20 itens', () => {
    const { store, http } = criarStoreComInterceptor();
    store.buscar({ clienteId: 'c-1', inicio: '2026-01-01', fim: '2026-01-31' });
    const req = http.expectOne((r) => r.url === URL_VENDAS);
    expect(req.request.params.get('clienteId')).toBe('c-1');
    expect(req.request.params.get('inicio')).toBe('2026-01-01');
    expect(req.request.params.get('fim')).toBe('2026-01-31');
    expect(req.request.params.get('page')).toBe('1');
    expect(store.status()).toBe('loading');
    req.flush(Array.from({ length: 20 }, (_, i) => venda(`v-${i}`, 'c-1')));
    http.expectOne(`${URL_CLIENTES}/c-1`).flush(cliente('c-1', 'Maria'));
    expect(store.status()).toBe('ok');
    expect(store.vendas()).toHaveLength(20);
    expect(store.temMais()).toBe(true);

    store.buscar({});
    http.expectOne((r) => r.url === URL_VENDAS).flush([venda('v-x', 'c-1')]);
    expect(store.vendas().map((v) => v.id)).toEqual(['v-x']);
    expect(store.temMais()).toBe(false);
  });

  it('carregarMais: page=2 e acrescenta à lista', () => {
    const { store, http } = criarStoreComInterceptor();
    store.buscar({});
    http
      .expectOne((r) => r.url === URL_VENDAS)
      .flush(Array.from({ length: 20 }, (_, i) => venda(`v-${i}`, 'c-1')));
    http.expectOne(`${URL_CLIENTES}/c-1`).flush(cliente('c-1', 'Maria'));

    store.carregarMais();
    const req = http.expectOne((r) => r.url === URL_VENDAS);
    expect(req.request.params.get('page')).toBe('2');
    req.flush([venda('v-20', 'c-1')]);
    // c-1 já está no cache: nenhum GET de cliente novo.
    http.expectNone(`${URL_CLIENTES}/c-1`);
    expect(store.vendas()).toHaveLength(21);
    expect(store.temMais()).toBe(false);
  });

  it('erro 4xx de buscar preenche erro com userMessage', () => {
    const { store, http } = criarStoreComInterceptor();
    store.buscar({});
    http
      .expectOne((r) => r.url === URL_VENDAS)
      .flush(
        { code: 'VENDA_INVALIDA', message: 'período inválido', traceId: 't' },
        {
          status: 400,
          statusText: 'Bad Request',
        },
      );
    expect(store.status()).toBe('error');
    expect(store.erro()).toBe('período inválido');
    store.buscar({});
    expect(store.erro()).toBeNull();
    http.expectOne((r) => r.url === URL_VENDAS).flush([]);
  });
});

describe('VendaStore.obter', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sucesso: preenche o detalhe e resolve o cliente', () => {
    const { store, http } = criarStoreComInterceptor();
    store.obter('v-1');
    expect(store.statusDetalhe()).toBe('loading');
    http.expectOne(`${URL_VENDAS}/v-1`).flush(venda('v-1', 'c-1'));
    http.expectOne(`${URL_CLIENTES}/c-1`).flush(cliente('c-1', 'Maria'));
    expect(store.statusDetalhe()).toBe('ok');
    expect(store.detalhe()?.id).toBe('v-1');
    expect(store.clientes().get('c-1')).toEqual({ estado: 'ok', nome: 'Maria' });
  });

  it('resposta atrasada de outra venda não sobrescreve o detalhe atual', () => {
    const { store, http } = criarStoreComInterceptor();
    store.obter('v-1');
    const antiga = http.expectOne(`${URL_VENDAS}/v-1`);
    store.obter('v-2');
    http.expectOne(`${URL_VENDAS}/v-2`).flush(venda('v-2', 'c-1'));
    http.expectOne(`${URL_CLIENTES}/c-1`).flush(cliente('c-1', 'Maria'));
    expect(antiga.cancelled).toBe(true);
    expect(store.detalhe()?.id).toBe('v-2');
  });

  it('404 VENDA_NAO_ENCONTRADA: statusDetalhe error, erroDetalhe preenchido, detalhe limpo', () => {
    const { store, http } = criarStoreComInterceptor();
    store.obter('v-1');
    http.expectOne(`${URL_VENDAS}/v-1`).flush(venda('v-1', 'c-1'));
    http.expectOne(`${URL_CLIENTES}/c-1`).flush(cliente('c-1', 'Maria'));

    store.obter('v-2');
    expect(store.detalhe()).toBeNull();
    http.expectOne(`${URL_VENDAS}/v-2`).flush(...erro404('VENDA_NAO_ENCONTRADA'));
    expect(store.statusDetalhe()).toBe('error');
    expect(store.erroDetalhe()).toBe('Venda não encontrada.');
  });
});

describe('VendaStore cache de clientes', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('2 vendas do mesmo cliente: 1 GET de cliente e Map com ok/nome', () => {
    const { store, http } = criarStoreComInterceptor();
    store.buscar({});
    http.expectOne((r) => r.url === URL_VENDAS).flush([venda('v-1', 'c-1'), venda('v-2', 'c-1')]);
    expect(store.clientes().get('c-1')).toEqual({ estado: 'carregando' });
    http.expectOne(`${URL_CLIENTES}/c-1`).flush(cliente('c-1', 'Maria'));
    expect(store.clientes().get('c-1')).toEqual({ estado: 'ok', nome: 'Maria' });

    // refazer a busca também não repete o pedido
    store.buscar({});
    http.expectOne((r) => r.url === URL_VENDAS).flush([venda('v-1', 'c-1')]);
    http.expectNone(`${URL_CLIENTES}/c-1`);
  });

  it('404 CLIENTE_NAO_ENCONTRADA deixa removido', () => {
    const { store, http } = criarStoreComInterceptor();
    store.buscar({});
    http.expectOne((r) => r.url === URL_VENDAS).flush([venda('v-1', 'c-1')]);
    http.expectOne(`${URL_CLIENTES}/c-1`).flush(...erro404('CLIENTE_NAO_ENCONTRADO'));
    expect(store.clientes().get('c-1')).toEqual({ estado: 'removido' });
  });

  it('outro erro tira a entrada do Map e a próxima busca tenta de novo', () => {
    const { store, http } = criarStoreComInterceptor();
    store.buscar({});
    http.expectOne((r) => r.url === URL_VENDAS).flush([venda('v-1', 'c-1')]);
    http
      .expectOne(`${URL_CLIENTES}/c-1`)
      .flush({ code: 'X', message: 'x', traceId: 't' }, { status: 500, statusText: 'Erro' });
    expect(store.clientes().has('c-1')).toBe(false);

    store.buscar({});
    http.expectOne((r) => r.url === URL_VENDAS).flush([venda('v-1', 'c-1')]);
    http.expectOne(`${URL_CLIENTES}/c-1`).flush(cliente('c-1', 'Maria'));
  });
});

describe('VendaStore cache de produtos', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function vendaComItens(id: string, produtoIds: string[]): VendaDetalheResponse {
    return {
      ...venda(id, 'c-1'),
      itens: produtoIds.map((produtoId) => ({
        produtoId,
        quantidade: 1,
        precoUnitario: 10,
        descontoTipo: null,
        descontoValor: null,
        motivoDesconto: null,
        totalItem: 10,
      })),
    };
  }

  function responderObter(http: HttpTestingController, v: VendaDetalheResponse) {
    http.expectOne(`${URL_VENDAS}/${v.id}`).flush(v);
    http.expectOne(`${URL_CLIENTES}/c-1`).flush(cliente('c-1', 'Maria'));
  }

  it('2 itens do mesmo produto: 1 GET de produto e Map com ok/nome', () => {
    const { store, http } = criarStoreComInterceptor();
    store.obter('v-1');
    responderObter(http, vendaComItens('v-1', ['p-1', 'p-1']));
    expect(store.produtos().get('p-1')).toEqual({ estado: 'carregando' });
    http.expectOne(`${URL_PRODUTOS}/p-1`).flush({ id: 'p-1', nome: 'Água 20L' });
    expect(store.produtos().get('p-1')).toEqual({ estado: 'ok', nome: 'Água 20L' });

    // abrir outra venda com o mesmo produto não repete o pedido
    store.obter('v-2');
    http.expectOne(`${URL_VENDAS}/v-2`).flush(vendaComItens('v-2', ['p-1']));
    http.expectNone(`${URL_PRODUTOS}/p-1`);
  });

  it('404 PRODUTO_NAO_ENCONTRADO deixa removido', () => {
    const { store, http } = criarStoreComInterceptor();
    store.obter('v-1');
    responderObter(http, vendaComItens('v-1', ['p-1']));
    http.expectOne(`${URL_PRODUTOS}/p-1`).flush(...erro404('PRODUTO_NAO_ENCONTRADO'));
    expect(store.produtos().get('p-1')).toEqual({ estado: 'removido' });
  });

  it('outro erro tira a entrada do Map e o próximo detalhe tenta de novo', () => {
    const { store, http } = criarStoreComInterceptor();
    store.obter('v-1');
    responderObter(http, vendaComItens('v-1', ['p-1']));
    http
      .expectOne(`${URL_PRODUTOS}/p-1`)
      .flush({ code: 'X', message: 'x', traceId: 't' }, { status: 500, statusText: 'Erro' });
    expect(store.produtos().has('p-1')).toBe(false);

    store.obter('v-1');
    http.expectOne(`${URL_VENDAS}/v-1`).flush(vendaComItens('v-1', ['p-1']));
    http.expectOne(`${URL_PRODUTOS}/p-1`).flush({ id: 'p-1', nome: 'Água 20L' });
  });
});

describe('VendaStore detalhe aberto: pagamento e cupom', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function abrir(store: VendaStore, http: HttpTestingController, id = 'v-1') {
    store.obter(id);
    http.expectOne(`${URL_VENDAS}/${id}`).flush(venda(id, 'c-1'));
    http.expectOne(`${URL_CLIENTES}/c-1`).flush(cliente('c-1', 'Maria'));
  }

  it('adicionarPagamento: POST com o corpo, recarrega a lista e o detalhe aberto', async () => {
    const { store, http } = criarStoreComInterceptor();
    abrir(store, http);

    const promessa = store.adicionarPagamento('v-1', { forma: 'PIX', valor: 4 });
    const post = http.expectOne(`${URL_VENDAS}/v-1/pagamentos`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ forma: 'PIX', valor: 4 });
    post.flush({ id: 'v-1' });
    await promessa;

    http.expectOne((r) => r.method === 'GET' && r.url === URL_VENDAS).flush([]);
    http
      .expectOne(`${URL_VENDAS}/v-1`)
      .flush({ ...venda('v-1', 'c-1'), statusPagamento: 'PARCIAL' });
    expect(store.detalhe()?.statusPagamento).toBe('PARCIAL');
  });

  it('adicionarPagamento: 422 rejeita com ApiError e não recarrega nada', async () => {
    const { store, http } = criarStoreComInterceptor();
    abrir(store, http);

    const promessa = store.adicionarPagamento('v-1', { forma: 'PIX', valor: 99 });
    http
      .expectOne(`${URL_VENDAS}/v-1/pagamentos`)
      .flush(
        { code: 'PAGAMENTO_EXCEDE_SALDO', message: 'x', traceId: 't' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    await expect(promessa).rejects.toMatchObject({ status: 422, code: 'PAGAMENTO_EXCEDE_SALDO' });
    await expect(promessa).rejects.toBeInstanceOf(ApiError);
  });

  it('adicionarPagamento: venda diferente da aberta não recarrega o detalhe', async () => {
    const { store, http } = criarStoreComInterceptor();
    abrir(store, http);

    const promessa = store.adicionarPagamento('v-2', { forma: 'PIX', valor: 1 });
    http.expectOne(`${URL_VENDAS}/v-2/pagamentos`).flush({ id: 'v-2' });
    await promessa;
    http.expectOne((r) => r.method === 'GET' && r.url === URL_VENDAS).flush([]);
    http.expectNone(`${URL_VENDAS}/v-2`);
    expect(store.detalhe()?.id).toBe('v-1');
  });

  it('emitirCupom: recarrega o detalhe aberto da mesma venda e não a lista', async () => {
    const { store, http } = criarStoreComInterceptor();
    abrir(store, http);

    const promessa = store.emitirCupom('v-1');
    http
      .expectOne(`${URL_VENDAS}/v-1/cupom-fiscal`)
      .flush({ cupomId: 'c1', numero: 'CF-1', emitidoEm: '2026-01-02T10:00:00Z' });
    await promessa;

    http
      .expectOne(`${URL_VENDAS}/v-1`)
      .flush({ ...venda('v-1', 'c-1'), cupomEmitido: true, cupomNumero: 'CF-1' });
    http.expectNone((r) => r.method === 'GET' && r.url === URL_VENDAS);
    expect(store.detalhe()?.cupomNumero).toBe('CF-1');
  });

  it('cupomExistente: devolve número e data sem alterar o detalhe', async () => {
    const { store, http } = criarStoreComInterceptor();
    abrir(store, http);
    const antes = store.detalhe();

    const promessa = store.cupomExistente('v-1');
    http.expectOne(`${URL_VENDAS}/v-1`).flush({
      ...venda('v-1', 'c-1'),
      cupomEmitido: true,
      cupomNumero: 'CF-9',
      cupomEmitidoEm: '2026-01-02T10:00:00Z',
    });
    expect(await promessa).toEqual({ numero: 'CF-9', emitidoEm: '2026-01-02T10:00:00Z' });
    expect(store.detalhe()).toBe(antes);
  });

  it('cupomExistente: null quando não há cupom', async () => {
    const { store, http } = criarStoreComInterceptor();
    const promessa = store.cupomExistente('v-1');
    http.expectOne(`${URL_VENDAS}/v-1`).flush(venda('v-1', 'c-1'));
    expect(await promessa).toBeNull();
    expect(store.detalhe()).toBeNull();
  });
});
