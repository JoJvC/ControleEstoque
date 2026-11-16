import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigStore } from '../config/app-config';
import { EstoqueApi } from './estoque-api';

describe('EstoqueApi', () => {
  let api: EstoqueApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      ],
    });
    api = TestBed.inject(EstoqueApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const ID = 'p-1';
  const BASE = '/api/estoque/v1';
  const body = { chave: 'valor' } as never;

  it('listarMarcas: GET /marcas', () => {
    let resp: unknown;
    api.listarMarcas().subscribe((r) => (resp = r));
    const req = http.expectOne(`${BASE}/marcas`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'm1' }]);
    expect(resp).toEqual([{ id: 'm1' }]);
  });

  it('criarMarca: POST /marcas com o corpo', () => {
    api.criarMarca(body).subscribe();
    const req = http.expectOne(`${BASE}/marcas`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('listarProdutos: envia tipo, marcaId e categoria', () => {
    api.listarProdutos({ tipo: 'RETORNAVEL', marcaId: 'm1', categoria: 'agua' }).subscribe();
    const req = http.expectOne((r) => r.url === `${BASE}/produtos`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('tipo')).toBe('RETORNAVEL');
    expect(req.request.params.get('marcaId')).toBe('m1');
    expect(req.request.params.get('categoria')).toBe('agua');
    req.flush([]);
  });

  it('listarProdutos: sem filtros não envia query params', () => {
    api.listarProdutos().subscribe();
    const req = http.expectOne((r) => r.url === `${BASE}/produtos`);
    expect(req.request.params.keys()).toEqual([]);
    req.flush([]);
  });

  it('obterProduto: GET /produtos/{id}', () => {
    api.obterProduto(ID).subscribe();
    const req = http.expectOne(`${BASE}/produtos/${ID}`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('criarProduto: POST /produtos com o corpo', () => {
    api.criarProduto(body).subscribe();
    const req = http.expectOne(`${BASE}/produtos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('atualizarProduto: PUT /produtos/{id} com o corpo', () => {
    api.atualizarProduto(ID, body).subscribe();
    const req = http.expectOne(`${BASE}/produtos/${ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('adicionarMarca: POST /produtos/{id}/marcas com o corpo', () => {
    api.adicionarMarca(ID, body).subscribe();
    const req = http.expectOne(`${BASE}/produtos/${ID}/marcas`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('atualizarMarca: PUT /produtos/{id}/marcas/{pmId} com o corpo', () => {
    api.atualizarMarca(ID, 'pm-1', body).subscribe();
    const req = http.expectOne(`${BASE}/produtos/${ID}/marcas/pm-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('enviarFotoMarca: POST na associação com FormData no campo foto', () => {
    const file = new File(['x'], 'foto.png', { type: 'image/png' });
    let resp: unknown;
    api.enviarFotoMarca(ID, 'pm-1', file).subscribe((r) => (resp = r));
    const req = http.expectOne(`${BASE}/produtos/${ID}/marcas/pm-1/foto`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    const enviado = (req.request.body as FormData).get('foto') as File;
    expect(enviado.name).toBe('foto.png');
    req.flush({ fotoUrl: 'u' });
    expect(resp).toEqual({ fotoUrl: 'u' });
  });

  it('urlFotoMarca: mesma rota da foto da associação', () => {
    expect(api.urlFotoMarca(ID, 'pm-1')).toBe(`${BASE}/produtos/${ID}/marcas/pm-1/foto`);
  });

  it('obterEstoque: GET /estoque', () => {
    api.obterEstoque().subscribe();
    const req = http.expectOne(`${BASE}/estoque`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('obterEstoqueCascos: GET /estoque/cascos', () => {
    api.obterEstoqueCascos().subscribe();
    const req = http.expectOne(`${BASE}/estoque/cascos`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('criarMovimento: POST /estoque/movimentos com o corpo', () => {
    api.criarMovimento(body).subscribe();
    const req = http.expectOne(`${BASE}/estoque/movimentos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush(null);
  });

  it('criarAbastecimento: POST /abastecimentos com o corpo', () => {
    api.criarAbastecimento(body).subscribe();
    const req = http.expectOne(`${BASE}/abastecimentos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ id: 'a1' });
  });

  it('lancarCustosAbastecimento: PUT /abastecimentos/{id}/custos com o corpo', () => {
    let resp: unknown;
    api.lancarCustosAbastecimento('a1', body).subscribe((r) => (resp = r));
    const req = http.expectOne(`${BASE}/abastecimentos/a1/custos`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({ id: 'a1', custoTotal: 548 });
    expect(resp).toEqual({ id: 'a1', custoTotal: 548 });
  });

  it('obterAbastecimento: GET /abastecimentos/{id} com funcionarioId na query', () => {
    api.obterAbastecimento('a1', 'f1').subscribe();
    const req = http.expectOne((r) => r.url === `${BASE}/abastecimentos/a1`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('funcionarioId')).toBe('f1');
    req.flush({ id: 'a1' });
  });

  it('listarCustosPendentes: GET /abastecimentos/custos-pendentes com funcionarioId na query', () => {
    let resp: unknown;
    api.listarCustosPendentes('f1').subscribe((r) => (resp = r));
    const req = http.expectOne((r) => r.url === `${BASE}/abastecimentos/custos-pendentes`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('funcionarioId')).toBe('f1');
    req.flush([{ id: 'a1' }]);
    expect(resp).toEqual([{ id: 'a1' }]);
  });

  it('criarBaixaCasco: POST /estoque/cascos/baixas com o corpo', () => {
    api.criarBaixaCasco(body).subscribe();
    const req = http.expectOne(`${BASE}/estoque/cascos/baixas`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ id: 'b1' });
  });

  it('relatorioEstoque: GET /relatorios/estoque sem query repassa o wrapper', () => {
    let resp: unknown;
    api.relatorioEstoque().subscribe((r) => (resp = r));
    const req = http.expectOne(`${BASE}/relatorios/estoque`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    const corpo = { itens: [{ produtoId: 'p1' }], alertasEstoqueMinimo: [] };
    req.flush(corpo);
    expect(resp).toEqual(corpo);
  });

  it('listarTiposCasco: GET /tipos-casco', () => {
    let resp: unknown;
    api.listarTiposCasco().subscribe((r) => (resp = r));
    const req = http.expectOne(`${BASE}/tipos-casco`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 't1' }]);
    expect(resp).toEqual([{ id: 't1' }]);
  });

  it('criarTipoCasco: POST /tipos-casco com o corpo', () => {
    api.criarTipoCasco(body).subscribe();
    const req = http.expectOne(`${BASE}/tipos-casco`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(body);
    req.flush({});
  });

  it('atualizarTipoCasco: PUT /tipos-casco/{id} com o corpo', () => {
    api.atualizarTipoCasco('t-1', body).subscribe();
    const req = http.expectOne(`${BASE}/tipos-casco/t-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toBe(body);
    req.flush({});
  });
});
