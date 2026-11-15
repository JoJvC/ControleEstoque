import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigStore } from '../../core/config/app-config';
import { ApiError } from '../../core/http/api-error';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { TiposCascoStore } from './tipos-casco-store';

const URL = '/api/estoque/v1/tipos-casco';
const GALAO = {
  id: 't1',
  nome: 'Galão 20L',
  marcaId: null,
  marca: null,
  precoVasilhame: 12,
  aceitaSucata: true,
};
const CASCATAI = {
  id: 't2',
  nome: 'Galão 20L Cascataí',
  marcaId: 'm1',
  marca: 'Cascataí',
  precoVasilhame: 15,
  aceitaSucata: false,
};

describe('TiposCascoStore', () => {
  let store: TiposCascoStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      ],
    });
    store = TestBed.inject(TiposCascoStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function carregado(lista = [GALAO]) {
    const p = store.carregar();
    http.expectOne(URL).flush(lista);
    await p;
  }

  it('carregar: GET e status ok', async () => {
    const p = store.carregar();
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('GET');
    req.flush([GALAO]);
    await p;
    expect(store.tipos()).toEqual([GALAO]);
    expect(store.status()).toBe('ok');
  });

  it('criar: POST com marcaId null e o item entra na lista', async () => {
    await carregado([]);
    const req = { nome: 'Galão 20L', marcaId: null, precoVasilhame: 12, aceitaSucata: true };
    const p = store.criar(req);
    const r = http.expectOne(URL);
    expect(r.request.method).toBe('POST');
    expect(r.request.body).toEqual(req);
    r.flush(GALAO);
    await p;
    expect(store.tipos()).toEqual([GALAO]);
  });

  it('criar com marca: POST com o marcaId informado e o item entra ordenado', async () => {
    await carregado();
    const req = {
      nome: CASCATAI.nome,
      marcaId: 'm1',
      precoVasilhame: 15,
      aceitaSucata: false,
    };
    const p = store.criar(req);
    const r = http.expectOne(URL);
    expect(r.request.body.marcaId).toBe('m1');
    r.flush(CASCATAI);
    await p;
    expect(store.tipos().map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('atualizar: PUT com o marcaId do req (diferente do original) e substitui o item', async () => {
    await carregado();
    const req = { nome: 'Galão 20L', marcaId: 'm1', precoVasilhame: 13, aceitaSucata: true };
    const p = store.atualizar('t1', req);
    const r = http.expectOne(`${URL}/t1`);
    expect(r.request.method).toBe('PUT');
    expect(r.request.body).toEqual(req);
    const novo = { ...GALAO, marcaId: 'm1', marca: 'Cascataí', precoVasilhame: 13 };
    r.flush(novo);
    await p;
    expect(store.tipos()).toEqual([novo]);
  });

  it('422 em atualizar: lança ApiError e mantém a lista', async () => {
    await carregado();
    const p = store.atualizar('t1', {
      nome: 'Galão 20L',
      marcaId: 'm1',
      precoVasilhame: 12,
      aceitaSucata: true,
    });
    http
      .expectOne(`${URL}/t1`)
      .flush(
        { code: 'TIPO_CASCO_EM_USO', message: 'Em uso.' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    await expect(p).rejects.toBeInstanceOf(ApiError);
    expect(store.tipos()).toEqual([GALAO]);
  });
});
