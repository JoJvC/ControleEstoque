import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigStore } from '../config/app-config';
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
  const body = { chave: 'valor' } as never;

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
    api.adicionarPagamento(ID, body).subscribe();
    const req = http.expectOne(`${BASE}/${ID}/pagamentos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
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
});
