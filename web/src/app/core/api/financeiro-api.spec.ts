import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigStore } from '../config/app-config';
import { FinanceiroApi } from './financeiro-api';

describe('FinanceiroApi', () => {
  let api: FinanceiroApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      ],
    });
    api = TestBed.inject(FinanceiroApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pagarFiado: POST /clientes/{id}/fiado/pagamentos com { valor, forma }', () => {
    let resp: unknown;
    api.pagarFiado('c-1', { valor: 50, forma: 'PIX' }).subscribe((r) => (resp = r));
    const req = http.expectOne('/api/financeiro/v1/clientes/c-1/fiado/pagamentos');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ valor: 50, forma: 'PIX' });
    req.flush({ novoSaldoFiado: 10 });
    expect(resp).toEqual({ novoSaldoFiado: 10 });
  });

  const BASE = '/api/financeiro/v1';

  it('abrirCaixa: POST /caixas com { data, saldoInicial }', () => {
    api.abrirCaixa({ data: '2026-11-13', saldoInicial: 150 }).subscribe();
    const req = http.expectOne(`${BASE}/caixas`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ data: '2026-11-13', saldoInicial: 150 });
    req.flush({});
  });

  it('obterResumoCaixa: GET /caixas/{data}', () => {
    api.obterResumoCaixa('2026-11-13').subscribe();
    const req = http.expectOne(`${BASE}/caixas/2026-11-13`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('lancarDespesa: POST /caixas/{id}/despesas com o corpo', () => {
    api.lancarDespesa('cx-1', { tipoDespesaId: 't-1', valor: 20, descricao: null }).subscribe();
    const req = http.expectOne(`${BASE}/caixas/cx-1/despesas`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ tipoDespesaId: 't-1', valor: 20, descricao: null });
    req.flush(null, { status: 201, statusText: 'Created' });
  });

  it('fecharCaixa: POST /caixas/{id}/fechamento com { diarias }', () => {
    api.fecharCaixa('cx-1', { diarias: [{ funcionarioId: 'f-1' }] }).subscribe();
    const req = http.expectOne(`${BASE}/caixas/cx-1/fechamento`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ diarias: [{ funcionarioId: 'f-1' }] });
    req.flush({});
  });

  it('listarTiposDespesa: GET /tipos-despesa', () => {
    api.listarTiposDespesa().subscribe();
    const req = http.expectOne(`${BASE}/tipos-despesa`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('criarTipoDespesa: POST /tipos-despesa com { nome }', () => {
    api.criarTipoDespesa({ nome: 'Luz' }).subscribe();
    const req = http.expectOne(`${BASE}/tipos-despesa`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nome: 'Luz' });
    req.flush({ id: 't-1', nome: 'Luz' });
  });

  it('relatorioCaixa: GET /relatorios/caixa com inicio e fim', () => {
    let resp: unknown;
    api.relatorioCaixa('2026-11-01', '2026-11-13').subscribe((r) => (resp = r));
    const req = http.expectOne((r) => r.url === `${BASE}/relatorios/caixa`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().sort()).toEqual(['fim', 'inicio']);
    expect(req.request.params.get('inicio')).toBe('2026-11-01');
    expect(req.request.params.get('fim')).toBe('2026-11-13');
    req.flush({ dias: [], despesasPorTipo: [] });
    expect(resp).toEqual({ dias: [], despesasPorTipo: [] });
  });

  it('relatorioFiado: GET /relatorios/fiado sem query', () => {
    let resp: unknown;
    api.relatorioFiado().subscribe((r) => (resp = r));
    const req = http.expectOne(`${BASE}/relatorios/fiado`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([{ clienteId: 'c1' }]);
    expect(resp).toEqual([{ clienteId: 'c1' }]);
  });

  it('totalFiado: GET /relatorios/fiado/total', () => {
    let resp: unknown;
    api.totalFiado().subscribe((r) => (resp = r));
    const req = http.expectOne(`${BASE}/relatorios/fiado/total`);
    expect(req.request.method).toBe('GET');
    req.flush({ totalAReceber: 350 });
    expect(resp).toEqual({ totalAReceber: 350 });
  });
});
