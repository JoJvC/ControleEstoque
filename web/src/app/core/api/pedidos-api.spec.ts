import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigStore } from '../config/app-config';
import { PedidosApi } from './pedidos-api';

describe('PedidosApi', () => {
  let api: PedidosApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      ],
    });
    api = TestBed.inject(PedidosApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const BASE = '/api/vendas/v1/pedidos';
  const ID = 'p-1';
  const body = { chave: 'valor' } as never;

  it('listar: envia status, page e pageSize e repassa o array', () => {
    let resp: unknown;
    api.listar('PENDENTE', 2, 10).subscribe((r) => (resp = r));
    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('PENDENTE');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('10');
    req.flush([{ id: ID }]);
    expect(resp).toEqual([{ id: ID }]);
  });

  it('listar: status null não envia status; padrão page 1 e pageSize 50', () => {
    api.listar(null).subscribe();
    const req = http.expectOne((r) => r.url === BASE);
    expect(req.request.params.has('status')).toBe(false);
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('50');
    req.flush([]);
  });

  it('obter: GET /pedidos/{id}', () => {
    let resp: unknown;
    api.obter(ID).subscribe((r) => (resp = r));
    const req = http.expectOne(`${BASE}/${ID}`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: ID });
    expect(resp).toEqual({ id: ID });
  });

  it('criar: POST /pedidos com o corpo', () => {
    api.criar(body).subscribe();
    const req = http.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(body);
    req.flush({ id: ID });
  });

  it('iniciar: POST /pedidos/{id}/inicio com o corpo', () => {
    api.iniciar(ID, body).subscribe();
    const req = http.expectOne(`${BASE}/${ID}/inicio`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(body);
    req.flush({ id: ID });
  });

  it('cancelar: POST /pedidos/{id}/cancelamento com o corpo', () => {
    api.cancelar(ID, body).subscribe();
    const req = http.expectOne(`${BASE}/${ID}/cancelamento`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(body);
    req.flush({ id: ID });
  });

  it('concluir: POST /pedidos/{id}/conclusao com o corpo e devolve a venda', () => {
    let resp: unknown;
    api.concluir(ID, body).subscribe((r) => (resp = r));
    const req = http.expectOne(`${BASE}/${ID}/conclusao`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(body);
    req.flush({ id: 'v-1' });
    expect(resp).toEqual({ id: 'v-1' });
  });

  it('registrarPerdas: POST /pedidos/{id}/perdas com o corpo e devolve o pedido', () => {
    let resp: unknown;
    api.registrarPerdas(ID, body).subscribe((r) => (resp = r));
    const req = http.expectOne(`${BASE}/${ID}/perdas`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(body);
    req.flush({ id: ID, perdas: [] });
    expect(resp).toEqual({ id: ID, perdas: [] });
  });
});
