import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ConfigStore } from '../../core/config/app-config';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { AbastecimentoStore } from './abastecimento-store';
import { BASE, detalhe, pendente } from './abastecimento-testing';

function criar() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: StorageService, useValue: new FakeStorage() },
    ],
  });
  TestBed.inject(OperatorStore).select(operadorValido(['estoque.custos']));
  return { store: TestBed.inject(AbastecimentoStore), http: TestBed.inject(HttpTestingController) };
}

describe('AbastecimentoStore', () => {
  it('registrar: POST com o funcionário no corpo, devolve o id e recarrega os saldos', async () => {
    const { store, http } = criar();
    const corpo = { tipoFrete: 'PROPRIO' as const, observacao: null, itens: [], cascos: [] };

    const promessa = store.registrar(corpo);
    const req = http.expectOne(`${BASE}/abastecimentos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ ...corpo, funcionarioId: 'f1' });
    req.flush({ id: 'ab1' });

    expect(await promessa).toBe('ab1');
    http.expectOne(`${BASE}/produtos`).flush([]);
    http.expectOne(`${BASE}/estoque/cascos`).flush([]);
    http.verify();
  });

  it('carregarPendentes: GET com funcionarioId na query e status ok', async () => {
    const { store, http } = criar();
    const promessa = store.carregarPendentes();
    expect(store.statusPendentes()).toBe('loading');
    const req = http.expectOne((r) => r.url === `${BASE}/abastecimentos/custos-pendentes`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('funcionarioId')).toBe('f1');
    req.flush([pendente('ab1')]);
    await promessa;
    expect(store.statusPendentes()).toBe('ok');
    expect(store.pendentes()).toEqual([pendente('ab1')]);
    http.verify();
  });

  it('carregarPendentes: falha vira status error', async () => {
    const { store, http } = criar();
    const promessa = store.carregarPendentes();
    http
      .expectOne((r) => r.url === `${BASE}/abastecimentos/custos-pendentes`)
      .flush(null, { status: 500, statusText: 'err' });
    await promessa;
    expect(store.statusPendentes()).toBe('error');
  });

  it('carregar: GET /abastecimentos/{id} com funcionarioId na query', async () => {
    const { store, http } = criar();
    const promessa = store.carregar('ab1');
    const req = http.expectOne((r) => r.url === `${BASE}/abastecimentos/ab1`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('funcionarioId')).toBe('f1');
    req.flush(detalhe());
    await promessa;
    expect(store.statusDetalhe()).toBe('ok');
    expect(store.detalhe()).toEqual(detalhe());
    http.verify();
  });

  it('lancarCustos: PUT com o funcionário no corpo; guarda o detalhe com o total do servidor', async () => {
    const { store, http } = criar();
    const corpo = { frete: 18, itens: [{ id: 'l1', custoUnitario: 8 }], cascos: [] };

    const promessa = store.lancarCustos('ab1', corpo);
    const req = http.expectOne(`${BASE}/abastecimentos/ab1/custos`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ ...corpo, funcionarioId: 'f1' });
    req.flush(detalhe({ custoTotal: 548, custoPendente: false }));

    expect((await promessa).custoTotal).toBe(548);
    expect(store.detalhe()?.custoTotal).toBe(548);
    http.verify();
  });
});
