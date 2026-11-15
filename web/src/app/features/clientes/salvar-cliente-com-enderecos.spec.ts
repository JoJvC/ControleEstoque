import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { ClientesApi } from '../../core/api/clientes-api';
import { ClientesStore } from './clientes-store';
import { RascunhoEndereco } from './enderecos-regras';
import { salvarClienteComEnderecos } from './salvar-cliente-com-enderecos';

const rascunho = (chave: string, principal = false): RascunhoEndereco => ({
  chave,
  logradouro: chave,
  numero: null,
  bairro: null,
  complemento: null,
  referencia: null,
  principal,
});

const REQUEST = { nome: 'Ana', telefone: null, observacoes: null };

function dubleApi(falham: string[] = [], criarFalha = false) {
  return {
    criar: vi.fn((): Observable<unknown> =>
      criarFalha ? throwError(() => new Error('cliente')) : of({ id: 'c-1', nome: 'Ana' }),
    ),
    adicionarEndereco: vi.fn((_id: string, e: { logradouro: string }): Observable<unknown> =>
      falham.includes(e.logradouro)
        ? throwError(() => new Error('endereco'))
        : of({ id: `id-${e.logradouro}`, ...e }),
    ),
    listar: vi.fn(() => of([])),
  };
}

describe('salvarClienteComEnderecos', () => {
  it('tudo salvo: cria o cliente e posta cada endereço na ordem, com a flag principal', async () => {
    const api = dubleApi();
    const r = await salvarClienteComEnderecos(api as never, REQUEST, [
      rascunho('A'),
      rascunho('B', true),
    ]);
    expect(r.cliente.id).toBe('c-1');
    expect(r.falhos).toEqual([]);
    expect(r.salvos.map((e) => e.id)).toEqual(['id-A', 'id-B']);
    expect(api.adicionarEndereco.mock.calls.map((c) => [c[0], c[1].logradouro])).toEqual([
      ['c-1', 'A'],
      ['c-1', 'B'],
    ]);
    expect(api.adicionarEndereco.mock.calls[1][1]).toMatchObject({ principal: true });
  });

  it('falha no meio: os demais são postados e o falho é listado', async () => {
    const api = dubleApi(['B']);
    const r = await salvarClienteComEnderecos(api as never, REQUEST, [
      rascunho('A', true),
      rascunho('B'),
      rascunho('C'),
    ]);
    expect(api.adicionarEndereco).toHaveBeenCalledTimes(3);
    expect(r.salvos.map((e) => e.id)).toEqual(['id-A', 'id-C']);
    expect(r.falhos.map((e) => e.chave)).toEqual(['B']);
  });

  it('falha ao criar o cliente: nenhum endereço é postado e o erro sobe', async () => {
    const api = dubleApi([], true);
    await expect(salvarClienteComEnderecos(api as never, REQUEST, [rascunho('A')])).rejects.toThrow(
      'cliente',
    );
    expect(api.adicionarEndereco).not.toHaveBeenCalled();
  });
});

describe('ClientesStore — endereços que falharam', () => {
  it('guarda os falhos por cliente e tentarDeNovo reenvia só eles', async () => {
    const api = dubleApi(['A']);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), { provide: ClientesApi, useValue: api }],
    });
    const store = TestBed.inject(ClientesStore);

    const r = await store.salvarComEnderecos(REQUEST, [rascunho('A'), rascunho('B', true)]);
    expect(r.falhos.map((e) => e.chave)).toEqual(['A']);
    expect(store.falhosDe('c-1').map((e) => e.chave)).toEqual(['A']);
    expect(store.falhosDe('outro')).toEqual([]);

    api.adicionarEndereco.mockClear();
    api.adicionarEndereco.mockImplementation((_id, e) => of({ id: `id-${e.logradouro}`, ...e }));
    const retry = await store.tentarDeNovo('c-1');
    expect(api.adicionarEndereco).toHaveBeenCalledTimes(1);
    expect(api.adicionarEndereco.mock.calls[0][1].logradouro).toBe('A');
    expect(retry.salvos).toHaveLength(1);
    expect(store.falhosDe('c-1')).toEqual([]);
  });

  it('tentarDeNovo que falha de novo mantém o endereço nos falhos', async () => {
    const api = dubleApi(['A']);
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), { provide: ClientesApi, useValue: api }],
    });
    const store = TestBed.inject(ClientesStore);
    await store.salvarComEnderecos(REQUEST, [rascunho('A')]);
    await store.tentarDeNovo('c-1');
    expect(store.falhosDe('c-1').map((e) => e.chave)).toEqual(['A']);
  });
});
