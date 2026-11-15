import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { ApiError } from '../../core/http/api-error';
import { ContaCorrenteStore } from './conta-corrente-store';

const URL = '/api/rh/v1/funcionarios/f1';
const DIARIA = {
  id: 'l1',
  tipo: 'DIARIA',
  valor: 100,
  data: '2026-11-13T10:00:00Z',
  observacao: null,
};
const VALE = { id: 'l2', tipo: 'VALE', valor: 30, data: '2026-11-13T11:00:00Z', observacao: 'x' };

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('ContaCorrenteStore', () => {
  let store: ContaCorrenteStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      ],
    });
    store = TestBed.inject(ContaCorrenteStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function carregarInicial() {
    const p = store.carregar('f1');
    http
      .expectOne(`${URL}/conta-corrente`)
      .flush({ funcionarioId: 'f1', saldoAPagar: 100, lancamentos: [DIARIA] });
    await p;
  }

  it('carregar: alimenta lancamentos e saldoAPagar', async () => {
    await carregarInicial();
    expect(store.lancamentos()).toEqual([DIARIA]);
    expect(store.saldoAPagar()).toBe(100);
    expect(store.status()).toBe('ok');
  });

  it('lancarVale: grava o saldo da resposta e recarrega o extrato', async () => {
    await carregarInicial();
    const p = store.lancarVale('f1', { valor: 30, observacao: 'x' });
    const req = http.expectOne(`${URL}/vales`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ valor: 30, observacao: 'x' });
    req.flush({ saldoAPagar: 70 }, { status: 201, statusText: 'Created' });
    await tick();
    expect(store.saldoAPagar()).toBe(70);
    http
      .expectOne(`${URL}/conta-corrente`)
      .flush({ funcionarioId: 'f1', saldoAPagar: 70, lancamentos: [DIARIA, VALE] });
    await p;
    expect(store.lancamentos()).toEqual([DIARIA, VALE]);
  });

  it('refetch com sucesso: lista e âncora se atualizam juntas', async () => {
    await carregarInicial();
    const p = store.lancarVale('f1', { valor: 30, observacao: null });
    http
      .expectOne(`${URL}/vales`)
      .flush({ saldoAPagar: 70 }, { status: 201, statusText: 'Created' });
    await tick();
    http
      .expectOne(`${URL}/conta-corrente`)
      .flush({ funcionarioId: 'f1', saldoAPagar: 70, lancamentos: [DIARIA, VALE] });
    await p;
    expect(store.extrato().map((l) => l.saldoApos)).toEqual([70, 100]);
  });

  it('refetch com falha: a lista mantém a âncora antiga e o saldo é o do POST', async () => {
    await carregarInicial();
    const p = store.lancarVale('f1', { valor: 30, observacao: null });
    http
      .expectOne(`${URL}/vales`)
      .flush({ saldoAPagar: 70 }, { status: 201, statusText: 'Created' });
    await tick();
    http.expectOne(`${URL}/conta-corrente`).flush({}, { status: 500, statusText: 'x' });
    await p;
    expect(store.saldoAPagar()).toBe(70);
    expect(store.extrato().map((l) => l.saldoApos)).toEqual([100]);
  });

  it('lancarPagamento: grava o saldo da resposta e recarrega a lista', async () => {
    await carregarInicial();
    const p = store.lancarPagamento('f1', { valor: 100, observacao: null });
    const req = http.expectOne(`${URL}/pagamentos`);
    expect(req.request.method).toBe('POST');
    req.flush({ saldoAPagar: 0 }, { status: 201, statusText: 'Created' });
    await tick();
    http
      .expectOne(`${URL}/conta-corrente`)
      .flush({ funcionarioId: 'f1', saldoAPagar: 0, lancamentos: [DIARIA, VALE] });
    await p;
    expect(store.saldoAPagar()).toBe(0);
    expect(store.lancamentos()).toEqual([DIARIA, VALE]);
  });

  it('422 PAGAMENTO_EXCEDE_SALDO sobe como ApiError sem mudar o saldo', async () => {
    await carregarInicial();
    const p = store.lancarPagamento('f1', { valor: 500, observacao: null });
    http
      .expectOne(`${URL}/pagamentos`)
      .flush(
        { code: 'PAGAMENTO_EXCEDE_SALDO', message: 'm', traceId: 't' },
        { status: 422, statusText: 'Unprocessable' },
      );
    const e = await p.catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).code).toBe('PAGAMENTO_EXCEDE_SALDO');
    expect(store.saldoAPagar()).toBe(100);
  });

  it('carregar de outro funcionário que falha não mantém o saldo do anterior', async () => {
    await carregarInicial();
    const p = store.carregar('f2');
    http
      .expectOne('/api/rh/v1/funcionarios/f2/conta-corrente')
      .flush({}, { status: 500, statusText: 'x' });
    await p;
    expect(store.status()).toBe('error');
    expect(store.saldoAPagar()).toBe(0);
    expect(store.lancamentos()).toEqual([]);
  });
});
