import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { IniciarPedidoSheet } from './iniciar-pedido-sheet';

const FUNCS = '/api/rh/v1/funcionarios';
const INICIO = '/api/vendas/v1/pedidos/p-1/inicio';
const func = (id: string, nome: string, ativo = true) => ({
  id,
  nome,
  telefone: null,
  cargoId: 'c',
  cargo: null,
  valorDiaria: 0,
  ativo,
});
const PEDIDO = {
  id: 'p-1',
  clienteId: 'c-1',
  status: 'PENDENTE',
  funcionarios: [
    { id: 'a', nome: 'Ana' },
    { id: 'b', nome: 'Bia' },
    { id: 'z', nome: 'Inativo' },
  ],
};

async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
  fixture.detectChanges();
}

async function montar(pedido: unknown = PEDIDO) {
  const close = vi.fn();
  await TestBed.configureTestingModule({
    imports: [IniciarPedidoSheet],
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: StorageService, useValue: new FakeStorage() },
      { provide: DIALOG_DATA, useValue: { pedido } },
      { provide: DialogRef, useValue: { close } },
    ],
  }).compileComponents();
  TestBed.inject(OperatorStore).select(operadorValido(['*']));
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(IniciarPedidoSheet);
  fixture.detectChanges();
  http
    .expectOne(FUNCS)
    .flush([func('a', 'Ana'), func('b', 'Bia'), func('c', 'Caio'), func('z', 'Inativo', false)]);
  await assentar(fixture);
  const el = fixture.nativeElement as HTMLElement;
  const caixas = () => Array.from(el.querySelectorAll<HTMLInputElement>('ce-checkbox input'));
  const confirmar = () =>
    Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Confirmar início'),
    ) as HTMLButtonElement;
  return { fixture, el, http, close, caixas, confirmar };
}

describe('IniciarPedidoSheet', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('vem pré-marcado com os do cadastro que estão ativos', async () => {
    const t = await montar();
    expect(t.caixas().map((c) => c.checked)).toEqual([true, true, false]);
  });

  it('desmarcar tudo desabilita Confirmar início; clique marca funcionário e habilita', async () => {
    const t = await montar();
    expect(t.confirmar().disabled).toBe(false);
    t.caixas()[0].click();
    t.caixas()[1].click();
    await assentar(t.fixture);
    expect(t.confirmar().disabled).toBe(true);
    t.confirmar().click();
    t.http.expectNone(INICIO);

    t.caixas()[2].click();
    await assentar(t.fixture);
    expect(t.confirmar().disabled).toBe(false);
  });

  it('clique em confirmar envia exatamente os marcados e fecha com a resposta', async () => {
    const t = await montar();
    t.caixas()[1].click(); // desmarca B
    t.caixas()[2].click(); // marca C
    await assentar(t.fixture);
    t.confirmar().click();
    const req = t.http.expectOne(INICIO);
    expect(req.request.body).toEqual({ funcionarioId: 'f1', funcionariosIds: ['a', 'c'] });
    const resposta = { ...PEDIDO, status: 'EM_ANDAMENTO' };
    req.flush(resposta);
    await assentar(t.fixture);
    expect(t.close).toHaveBeenCalledWith(resposta);
  });

  it.each([
    ['FUNCIONARIOS_OBRIGATORIOS', 'Escolha pelo menos um funcionário para iniciar o pedido.'],
    ['ESTOQUE_INSUFICIENTE', 'Estoque insuficiente para o produto.'],
  ])('422 %s mantém o sheet aberto com a mensagem', async (code, mensagem) => {
    const t = await montar();
    t.confirmar().click();
    t.http
      .expectOne(INICIO)
      .flush({ code, message: 'x', traceId: 't' }, { status: 422, statusText: 'x' });
    await assentar(t.fixture);
    expect(t.close).not.toHaveBeenCalled();
    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain(mensagem);
  });

  it('409 PEDIDO_STATUS_INVALIDO fecha com a mensagem e recarrega o pedido', async () => {
    const t = await montar();
    t.confirmar().click();
    t.http
      .expectOne(INICIO)
      .flush(
        { code: 'PEDIDO_STATUS_INVALIDO', message: 'x', traceId: 't' },
        { status: 409, statusText: 'x' },
      );
    await assentar(t.fixture);
    expect(t.close).toHaveBeenCalledWith({
      erro: 'A situação deste pedido mudou. A tela foi atualizada.',
    });
    t.http.expectOne('/api/vendas/v1/pedidos/p-1').flush({ ...PEDIDO, clienteId: 'c-1' });
    t.http
      .expectOne('/api/clientes/v1/clientes/c-1')
      .flush({ id: 'c-1', nome: 'Ana', enderecos: [] });
  });
});
