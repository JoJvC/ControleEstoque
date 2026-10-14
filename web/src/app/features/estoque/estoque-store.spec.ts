import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigStore } from '../../core/config/app-config';
import { EstoqueItemResponse } from '../../core/api/models/estoque';
import { EstoqueStore } from './estoque-store';

const ITEM: EstoqueItemResponse = {
  produtoId: 'p1',
  tipo: 'CASCO',
  nome: 'Casco vazio',
  marca: null,
  categoria: null,
  tamanho: '20L',
  quantidade: 10,
  estoqueMinimo: 2,
  abaixoMinimo: false,
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

describe('EstoqueStore', () => {
  it('carregar popula os itens e muda o status para ok', () => {
    const { store, http } = criarStore();

    store.carregar();
    expect(store.status()).toBe('loading');

    http.expectOne('/api/estoque/v1/estoque').flush([ITEM]);

    expect(store.status()).toBe('ok');
    expect(store.itens()).toEqual([ITEM]);
    http.verify();
  });

  it('carregar com falha muda o status para error', () => {
    const { store, http } = criarStore();

    store.carregar();
    http.expectOne('/api/estoque/v1/estoque').flush(null, { status: 500, statusText: 'Erro' });

    expect(store.status()).toBe('error');
    http.verify();
  });

  it('ajustar envia o movimento e recarrega a lista do servidor', async () => {
    const { store, http } = criarStore();

    const ajuste = store.ajustar({ produtoId: 'p1', quantidade: -2, observacao: null });
    http
      .expectOne('/api/estoque/v1/estoque/movimentos')
      .flush(null, { status: 201, statusText: 'Created' });
    await ajuste;

    http.expectOne('/api/estoque/v1/estoque').flush([{ ...ITEM, quantidade: 8 }]);
    expect(store.itens()[0].quantidade).toBe(8);
    http.verify();
  });

  it('baixarCasco envia a baixa e recarrega a lista do servidor', async () => {
    const { store, http } = criarStore();

    const baixa = store.baixarCasco({ quantidade: 1, motivo: 'quebra', responsaveisIds: ['f1'] });
    http
      .expectOne('/api/estoque/v1/estoque/cascos/baixas')
      .flush({ id: 'b1' }, { status: 201, statusText: 'Created' });
    await baixa;

    http.expectOne('/api/estoque/v1/estoque').flush([ITEM]);
    expect(store.status()).toBe('ok');
    http.verify();
  });
});
