import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigStore } from '../../core/config/app-config';
import { ApiError } from '../../core/http/api-error';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { hojeLocal } from '../../core/util/data-local';
import { CaixaStore } from './caixa-store';

const BASE = '/api/financeiro/v1';
const RESUMO = {
  caixa: {
    id: 'cx-1',
    data: '2026-11-13',
    status: 'ABERTO',
    saldoInicial: 100,
    totalEntradas: null,
    totalSaidas: null,
    saldoFinal: null,
  },
  entradas: 50,
  totalDespesas: 10,
  saldoParcial: 140,
  despesas: [],
};

function erro(code: string, status: number) {
  return [
    { code, message: 'x', traceId: 't' },
    { status, statusText: 'Erro' },
  ] as const;
}

describe('CaixaStore', () => {
  let store: CaixaStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      ],
    });
    store = TestBed.inject(CaixaStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('carregar 200 dá ok com o resumo do servidor', async () => {
    const p = store.carregar('2026-11-13');
    expect(store.status()).toBe('loading');
    http.expectOne(`${BASE}/caixas/2026-11-13`).flush(RESUMO);
    await p;
    expect(store.status()).toBe('ok');
    expect(store.resumo()).toEqual(RESUMO);
  });

  it('carregar 404 CAIXA_NAO_ENCONTRADO dá nao-aberto', async () => {
    const p = store.carregar('2026-11-13');
    http.expectOne(`${BASE}/caixas/2026-11-13`).flush(...erro('CAIXA_NAO_ENCONTRADO', 404));
    await p;
    expect(store.status()).toBe('nao-aberto');
    expect(store.resumo()).toBeNull();
  });

  it('carregar com 500 dá error', async () => {
    const p = store.carregar('2026-11-13');
    http.expectOne(`${BASE}/caixas/2026-11-13`).flush(...erro('ERRO', 500));
    await p;
    expect(store.status()).toBe('error');
  });

  it('abrir 201 é seguido de GET da data local', async () => {
    const hoje = hojeLocal();
    const p = store.abrir(150);
    const post = http.expectOne(`${BASE}/caixas`);
    expect(post.request.body).toEqual({ data: hoje, saldoInicial: 150 });
    post.flush({}, { status: 201, statusText: 'Created' });
    await new Promise((r) => setTimeout(r, 0));
    http.expectOne(`${BASE}/caixas/${hoje}`).flush(RESUMO);
    await p;
    expect(store.status()).toBe('ok');
  });

  it('abrir 409 CAIXA_JA_EXISTE carrega e resolve sem erro', async () => {
    const hoje = hojeLocal();
    const p = store.abrir(150);
    http.expectOne(`${BASE}/caixas`).flush(...erro('CAIXA_JA_EXISTE', 409));
    await new Promise((r) => setTimeout(r, 0));
    http.expectOne(`${BASE}/caixas/${hoje}`).flush(RESUMO);
    await expect(p).resolves.toBeUndefined();
    expect(store.status()).toBe('ok');
  });

  it('abrir 400 SALDO_INVALIDO rejeita e não consulta', async () => {
    const p = store.abrir(-1);
    http.expectOne(`${BASE}/caixas`).flush(...erro('SALDO_INVALIDO', 400));
    await expect(p).rejects.toMatchObject({ code: 'SALDO_INVALIDO' });
  });

  it('lancarDespesa 409 rejeita com ApiError CAIXA_FECHADO', async () => {
    const p = store.lancarDespesa('cx-1', 't-1', 10, null);
    http.expectOne(`${BASE}/caixas/cx-1/despesas`).flush(...erro('CAIXA_FECHADO', 409));
    const e = await p.catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).code).toBe('CAIXA_FECHADO');
  });

  it('fechar envia id e valor de cada diária', async () => {
    const p = store.fechar('cx-1', [
      { funcionarioId: 'f-1', valor: 100 },
      { funcionarioId: 'f-3', valor: 0 },
    ]);
    const req = http.expectOne(`${BASE}/caixas/cx-1/fechamento`);
    expect(req.request.body).toEqual({
      diarias: [
        { funcionarioId: 'f-1', valor: 100 },
        { funcionarioId: 'f-3', valor: 0 },
      ],
    });
    req.flush({ diariasLancadas: 2 });
    await expect(p).resolves.toEqual({ diariasLancadas: 2 });
  });
});
