import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigStore } from '../../core/config/app-config';
import { ApiError } from '../../core/http/api-error';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { CargosStore } from './cargos-store';

const URL = '/api/rh/v1/cargos';
const CAIXA = { id: 'c1', nome: 'Caixa', nativo: false, permissoes: ['vendas.registrar'] };
const ADM = { id: 'c0', nome: 'ADM', nativo: true, permissoes: ['*'] };

describe('CargosStore', () => {
  let store: CargosStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      ],
    });
    store = TestBed.inject(CargosStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('carregar: loading e depois ok', async () => {
    const p = store.carregar();
    expect(store.status()).toBe('loading');
    http.expectOne(URL).flush([ADM, CAIXA]);
    await p;
    expect(store.status()).toBe('ok');
    expect(store.cargos()).toEqual([ADM, CAIXA]);
  });

  it('carregar: falha vai para error', async () => {
    const p = store.carregar();
    http.expectOne(URL).flush(null, { status: 500, statusText: 'x' });
    await p;
    expect(store.status()).toBe('error');
  });

  it('criar: POST e acrescenta à lista', async () => {
    const p = store.criar({ nome: 'Caixa', permissoes: ['vendas.registrar'] });
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    req.flush(CAIXA, { status: 201, statusText: 'Created' });
    await p;
    expect(store.cargos()).toEqual([CAIXA]);
  });

  it('atualizar: PUT e substitui o item', async () => {
    const c = store.carregar();
    http.expectOne(URL).flush([ADM, CAIXA]);
    await c;
    const novo = { ...CAIXA, permissoes: ['vendas.registrar', 'caixa.fechar'] };
    const p = store.atualizar('c1', { nome: 'Caixa', permissoes: novo.permissoes });
    const req = http.expectOne(`${URL}/c1`);
    expect(req.request.method).toBe('PUT');
    req.flush(novo);
    await p;
    expect(store.cargos()).toEqual([ADM, novo]);
  });

  it('atualizar cargo nativo: rejeita sem requisição', async () => {
    const c = store.carregar();
    http.expectOne(URL).flush([ADM]);
    await c;
    await expect(store.atualizar('c0', { nome: 'ADM' })).rejects.toBeDefined();
    http.verify();
  });

  it('erro de mutação chega como ApiError com o code', async () => {
    const p = store.criar({ nome: '' });
    http
      .expectOne(URL)
      .flush(
        { code: 'NOME_OBRIGATORIO', message: 'x', traceId: 't' },
        { status: 400, statusText: 'Bad Request' },
      );
    const e = await p.catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).code).toBe('NOME_OBRIGATORIO');
  });
});
