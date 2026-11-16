import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigStore } from '../config/app-config';
import { CreateVendaRequest } from './models/vendas';
import { VendasApi } from './vendas-api';

describe('VendasApi', () => {
  let api: VendasApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      ],
    });
    api = TestBed.inject(VendasApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const ID = 'v-1';
  const BASE = '/api/vendas/v1/vendas';
  const body: CreateVendaRequest = {
    clienteId: 'c-1',
    funcionarioId: 'f-1',
    enderecoEntregaId: null,
    itens: [
      {
        produtoId: 'p-1',
        marcaId: 'm-1',
        quantidade: 5,
        precoUnitario: 50,
        desconto: null,
      },
    ],
    vasilhames: [{ tipoCascoId: 't-1', quantidade: 2, precoUnitario: 30, modoCredito: 'COMPRAR' }],
    pagamentos: [{ forma: 'PIX', valor: 200 }],
    cascosDevolvidos: [{ tipoCascoId: 't-1', quantidade: 3 }],
    sucataEntregue: [{ tipoCascoId: 't-1', quantidade: 1, valorUnitario: 5 }],
    observacao: null,
  };

  it('criar: POST /vendas com o corpo e repassa a resposta', () => {
    let resp: unknown;
    api.criar(body).subscribe((r) => (resp = r));
    const req = http.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ id: ID });
    expect(resp).toEqual({ id: ID });
  });

  it('editar: PUT /vendas/{id} com o corpo', () => {
    api.editar(ID, body).subscribe();
    const req = http.expectOne(`${BASE}/${ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('obter: GET /vendas/{id} repassa a resposta', () => {
    let resp: unknown;
    api.obter(ID).subscribe((r) => (resp = r));
    const req = http.expectOne(`${BASE}/${ID}`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: ID });
    expect(resp).toEqual({ id: ID });
  });

  it('listar: envia todos os filtros e repassa o array', () => {
    let resp: unknown;
    api
      .listar({ clienteId: 'c1', inicio: '2026-11-01', fim: '2026-11-13', page: 2, pageSize: 50 })
      .subscribe((r) => (resp = r));
    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().sort()).toEqual([
      'clienteId',
      'fim',
      'inicio',
      'page',
      'pageSize',
    ]);
    expect(req.request.params.get('clienteId')).toBe('c1');
    expect(req.request.params.get('inicio')).toBe('2026-11-01');
    expect(req.request.params.get('fim')).toBe('2026-11-13');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('50');
    req.flush([{ id: ID }]);
    expect(resp).toEqual([{ id: ID }]);
  });

  it('listar: sem filtros não envia query params', () => {
    api.listar().subscribe();
    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.params.keys()).toEqual([]);
    req.flush([]);
  });

  it('listar: page 0 é enviado (não confundido com ausente)', () => {
    api.listar({ page: 0 }).subscribe();
    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.params.get('page')).toBe('0');
    req.flush([]);
  });

  it('adicionarPagamento: POST /vendas/{id}/pagamentos com o corpo', () => {
    const pagamento = { forma: 'PIX' as const, valor: 10 };
    api.adicionarPagamento(ID, pagamento).subscribe();
    const req = http.expectOne(`${BASE}/${ID}/pagamentos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(pagamento);
    req.flush({});
  });

  it('emitirCupom: POST /vendas/{id}/cupom-fiscal sem corpo', () => {
    let resp: unknown;
    api.emitirCupom(ID).subscribe((r) => (resp = r));
    const req = http.expectOne(`${BASE}/${ID}/cupom-fiscal`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush({ numero: 1 });
    expect(resp).toEqual({ numero: 1 });
  });

  describe('relatórios', () => {
    const REL = '/api/vendas/v1/relatorios';

    it('relatorioFaturamento: GET com inicio, fim e produtoId', () => {
      let resp: unknown;
      api.relatorioFaturamento('2026-11-01', '2026-11-13', 'p1').subscribe((r) => (resp = r));
      const req = http.expectOne((r) => r.url === `${REL}/faturamento`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().sort()).toEqual(['fim', 'inicio', 'produtoId']);
      expect(req.request.params.get('inicio')).toBe('2026-11-01');
      expect(req.request.params.get('fim')).toBe('2026-11-13');
      expect(req.request.params.get('produtoId')).toBe('p1');
      const corpo = {
        totalBruto: 10,
        totalDesconto: 1,
        totalLiquido: 9,
        porProduto: [],
        porDia: [],
        porCategoria: [],
      };
      req.flush(corpo);
      expect(resp).toEqual(corpo);
    });

    it('relatorioFaturamento: sem produtoId não envia produtoId', () => {
      api.relatorioFaturamento('2026-11-01', '2026-11-13').subscribe();
      const req = http.expectOne((r) => r.url === `${REL}/faturamento`);
      expect(req.request.params.keys().sort()).toEqual(['fim', 'inicio']);
      req.flush({});
    });

    it('relatorioVendasPorFuncionario: GET com inicio e fim', () => {
      let resp: unknown;
      api.relatorioVendasPorFuncionario('2026-11-01', '2026-11-13').subscribe((r) => (resp = r));
      const req = http.expectOne((r) => r.url === `${REL}/vendas-por-funcionario`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().sort()).toEqual(['fim', 'inicio']);
      expect(req.request.params.get('inicio')).toBe('2026-11-01');
      expect(req.request.params.get('fim')).toBe('2026-11-13');
      req.flush([{ funcionarioId: 'f1' }]);
      expect(resp).toEqual([{ funcionarioId: 'f1' }]);
    });
  });

  describe('ultimoPreco', () => {
    const URL = `${BASE}/ultimo-preco`;

    it('envia clienteId, produtoId e marcaId e devolve o corpo no 200', () => {
      let resp: unknown;
      api.ultimoPreco('c-1', 'p-1', 'm-1').subscribe((r) => (resp = r));
      const req = http.expectOne((r) => r.url === URL);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('clienteId')).toBe('c-1');
      expect(req.request.params.get('produtoId')).toBe('p-1');
      expect(req.request.params.get('marcaId')).toBe('m-1');
      const corpo = { vendaId: 'v-1', data: '2026-11-01T10:00:00', precoUnitario: 12 };
      req.flush(corpo);
      expect(resp).toEqual(corpo);
    });

    it('204 devolve null', () => {
      let resp: unknown = 'pendente';
      api.ultimoPreco('c-1', 'p-1', 'm-1').subscribe((r) => (resp = r));
      http.expectOne((r) => r.url === URL).flush(null, { status: 204, statusText: 'No Content' });
      expect(resp).toBeNull();
    });
  });
});
