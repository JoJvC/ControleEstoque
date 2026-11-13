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
});
