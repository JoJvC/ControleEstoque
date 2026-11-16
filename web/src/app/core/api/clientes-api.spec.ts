import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigStore } from '../config/app-config';
import { ClientesApi } from './clientes-api';

describe('ClientesApi', () => {
  let api: ClientesApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      ],
    });
    api = TestBed.inject(ClientesApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const ID = 'c-1';
  const BASE = '/api/clientes/v1/clientes';
  const body = { chave: 'valor' } as never;

  it('listar: envia nome, page e pageSize e repassa o array', () => {
    let resp: unknown;
    api.listar('ana', 3, 10).subscribe((r) => (resp = r));
    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('nome')).toBe('ana');
    expect(req.request.params.get('page')).toBe('3');
    expect(req.request.params.get('pageSize')).toBe('10');
    req.flush([{ id: ID }]);
    expect(resp).toEqual([{ id: ID }]);
  });

  it('listar: nome vazio não envia nome; pageSize padrão 20', () => {
    api.listar('', 1).subscribe();
    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.params.has('nome')).toBe(false);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush([]);
  });

  it('obter: GET /clientes/{id}', () => {
    let resp: unknown;
    api.obter(ID).subscribe((r) => (resp = r));
    const req = http.expectOne(`${BASE}/${ID}`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: ID });
    expect(resp).toEqual({ id: ID });
  });

  it('criar: POST /clientes com o corpo', () => {
    api.criar(body).subscribe();
    const req = http.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('atualizar: PUT /clientes/{id} com o corpo', () => {
    api.atualizar(ID, body).subscribe();
    const req = http.expectOne(`${BASE}/${ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('adicionarEndereco: POST /clientes/{id}/enderecos com o corpo', () => {
    api.adicionarEndereco(ID, body).subscribe();
    const req = http.expectOne(`${BASE}/${ID}/enderecos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('atualizarEndereco: PUT /clientes/{id}/enderecos/{enderecoId} com o corpo', () => {
    api.atualizarEndereco(ID, 'e-1', body).subscribe();
    const req = http.expectOne(`${BASE}/${ID}/enderecos/e-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('removerEndereco: DELETE /clientes/{id}/enderecos/{enderecoId}', () => {
    api.removerEndereco(ID, 'e-1').subscribe();
    const req = http.expectOne(`${BASE}/${ID}/enderecos/e-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('obterSaldos: GET /clientes/{id}/saldos', () => {
    let resp: unknown;
    api.obterSaldos(ID).subscribe((r) => (resp = r));
    const req = http.expectOne(`${BASE}/${ID}/saldos`);
    expect(req.request.method).toBe('GET');
    req.flush({ saldoCascos: 2 });
    expect(resp).toEqual({ saldoCascos: 2 });
  });

  it('devolverCascos: POST /clientes/{id}/cascos/devolucoes com { linhas }', () => {
    const linhas = [
      { tipoCascoId: 't-1', quantidade: 2 },
      { tipoCascoId: 't-2', quantidade: 1 },
    ];
    api.devolverCascos(ID, { linhas }).subscribe();
    const req = http.expectOne(`${BASE}/${ID}/cascos/devolucoes`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ linhas });
    req.flush({});
  });

  it('entregarSucata: POST /clientes/{id}/sucatas com o corpo', () => {
    api.entregarSucata(ID, body).subscribe();
    const req = http.expectOne(`${BASE}/${ID}/sucatas`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('relatorioCascos: GET /relatorios/cascos sem query', () => {
    let resp: unknown;
    api.relatorioCascos().subscribe((r) => (resp = r));
    const req = http.expectOne('/api/clientes/v1/relatorios/cascos');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([{ clienteId: 'c1' }]);
    expect(resp).toEqual([{ clienteId: 'c1' }]);
  });

  it('totalCascos: GET /relatorios/cascos/total', () => {
    let resp: unknown;
    api.totalCascos().subscribe((r) => (resp = r));
    const req = http.expectOne('/api/clientes/v1/relatorios/cascos/total');
    expect(req.request.method).toBe('GET');
    req.flush({ totalCascos: 7 });
    expect(resp).toEqual({ totalCascos: 7 });
  });

  it('relatorioSucata: GET /relatorios/sucata sem query', () => {
    let resp: unknown;
    api.relatorioSucata().subscribe((r) => (resp = r));
    const req = http.expectOne('/api/clientes/v1/relatorios/sucata');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([{ clienteId: 'c1' }]);
    expect(resp).toEqual([{ clienteId: 'c1' }]);
  });
});
