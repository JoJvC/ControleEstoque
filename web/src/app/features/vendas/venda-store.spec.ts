import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CupomFiscalResponse } from '../../core/api/models/vendas';
import { ConfigStore } from '../../core/config/app-config';
import { VendaStore } from './venda-store';

const URL_CUPOM = '/api/vendas/v1/vendas/v-1/cupom-fiscal';

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
