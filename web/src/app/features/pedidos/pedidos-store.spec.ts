import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigStore } from '../../core/config/app-config';
import { ApiError } from '../../core/http/api-error';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { PedidosStore } from './pedidos-store';

const PEDIDOS = '/api/vendas/v1/pedidos';
const CLIENTES = '/api/clientes/v1/clientes';
const resumo = (id: string, clienteId: string, status = 'PENDENTE') => ({
  id,
  clienteId,
  enderecoEntregaId: null,
  status,
  observacao: null,
  createdAt: '2026-01-01T10:00:00Z',
  iniciadoEm: null,
  canceladoEm: null,
});
const pedido = (status = 'PENDENTE') => ({
  ...resumo('p-1', 'c-1', status),
  createdBy: 'f1',
  canceladoPor: null,
  itens: [],
  funcionarios: [],
  vendaId: null,
  perdas: [],
});
const cliente = (id: string, nome: string) => ({
  id,
  nome,
  telefone: null,
  observacoes: null,
  enderecos: [],
});

describe('PedidosStore', () => {
  let store: PedidosStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
        { provide: StorageService, useValue: new FakeStorage() },
      ],
    });
    TestBed.inject(OperatorStore).select(operadorValido(['*']));
    store = TestBed.inject(PedidosStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('filtrar: guarda o filtro e lista com o status; null = Todos sem status', () => {
    store.filtrar('PENDENTE');
    expect(store.filtro()).toBe('PENDENTE');
    expect(store.statusLista()).toBe('loading');
    const req = http.expectOne((r) => r.url === PEDIDOS);
    expect(req.request.params.get('status')).toBe('PENDENTE');
    req.flush([]);
    expect(store.statusLista()).toBe('ok');

    store.filtrar(null);
    const todos = http.expectOne((r) => r.url === PEDIDOS);
    expect(todos.request.params.has('status')).toBe(false);
    todos.flush([]);
  });

  it('nome do cliente: resolve uma vez por id distinto e guarda em cache', () => {
    store.carregarLista();
    http
      .expectOne((r) => r.url === PEDIDOS)
      .flush([resumo('1', 'c-1'), resumo('2', 'c-1'), resumo('3', 'c-2')]);
    http.expectOne(`${CLIENTES}/c-1`).flush(cliente('c-1', 'Ana'));
    http.expectOne(`${CLIENTES}/c-2`).flush(cliente('c-2', 'Bia'));
    expect(store.linhas().map((l) => l.clienteNome)).toEqual(['Ana', 'Ana', 'Bia']);

    store.carregarLista(); // recarga: nomes vêm do cache
    http.expectOne((r) => r.url === PEDIDOS).flush([resumo('1', 'c-1')]);
    expect(store.linhas()[0].clienteNome).toBe('Ana');
  });

  it("nome do cliente: erro na busca mostra 'Cliente'", () => {
    store.carregarLista();
    http.expectOne((r) => r.url === PEDIDOS).flush([resumo('1', 'c-9')]);
    http.expectOne(`${CLIENTES}/c-9`).flush(null, { status: 404, statusText: 'x' });
    expect(store.linhas()[0].clienteNome).toBe('Cliente');
  });

  it('erro na lista vira status error', () => {
    store.carregarLista();
    http.expectOne((r) => r.url === PEDIDOS).flush(null, { status: 500, statusText: 'x' });
    expect(store.statusLista()).toBe('error');
  });

  it('carregar: põe o pedido e o cliente; 4xx guarda a mensagem', () => {
    store.carregar('p-1');
    expect(store.statusPedido()).toBe('loading');
    http.expectOne(`${PEDIDOS}/p-1`).flush(pedido());
    http.expectOne(`${CLIENTES}/c-1`).flush(cliente('c-1', 'Ana'));
    expect(store.pedido()?.id).toBe('p-1');
    expect(store.cliente()?.nome).toBe('Ana');
    expect(store.statusPedido()).toBe('ok');

    store.carregar('p-2');
    expect(store.pedido()).toBeNull();
    http
      .expectOne(`${PEDIDOS}/p-2`)
      .flush({ code: 'X', message: 'sumiu', traceId: 't' }, { status: 404, statusText: 'x' });
    expect(store.statusPedido()).toBe('error');
    expect(store.erroPedido()).toBeTruthy();
  });

  it('iniciar: envia o funcionarioId do operador e os ids; atualiza o pedido e a lista', async () => {
    store.carregarLista();
    http.expectOne((r) => r.url === PEDIDOS).flush([resumo('p-1', 'c-1')]);
    http.expectOne(`${CLIENTES}/c-1`).flush(cliente('c-1', 'Ana'));

    const p = store.iniciar('p-1', ['a', 'b']);
    const req = http.expectOne(`${PEDIDOS}/p-1/inicio`);
    expect(req.request.body).toEqual({ funcionarioId: 'f1', funcionariosIds: ['a', 'b'] });
    req.flush(pedido('EM_ANDAMENTO'));
    await p;
    expect(store.pedido()?.status).toBe('EM_ANDAMENTO');
    expect(store.pedidos()[0].status).toBe('EM_ANDAMENTO');
  });

  it('cancelar: envia o funcionarioId do operador', async () => {
    const p = store.cancelar('p-1');
    const req = http.expectOne(`${PEDIDOS}/p-1/cancelamento`);
    expect(req.request.body).toEqual({ funcionarioId: 'f1' });
    req.flush(pedido('CANCELADO'));
    await p;
    expect(store.pedido()?.status).toBe('CANCELADO');
  });

  it('409 PEDIDO_STATUS_INVALIDO relança o ApiError e recarrega o pedido', async () => {
    const p = store.cancelar('p-1');
    http
      .expectOne(`${PEDIDOS}/p-1/cancelamento`)
      .flush(
        { code: 'PEDIDO_STATUS_INVALIDO', message: 'x', traceId: 't' },
        { status: 409, statusText: 'x' },
      );
    await expect(p).rejects.toBeInstanceOf(ApiError);
    http.expectOne(`${PEDIDOS}/p-1`).flush(pedido('CONCLUIDO'));
    http.expectOne(`${CLIENTES}/c-1`).flush(cliente('c-1', 'Ana'));
    expect(store.pedido()?.status).toBe('CONCLUIDO');
  });

  it('criar: POST com o corpo e devolve o pedido', async () => {
    const corpo = { clienteId: 'c-1' } as never;
    const p = store.criar(corpo);
    const req = http.expectOne(PEDIDOS);
    expect(req.request.body).toBe(corpo);
    req.flush(pedido());
    expect((await p).id).toBe('p-1');
  });

  it('concluir: POST da conclusão, devolve a venda e marca o pedido CONCLUIDO na lista', async () => {
    store.carregarLista();
    http.expectOne((r) => r.url === PEDIDOS).flush([resumo('p-1', 'c-1', 'EM_ANDAMENTO')]);
    http.expectOne(`${CLIENTES}/c-1`).flush(cliente('c-1', 'Ana'));

    const corpo = { funcionarioId: 'f1', itens: [] } as never;
    const p = store.concluir('p-1', corpo);
    const req = http.expectOne(`${PEDIDOS}/p-1/conclusao`);
    expect(req.request.body).toBe(corpo);
    req.flush({ id: 'v-1' });
    expect((await p).id).toBe('v-1');
    expect(store.pedidos()[0].status).toBe('CONCLUIDO');
  });

  it('concluir: 409 PEDIDO_STATUS_INVALIDO relança e recarrega o pedido', async () => {
    const p = store.concluir('p-1', {} as never);
    http
      .expectOne(`${PEDIDOS}/p-1/conclusao`)
      .flush(
        { code: 'PEDIDO_STATUS_INVALIDO', message: 'x', traceId: 't' },
        { status: 409, statusText: 'x' },
      );
    await expect(p).rejects.toBeInstanceOf(ApiError);
    http.expectOne(`${PEDIDOS}/p-1`).flush(pedido('CANCELADO'));
    http.expectOne(`${CLIENTES}/c-1`).flush(cliente('c-1', 'Ana'));
    expect(store.pedido()?.status).toBe('CANCELADO');
  });

  describe('registrarPerdas', () => {
    const ocorrencia = {
      galao: 'VAZIO' as const,
      produtoId: 'pr-9',
      marcaId: 'm-9',
      tipoCascoId: 'tc-1',
      quantidade: 2,
      motivo: 'PERDIDO' as const,
    };

    it('envia o funcionarioId do operador e as ocorrências com os nulos certos; grava o pedido', async () => {
      const p = store.registrarPerdas('p-1', [ocorrencia]);
      const req = http.expectOne(`${PEDIDOS}/p-1/perdas`);
      expect(req.request.body).toEqual({
        funcionarioId: 'f1',
        ocorrencias: [
          {
            galao: 'VAZIO',
            produtoId: null,
            marcaId: null,
            tipoCascoId: 'tc-1',
            quantidade: 2,
            motivo: 'PERDIDO',
          },
        ],
      });
      req.flush(pedido('CONCLUIDO'));
      await p;
      expect(store.pedido()?.status).toBe('CONCLUIDO');
    });

    it('sucesso limpa as pendentes do pedido; erro mantém', async () => {
      store.guardarPerdasPendentes('p-1', [ocorrencia]);
      store.guardarPerdasPendentes('p-2', [ocorrencia]);
      expect(store.perdasPendentes()['p-1']).toEqual([ocorrencia]);

      const falha = store.registrarPerdas('p-1', [ocorrencia]);
      http.expectOne(`${PEDIDOS}/p-1/perdas`).flush({}, { status: 500, statusText: 'x' });
      await expect(falha).rejects.toBeDefined();
      expect(store.perdasPendentes()['p-1']).toEqual([ocorrencia]);

      const p = store.registrarPerdas('p-1', [ocorrencia]);
      http.expectOne(`${PEDIDOS}/p-1/perdas`).flush(pedido('CONCLUIDO'));
      await p;
      expect(store.perdasPendentes()['p-1']).toBeUndefined();
      expect(store.perdasPendentes()['p-2']).toEqual([ocorrencia]);
    });
  });
});
