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
    api.listarProdutos({ tipo: 'CASCO', marcaId: 'm1', categoria: 'agua' }).subscribe();
    const req = http.expectOne((r) => r.url === `${BASE}/produtos`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('tipo')).toBe('CASCO');
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

  it('enviarFoto: POST /produtos/{id}/foto com FormData no campo foto', () => {
    const file = new File(['x'], 'foto.png', { type: 'image/png' });
    let resp: unknown;
    api.enviarFoto(ID, file).subscribe((r) => (resp = r));
    const req = http.expectOne(`${BASE}/produtos/${ID}/foto`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    const enviado = (req.request.body as FormData).get('foto') as File;
    expect(enviado.name).toBe('foto.png');
    req.flush({ url: 'u' });
    expect(resp).toEqual({ url: 'u' });
  });

  it('urlFoto: mesma rota da foto', () => {
    expect(api.urlFoto(ID)).toBe(`${BASE}/produtos/${ID}/foto`);
  });

  it('obterEstoque: GET /estoque', () => {
    api.obterEstoque().subscribe();
    const req = http.expectOne(`${BASE}/estoque`);
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

  it('criarBaixaCasco: POST /estoque/cascos/baixas com o corpo', () => {
    api.criarBaixaCasco(body).subscribe();
    const req = http.expectOne(`${BASE}/estoque/cascos/baixas`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ id: 'b1' });
  });
});
