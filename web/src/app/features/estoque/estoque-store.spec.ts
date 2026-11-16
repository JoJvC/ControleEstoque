import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigStore } from '../../core/config/app-config';
import { EstoqueCascoResponse } from '../../core/api/models/estoque';
import { marcaResp, produtoResp } from '../../core/api/testing';
import { EstoqueStore } from './estoque-store';

const BASE = '/api/estoque/v1';
const PRODUTO = produtoResp({
  id: 'p1',
  nome: 'Água 20L',
  estoqueGeral: 7,
  marcas: [marcaResp({ id: 'pm1', quantidade: 7 })],
});
const CASCO: EstoqueCascoResponse = {
  tipoCascoId: 't1',
  nome: 'Casco 20L',
  marcaId: null,
  marca: null,
  aceitaSucata: true,
  vazios: 3,
  sucata: 1,
};

function criarStore(): { store: EstoqueStore; http: HttpTestingController } {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
    ],
  });
  return { store: TestBed.inject(EstoqueStore), http: TestBed.inject(HttpTestingController) };
}

function responder(http: HttpTestingController, produtos = [PRODUTO], cascos = [CASCO]): void {
  http.expectOne(`${BASE}/produtos`).flush(produtos);
  http.expectOne(`${BASE}/estoque/cascos`).flush(cascos);
}

describe('EstoqueStore', () => {
  it('carregar busca /produtos e /estoque/cascos e muda o status para ok', () => {
    const { store, http } = criarStore();

    store.carregar();
    expect(store.status()).toBe('loading');
    responder(http);

    expect(store.status()).toBe('ok');
    expect(store.produtos()).toEqual([PRODUTO]);
    expect(store.cascos()).toEqual([CASCO]);
    expect(store.erro()).toBeNull();
    http.verify();
  });

  it('itens é uma linha por produto+marca, com os números do servidor', () => {
    const { store, http } = criarStore();
    store.carregar();
    responder(http);
    expect(store.itens()).toEqual([
      expect.objectContaining({ produtoMarcaId: 'pm1', produtoId: 'p1', quantidade: 7 }),
    ]);
  });

  it('carregar com falha muda o status para error e expõe o erro', () => {
    const { store, http } = criarStore();

    store.carregar();
    http.expectOne(`${BASE}/produtos`).flush(null, { status: 500, statusText: 'Erro' });

    expect(store.status()).toBe('error');
    expect(store.erro()).not.toBeNull();
    http.verify({ ignoreCancelled: true });
  });

  it('ajustar envia produtoMarcaId e recarrega do servidor', async () => {
    const { store, http } = criarStore();

    const ajuste = store.ajustar({ produtoMarcaId: 'pm1', quantidade: -2, observacao: null });
    const req = http.expectOne(`${BASE}/estoque/movimentos`);
    expect(req.request.body).toEqual({ produtoMarcaId: 'pm1', quantidade: -2, observacao: null });
    req.flush(null, { status: 201, statusText: 'Created' });
    await ajuste;

    responder(http, [{ ...PRODUTO, estoqueGeral: 5 }]);
    expect(store.produtos()[0].estoqueGeral).toBe(5);
    http.verify();
  });

  it('baixarCasco envia tipoCascoId e recarrega os cascos', async () => {
    const { store, http } = criarStore();

    const baixa = store.baixarCasco({
      tipoCascoId: 't1',
      quantidade: 1,
      motivo: 'quebra',
      responsaveisIds: ['f1'],
    });
    const req = http.expectOne(`${BASE}/estoque/cascos/baixas`);
    expect(req.request.body).toEqual({
      tipoCascoId: 't1',
      quantidade: 1,
      motivo: 'quebra',
      responsaveisIds: ['f1'],
    });
    req.flush({ id: 'b1' }, { status: 201, statusText: 'Created' });
    await baixa;

    responder(http, [PRODUTO], [{ ...CASCO, vazios: 2, sucata: 2 }]);
    expect(store.cascos()[0]).toEqual(expect.objectContaining({ vazios: 2, sucata: 2 }));
    expect(store.status()).toBe('ok');
    http.verify();
  });
});
