import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigStore } from '../../core/config/app-config';
import { FuncionariosStore } from './funcionarios-store';

const URL = '/api/rh/v1/funcionarios';
const ANA = {
  id: 'f1',
  nome: 'Ana',
  telefone: null,
  cargoId: 'c1',
  cargo: 'Caixa',
  valorDiaria: 100,
  ativo: true,
};
const REQ = { nome: 'Ana', telefone: null, cargoId: 'c1', valorDiaria: 100, ativo: true };

describe('FuncionariosStore', () => {
  let store: FuncionariosStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      ],
    });
    store = TestBed.inject(FuncionariosStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('carregar: alimenta a lista e o status', async () => {
    const p = store.carregar();
    expect(store.status()).toBe('loading');
    http.expectOne(URL).flush([ANA]);
    await p;
    expect(store.funcionarios()).toEqual([ANA]);
    expect(store.status()).toBe('ok');
  });

  it('carregar: erro vira status error', async () => {
    const p = store.carregar();
    http.expectOne(URL).flush({}, { status: 500, statusText: 'x' });
    await p;
    expect(store.status()).toBe('error');
  });

  it('obter: GET do funcionário', async () => {
    const p = store.obter('f1');
    http.expectOne(`${URL}/f1`).flush(ANA);
    expect(await p).toEqual(ANA);
  });

  it('criar: insere o devolvido na lista', async () => {
    const p = store.criar(REQ);
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(REQ);
    req.flush({ ...ANA, cargo: null });
    await Promise.resolve();
    http.expectOne(URL).flush([ANA]);
    await p;
    expect(store.funcionarios()).toEqual([ANA]);
  });

  it('criar: falha ao recarregar a lista mantém o devolvido', async () => {
    const p = store.criar(REQ);
    http.expectOne(URL).flush({ ...ANA, cargo: null });
    await Promise.resolve();
    http.expectOne(URL).flush({}, { status: 500, statusText: 'x' });
    await p;
    expect(store.funcionarios()).toEqual([{ ...ANA, cargo: null }]);
  });

  it('atualizar: substitui o item na lista', async () => {
    const c = store.carregar();
    http.expectOne(URL).flush([ANA]);
    await c;
    const p = store.atualizar('f1', { ...REQ, ativo: false });
    const req = http.expectOne(`${URL}/f1`);
    expect(req.request.method).toBe('PUT');
    req.flush({ ...ANA, ativo: false, cargo: null });
    await Promise.resolve();
    http.expectOne(URL).flush([{ ...ANA, ativo: false }]);
    await p;
    expect(store.funcionarios()[0].ativo).toBe(false);
    expect(store.funcionarios()[0].cargo).toBe('Caixa');
  });

  it('criar: erro sobe e a lista não muda', async () => {
    const p = store.criar(REQ);
    http.expectOne(URL).flush({}, { status: 400, statusText: 'x' });
    await expect(p).rejects.toBeTruthy();
    expect(store.funcionarios()).toEqual([]);
  });
});
