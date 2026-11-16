import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { marcaResp, produtoResp } from '../../core/api/testing';
import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { Ocorrencia } from './perdas-form';
import { PedidosStore } from './pedidos-store';
import { RegistrarPerdasSheet } from './registrar-perdas-sheet';
import { assentar, botaoPorRotulo, clicar, escolher } from './testing';

const ESTOQUE = '/api/estoque/v1';
const PERDAS = '/api/vendas/v1/pedidos/p-1/perdas';
const PRODUTOS = [
  produtoResp({
    id: 'pr-1',
    nome: 'Água 20L',
    marcas: [marcaResp({ marcaId: 'm-1', tipoCascoResolvidoId: 't-1' })],
  }),
  // sem tipo de casco resolvido: não dá para registrar perda de galão cheio dele
  produtoResp({ id: 'pr-2', nome: 'Gelo', marcas: [marcaResp({ marcaId: 'm-2' })] }),
];
const TIPOS = [{ id: 't-1', nome: 'Casco 20L' }];
const PEDIDO = {
  id: 'p-1',
  clienteId: 'c-1',
  status: 'CONCLUIDO',
  funcionarios: [{ id: 'f-1', nome: 'Beto' }],
  perdas: [],
};
const PENDENTE: Ocorrencia = {
  galao: 'VAZIO',
  produtoId: null,
  marcaId: null,
  tipoCascoId: 't-1',
  quantidade: 3,
  motivo: 'PERDIDO',
};

async function montar(dados: { pedido?: unknown; ocorrencias?: readonly Ocorrencia[] } = {}) {
  const close = vi.fn();
  await TestBed.configureTestingModule({
    imports: [RegistrarPerdasSheet],
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: StorageService, useValue: new FakeStorage() },
      { provide: DIALOG_DATA, useValue: { pedido: PEDIDO, ocorrencias: [], ...dados } },
      { provide: DialogRef, useValue: { close } },
    ],
  }).compileComponents();
  TestBed.inject(OperatorStore).select(operadorValido(['*']));
  const http = TestBed.inject(HttpTestingController);
  const store = TestBed.inject(PedidosStore);
  const fixture = TestBed.createComponent(RegistrarPerdasSheet);
  fixture.detectChanges();
  http.expectOne(`${ESTOQUE}/produtos`).flush(PRODUTOS);
  http.expectOne(`${ESTOQUE}/tipos-casco`).flush(TIPOS);
  await assentar(fixture);
  const el = fixture.nativeElement as HTMLElement;
  const linhas = () => el.querySelectorAll('[data-testid="ocorrencia"]').length;
  const confirmar = () =>
    Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Registrar perdas',
    ) as HTMLButtonElement;
  return { fixture, el, http, close, store, linhas, confirmar };
}

describe('RegistrarPerdasSheet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('adicionar e remover ocorrência por clique; sem ocorrência o Confirmar fica desabilitado', async () => {
    const t = await montar();
    expect(t.linhas()).toBe(0);
    expect(t.confirmar().disabled).toBe(true);

    clicar(t.el, '[data-testid="perdas-adicionar"] button');
    clicar(t.el, '[data-testid="perdas-adicionar"] button');
    await assentar(t.fixture);
    expect(t.linhas()).toBe(2);
    // nova ocorrência está incompleta (sem produto): Confirmar segue desabilitado
    expect(t.confirmar().disabled).toBe(true);

    botaoPorRotulo(t.el, 'Remover ocorrência 1').click();
    await assentar(t.fixture);
    expect(t.linhas()).toBe(1);
  });

  it('só oferece marca com tipo de casco resolvido', async () => {
    const t = await montar();
    clicar(t.el, '[data-testid="perdas-adicionar"] button');
    await assentar(t.fixture);
    const opcoes = Array.from(
      t.el.querySelectorAll<HTMLOptionElement>(
        'select[aria-label="Produto da ocorrência 1"] option',
      ),
    ).map((o) => o.textContent?.trim());
    expect(opcoes).toContain('Água 20L — Indaiá');
    expect(opcoes.join()).not.toContain('Gelo');
  });

  it('Confirmar faz o POST das perdas com o corpo esperado e fecha com o pedido; limpa as pendentes', async () => {
    const t = await montar({ ocorrencias: [PENDENTE] });
    t.store.guardarPerdasPendentes('p-1', [PENDENTE]);
    expect(t.linhas()).toBe(1); // já vem com a pendente
    clicar(t.el, '[data-testid="perdas-adicionar"] button');
    await assentar(t.fixture);
    escolher(t.el, 'Produto da ocorrência 2', 'pr-1|m-1');
    botaoPorRotulo(t.el, 'Aumentar ocorrência 2').click();
    await assentar(t.fixture);
    expect(t.confirmar().disabled).toBe(false);

    t.confirmar().click();
    const req = t.http.expectOne(PERDAS);
    expect(req.request.body).toEqual({
      funcionarioId: 'f1',
      ocorrencias: [
        {
          galao: 'VAZIO',
          produtoId: null,
          marcaId: null,
          tipoCascoId: 't-1',
          quantidade: 3,
          motivo: 'PERDIDO',
        },
        {
          galao: 'CHEIO',
          produtoId: 'pr-1',
          marcaId: 'm-1',
          tipoCascoId: null,
          quantidade: 2,
          motivo: 'QUEBRADO',
        },
      ],
    });
    const atualizado = { ...PEDIDO, perdas: [{ galao: 'VAZIO' }] };
    req.flush(atualizado);
    await assentar(t.fixture);
    expect(t.close).toHaveBeenCalledWith(atualizado);
    expect(t.store.perdasPendentes()['p-1']).toBeUndefined();
  });

  it('409 PEDIDO_STATUS_INVALIDO fecha com { erro } e a store recarrega o pedido', async () => {
    const t = await montar({ ocorrencias: [PENDENTE] });
    t.confirmar().click();
    t.http
      .expectOne(PERDAS)
      .flush(
        { code: 'PEDIDO_STATUS_INVALIDO', message: 'x', traceId: 't' },
        { status: 409, statusText: 'x' },
      );
    await assentar(t.fixture);
    expect(t.close).toHaveBeenCalledWith({
      erro: 'A situação deste pedido mudou. A tela foi atualizada.',
    });
    t.http.expectOne('/api/vendas/v1/pedidos/p-1').flush({ ...PEDIDO, status: 'CANCELADO' });
    t.http
      .expectOne('/api/clientes/v1/clientes/c-1')
      .flush({ id: 'c-1', nome: 'Ana', enderecos: [] });
  });

  it('422 RESPONSAVEL_OBRIGATORIO mostra na folha o texto de pedidos e não fecha', async () => {
    const t = await montar({ ocorrencias: [PENDENTE] });
    t.confirmar().click();
    t.http
      .expectOne(PERDAS)
      .flush(
        { code: 'RESPONSAVEL_OBRIGATORIO', message: 'x', traceId: 't' },
        { status: 422, statusText: 'x' },
      );
    await assentar(t.fixture);
    expect(t.close).not.toHaveBeenCalled();
    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain(
      'O pedido não tem funcionários para responder pela perda.',
    );
  });

  it('pedido sem funcionário: explica o motivo e não deixa adicionar', async () => {
    const t = await montar({ pedido: { ...PEDIDO, funcionarios: [] } });
    expect(t.el.querySelector('[data-testid="perdas-sem-responsavel"]')?.textContent).toContain(
      'O pedido não tem funcionários para responder pela perda.',
    );
    const adicionar = t.el.querySelector<HTMLButtonElement>(
      '[data-testid="perdas-adicionar"] button',
    )!;
    expect(adicionar.disabled).toBe(true);
  });

  it('mostra os funcionários do pedido como responsáveis', async () => {
    const t = await montar();
    expect(t.el.querySelector('[data-testid="perdas-responsaveis"]')?.textContent).toContain(
      'Beto',
    );
  });
});
