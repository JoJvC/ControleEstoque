import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { SheetService } from '../../core/overlay/sheet-service';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { lerPadraoPagina } from '../../ui/organisms/padrao-pagina.testing';
import { IniciarPedidoSheet } from './iniciar-pedido-sheet';
import { PedidoDetalhePage } from './pedido-detalhe-page';

const PEDIDOS = '/api/vendas/v1/pedidos';
const CLIENTES = '/api/clientes/v1/clientes';
const ESTOQUE = '/api/estoque/v1';

const CLIENTE = {
  id: 'c-1',
  nome: 'Ana',
  telefone: null,
  observacoes: null,
  enderecos: [{ id: 'e-1', logradouro: 'Rua A', numero: '10', bairro: 'Centro', principal: true }],
};
const PRODUTOS = [
  {
    id: 'p-1',
    nome: 'Água 20L',
    marcas: [{ id: 'pm-1', marcaId: 'm-1', marcaNome: 'Cristal', precoReferencia: 12.5 }],
  },
];
const TIPOS = [{ id: 't-1', nome: 'Casco 20L' }];

const pedido = (status: string, extra: object = {}) => ({
  id: 'p-1',
  clienteId: 'c-1',
  enderecoEntregaId: 'e-1',
  status,
  observacao: 'entregar cedo',
  createdBy: 'f1',
  createdAt: '2026-03-05T10:30:00Z',
  iniciadoEm: null,
  canceladoEm: null,
  canceladoPor: null,
  itens: [{ produtoId: 'p-1', marcaId: 'm-1', quantidade: 3, precoUnitario: 12.5, desconto: null }],
  funcionarios: [{ id: 'f-1', nome: 'Beto' }],
  vendaId: null,
  perdas: [],
  ...extra,
});

async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
  fixture.detectChanges();
}

async function montar(status: string, extra: object = {}, permissoes: string[] = ['*']) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: StorageService, useValue: new FakeStorage() },
    ],
  });
  TestBed.inject(OperatorStore).select(operadorValido(permissoes));
  const http = TestBed.inject(HttpTestingController);
  const sheet = TestBed.inject(SheetService);
  const confirmar = vi.spyOn(sheet, 'confirmar');
  const abrir = vi.spyOn(sheet, 'abrir');
  vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(PedidoDetalhePage);
  fixture.componentRef.setInput('id', 'p-1');
  fixture.detectChanges();
  http.expectOne(`${ESTOQUE}/produtos`).flush(PRODUTOS);
  http.expectOne(`${ESTOQUE}/tipos-casco`).flush(TIPOS);
  http.expectOne(`${PEDIDOS}/p-1`).flush(pedido(status, extra));
  http.expectOne(`${CLIENTES}/c-1`).flush(CLIENTE);
  await assentar(fixture);
  const el = fixture.nativeElement as HTMLElement;
  const botao = (texto: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === texto);
  return { fixture, el, http, confirmar, abrir, botao };
}

describe('PedidoDetalhePage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('renderiza cliente, endereço, status, itens com nome, funcionários e perdas', async () => {
    const t = await montar('CONCLUIDO', {
      perdas: [
        {
          galao: 'CHEIO',
          produtoId: 'p-1',
          marcaId: 'm-1',
          tipoCascoId: 't-1',
          quantidade: 2,
          motivo: 'QUEBRADO',
          registradoEm: '2026-03-06T08:00:00Z',
        },
        {
          galao: 'VAZIO',
          produtoId: null,
          marcaId: null,
          tipoCascoId: 't-1',
          quantidade: 1,
          motivo: 'PERDIDO',
          registradoEm: '2026-03-06T09:00:00Z',
        },
      ],
    });
    const texto = t.el.textContent!.replace(/\s+/g, ' ');
    expect(texto).toContain('Ana');
    expect(texto).toContain('Concluído');
    expect(texto).toContain('Entrega: Rua A, 10, Centro');
    expect(texto).toContain('entregar cedo');
    expect(texto).toContain('Água 20L — Cristal');
    expect(texto).toContain('3 × R$ 12,50');
    expect(texto).toContain('Beto');
    expect(texto).toContain('Cheio — Água 20L');
    expect(texto).toContain('2 · Quebrado');
    expect(texto).toContain('Vazio — Casco 20L');
    expect(texto).toContain('1 · Perdido');
    expect(texto).not.toContain('Nenhuma perda registrada');
    expect(lerPadraoPagina(t.el)).toMatchObject({ cabecalhos: 1, voltar: true });
  });

  it('sem perdas mostra Nenhuma perda registrada', async () => {
    const t = await montar('PENDENTE');
    expect(t.el.textContent).toContain('Nenhuma perda registrada');
  });

  it.each([
    ['PENDENTE', true, true],
    ['EM_ANDAMENTO', false, true],
    ['CONCLUIDO', false, false],
    ['CANCELADO', false, false],
  ])('%s: Iniciar=%s, Cancelar=%s', async (status, iniciar, cancelar) => {
    const t = await montar(status);
    expect(!!t.botao('Iniciar')).toBe(iniciar);
    expect(!!t.botao('Cancelar')).toBe(cancelar);
  });

  it('sem vendas.registrar não mostra Iniciar nem Cancelar', async () => {
    const t = await montar('PENDENTE', {}, []);
    expect(t.botao('Iniciar')).toBeUndefined();
    expect(t.botao('Cancelar')).toBeUndefined();
  });

  it('clique em Cancelar com confirmação true envia o POST e atualiza o status', async () => {
    const t = await montar('PENDENTE');
    t.confirmar.mockResolvedValue(true);
    t.botao('Cancelar')!.click();
    await assentar(t.fixture);
    expect(t.confirmar).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: 'Cancelar pedido?',
        confirmarLabel: 'Cancelar pedido',
        cancelarLabel: 'Voltar',
        perigo: true,
      }),
    );
    const req = t.http.expectOne(`${PEDIDOS}/p-1/cancelamento`);
    expect(req.request.body).toEqual({ funcionarioId: 'f1' });
    req.flush(pedido('CANCELADO', { canceladoEm: '2026-03-07T10:00:00Z' }));
    await assentar(t.fixture);
    expect(t.el.querySelector('[data-testid="pedido-status"]')?.textContent).toContain('Cancelado');
    expect(t.botao('Cancelar')).toBeUndefined();
  });

  it('clique em Cancelar com confirmação false não envia nada', async () => {
    const t = await montar('EM_ANDAMENTO');
    t.confirmar.mockResolvedValue(false);
    t.botao('Cancelar')!.click();
    await assentar(t.fixture);
    t.http.expectNone(`${PEDIDOS}/p-1/cancelamento`);
  });

  it('409 PEDIDO_STATUS_INVALIDO no cancelamento mostra a mensagem e recarrega o pedido', async () => {
    const t = await montar('PENDENTE');
    t.confirmar.mockResolvedValue(true);
    t.botao('Cancelar')!.click();
    await assentar(t.fixture);
    t.http
      .expectOne(`${PEDIDOS}/p-1/cancelamento`)
      .flush(
        { code: 'PEDIDO_STATUS_INVALIDO', message: 'x', traceId: 't' },
        { status: 409, statusText: 'x' },
      );
    await assentar(t.fixture);
    t.http.expectOne(`${PEDIDOS}/p-1`).flush(pedido('CONCLUIDO'));
    t.http.expectOne(`${CLIENTES}/c-1`).flush(CLIENTE);
    await assentar(t.fixture);
    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain(
      'A situação deste pedido mudou. A tela foi atualizada.',
    );
    expect(t.el.querySelector('[data-testid="pedido-status"]')?.textContent).toContain('Concluído');
  });

  it('clique em Iniciar abre o sheet com o pedido; resposta {erro} mostra a mensagem', async () => {
    const t = await montar('PENDENTE');
    t.abrir.mockReturnValue({ closed: of({ erro: 'A situação deste pedido mudou.' }) } as never);
    t.botao('Iniciar')!.click();
    await assentar(t.fixture);
    expect(t.abrir).toHaveBeenCalledWith(
      IniciarPedidoSheet,
      expect.objectContaining({ pedido: expect.objectContaining({ id: 'p-1' }) }),
    );
    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain('A situação deste pedido');
  });
});
