import { BreakpointObserver } from '@angular/cdk/layout';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { BehaviorSubject, map, of } from 'rxjs';
import { vi } from 'vitest';

import { SaldosResponse } from '../../core/api/models/clientes';
import { marcaResp, produtoResp } from '../../core/api/testing';
import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { SheetService } from '../../core/overlay/sheet-service';
import { itemNovo } from '../vendas/carrinho';
import { ItemVendaSheet } from '../vendas/item-venda-sheet';
import { PedidoConclusaoPage } from './pedido-conclusao-page';
import { PedidosStore } from './pedidos-store';
import { assentar, botaoPorRotulo, clicar, escolher } from './testing';

const PEDIDOS = '/api/vendas/v1/pedidos';
const CLIENTES = '/api/clientes/v1/clientes';
const ESTOQUE = '/api/estoque/v1';

const AGUA = produtoResp({
  id: 'p-1',
  tipo: 'RETORNAVEL',
  nome: 'Água 20L',
  marcas: [marcaResp({ marcaId: 'm-1', precoReferencia: 12.5, tipoCascoResolvidoId: 't-1' })],
});
const GELO = produtoResp({
  id: 'p-2',
  tipo: 'DESCARTAVEL',
  nome: 'Gelo 5kg',
  marcas: [marcaResp({ marcaId: 'm-2', precoReferencia: 8 })],
});
const TIPOS = [
  {
    id: 't-1',
    nome: 'Casco 20L',
    marcaId: null,
    marca: null,
    precoVasilhame: 30,
    aceitaSucata: true,
  },
];
const CLIENTE = {
  id: 'c-1',
  nome: 'Ana',
  telefone: null,
  observacoes: null,
  enderecos: [{ id: 'e-1', logradouro: 'Rua A', numero: '10', bairro: 'Centro', principal: true }],
};
const SALDOS: SaldosResponse = {
  saldoCascos: 0,
  sucataEntregue: 0,
  saldoFiado: 0,
  saldo: 0,
  creditoDisponivel: 0,
  cascosPorTipo: [],
  sucataPorTipo: [],
};
const VENDA = { id: 'v-1' };

const pedido = (status = 'EM_ANDAMENTO', extra: object = {}) => ({
  id: 'p-1',
  clienteId: 'c-1',
  enderecoEntregaId: 'e-1',
  status,
  observacao: null,
  createdBy: 'f-1',
  createdAt: '2026-03-05T10:30:00Z',
  iniciadoEm: '2026-03-05T11:00:00Z',
  canceladoEm: null,
  canceladoPor: null,
  itens: [
    { produtoId: 'p-1', marcaId: 'm-1', quantidade: 3, precoUnitario: 12.5, desconto: null },
    { produtoId: 'p-2', marcaId: 'm-2', quantidade: 1, precoUnitario: 8, desconto: null },
  ],
  funcionarios: [{ id: 'f-9', nome: 'Beto' }],
  vendaId: null,
  perdas: [],
  ...extra,
});

async function montar(
  opcoes: {
    desktop?: boolean;
    status?: string;
    pedido?: object;
    catalogo?: unknown[];
    saldos?: SaldosResponse;
  } = {},
) {
  const largura = new BehaviorSubject(opcoes.desktop === true);
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      {
        provide: BreakpointObserver,
        useValue: { observe: () => largura.pipe(map((matches) => ({ matches, breakpoints: {} }))) },
      },
      {
        provide: OperatorStore,
        useValue: { operator: () => ({ id: 'f-1', nome: 'Maria', cargoId: 'c', cargoNome: null }) },
      },
    ],
  });
  const sheet = TestBed.inject(SheetService);
  const abrir = vi.spyOn(sheet, 'abrir');
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(PedidoConclusaoPage);
  fixture.componentRef.setInput('id', 'p-1');
  http.expectOne(`${ESTOQUE}/produtos`).flush(opcoes.catalogo ?? [AGUA, GELO]);
  http.expectOne(`${ESTOQUE}/tipos-casco`).flush(TIPOS);
  fixture.detectChanges();
  http.expectOne(`${PEDIDOS}/p-1`).flush(pedido(opcoes.status, opcoes.pedido));
  http.expectOne(`${CLIENTES}/c-1`).flush(CLIENTE);
  await assentar(fixture);
  if (!opcoes.status || opcoes.status === 'EM_ANDAMENTO') {
    http.expectOne(`${CLIENTES}/c-1/saldos`).flush(opcoes.saldos ?? SALDOS);
    await assentar(fixture);
  }
  const el = fixture.nativeElement as HTMLElement;
  const store = TestBed.inject(PedidosStore);
  const continuar = async () => {
    el.querySelector<HTMLButtonElement>('[data-testid="passo-continuar"] button')!.click();
    await assentar(fixture);
  };
  const trilho = () => el.querySelector('[data-testid="passo-trilho"]')?.textContent?.trim();
  const confirmar = () =>
    el.querySelector<HTMLButtonElement>('[data-testid="confirmar-venda"] button');
  const botaoExato = (texto: string) =>
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === texto)!;
  const adicionarOcorrencia = async () => {
    clicar(el, '[data-testid="perdas-adicionar"] button');
    await assentar(fixture);
  };
  const ocorrencias = () => el.querySelectorAll('[data-testid="ocorrencia"]').length;
  return {
    fixture,
    el,
    http,
    abrir,
    navegar,
    store,
    continuar,
    trilho,
    confirmar,
    botaoExato,
    adicionarOcorrencia,
    ocorrencias,
  };
}

type Montagem = Awaited<ReturnType<typeof montar>>;

const OCORRENCIA_VAZIO = {
  galao: 'VAZIO',
  produtoId: null,
  marcaId: null,
  tipoCascoId: 't-1',
  quantidade: 3,
  motivo: 'PERDIDO',
};

/** Deixa duas ocorrências na lista (uma CHEIO, outra VAZIO), preenche as duas e remove a primeira. */
async function preencherPerdas(t: Montagem): Promise<void> {
  await t.adicionarOcorrencia();
  await t.adicionarOcorrencia();
  expect(t.ocorrencias()).toBe(2);
  escolher(t.el, 'Produto da ocorrência 1', 'p-1|m-1');
  escolher(t.el, 'Galão da ocorrência 2', 'VAZIO');
  await assentar(t.fixture);
  escolher(t.el, 'Tipo de casco da ocorrência 2', 't-1');
  escolher(t.el, 'Motivo da ocorrência 2', 'PERDIDO');
  botaoPorRotulo(t.el, 'Aumentar ocorrência 2').click();
  botaoPorRotulo(t.el, 'Aumentar ocorrência 2').click();
  await assentar(t.fixture);
  botaoPorRotulo(t.el, 'Remover ocorrência 1').click();
  await assentar(t.fixture);
  expect(t.ocorrencias()).toBe(1);
}

describe('PedidoConclusaoPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  describe('celular', () => {
    it('roteiro principal: itens, cascos, perdas e pagamento; conclusão e só depois as perdas', async () => {
      const t = await montar();
      // Passo 1: cliente e endereço só leitura e a lista de itens
      expect(t.trilho()).toBe('1 de 4 · Cliente e produtos');
      expect(t.el.textContent).toContain('Ana');
      expect(t.el.textContent).toContain('Rua A, 10, Centro');
      expect(t.el.querySelectorAll('ce-item-venda-card')).toHaveLength(2);

      // Edita o primeiro item pela folha: a quantidade nova aparece no corpo do item
      t.abrir.mockReturnValueOnce({
        closed: of({ ...itemNovo(AGUA, AGUA.marcas[0], 5), precoUnitario: 12.5 }),
      } as never);
      t.el.querySelector<HTMLButtonElement>('ce-item-venda-card .item__corpo')!.click();
      await assentar(t.fixture);
      expect(t.abrir).toHaveBeenCalledWith(
        ItemVendaSheet,
        expect.objectContaining({
          existente: expect.objectContaining({ quantidade: 3 }),
          clienteId: 'c-1',
        }),
      );
      expect(t.el.querySelector('ce-item-venda-card .item__calculo')?.textContent).toContain('5 ×');

      // Remove o segundo (o gelo)
      botaoPorRotulo(
        t.el.querySelectorAll<HTMLElement>('ce-item-venda-card')[1],
        'Remover item',
      ).click();
      await assentar(t.fixture);
      expect(t.el.querySelectorAll('ce-item-venda-card')).toHaveLength(1);

      await t.continuar();
      expect(t.trilho()).toBe('2 de 4 · Cascos');
      await t.continuar();
      expect(t.trilho()).toBe('3 de 4 · Perdas e quebras');
      expect(t.el.querySelector('[data-testid="perdas-responsaveis"]')?.textContent).toContain(
        'Beto',
      );
      // Ocorrência incompleta bloqueia o Continuar
      await t.adicionarOcorrencia();
      expect(
        t.el.querySelector<HTMLButtonElement>('[data-testid="passo-continuar"] button')!.disabled,
      ).toBe(true);
      await t.adicionarOcorrencia();
      escolher(t.el, 'Produto da ocorrência 1', 'p-1|m-1');
      escolher(t.el, 'Galão da ocorrência 2', 'VAZIO');
      await assentar(t.fixture);
      escolher(t.el, 'Tipo de casco da ocorrência 2', 't-1');
      escolher(t.el, 'Motivo da ocorrência 2', 'PERDIDO');
      botaoPorRotulo(t.el, 'Aumentar ocorrência 2').click();
      botaoPorRotulo(t.el, 'Aumentar ocorrência 2').click();
      await assentar(t.fixture);
      botaoPorRotulo(t.el, 'Remover ocorrência 1').click();
      await assentar(t.fixture);
      expect(t.ocorrencias()).toBe(1);

      await t.continuar();
      expect(t.trilho()).toBe('4 de 4 · Pagamento');
      // Pagamento parcial: metade do total (62,50); o resto vira fiado no servidor
      t.botaoExato('Metade').click();
      await assentar(t.fixture);

      t.confirmar()!.click();
      const conclusao = t.http.expectOne(`${PEDIDOS}/p-1/conclusao`);
      expect(conclusao.request.method).toBe('POST');
      expect(conclusao.request.body).toEqual({
        funcionarioId: 'f-1',
        itens: [
          { produtoId: 'p-1', marcaId: 'm-1', quantidade: 5, precoUnitario: 12.5, desconto: null },
        ],
        vasilhames: [],
        pagamentos: [{ forma: 'DINHEIRO', valor: 31.25 }],
        cascosDevolvidos: [],
        sucataEntregue: [],
        observacao: null,
      });
      // As perdas só depois do 201
      t.http.expectNone(`${PEDIDOS}/p-1/perdas`);
      expect(t.navegar).not.toHaveBeenCalled();
      conclusao.flush(VENDA, { status: 201, statusText: 'Created' });
      await assentar(t.fixture);

      const perdas = t.http.expectOne(`${PEDIDOS}/p-1/perdas`);
      expect(perdas.request.body).toEqual({
        funcionarioId: 'f-1',
        ocorrencias: [OCORRENCIA_VAZIO],
      });
      expect(t.navegar).not.toHaveBeenCalled();
      perdas.flush(pedido('CONCLUIDO'));
      await assentar(t.fixture);
      expect(t.navegar).toHaveBeenCalledWith('/pedidos/p-1');
      expect(t.store.perdasPendentes()['p-1']).toBeUndefined();
    });

    it('sem ocorrência só a conclusão é chamada', async () => {
      const t = await montar();
      await t.continuar();
      await t.continuar();
      await t.continuar();
      expect(t.trilho()).toBe('4 de 4 · Pagamento');
      t.confirmar()!.click();
      t.http
        .expectOne(`${PEDIDOS}/p-1/conclusao`)
        .flush(VENDA, { status: 201, statusText: 'Created' });
      await assentar(t.fixture);
      // verify() no afterEach garante que não houve POST de perdas
      expect(t.navegar).toHaveBeenCalledWith('/pedidos/p-1');
    });

    it.each([
      ['500', { code: 'ERRO', message: 'x', traceId: 't' }, 500],
      [
        '422 RESPONSAVEL_OBRIGATORIO',
        { code: 'RESPONSAVEL_OBRIGATORIO', message: 'x', traceId: 't' },
        422,
      ],
    ])(
      'falha só nas perdas (%s): uma única conclusão, pendentes guardadas e vai para o detalhe',
      async (_nome, corpo, status) => {
        const t = await montar();
        await t.continuar();
        await t.continuar();
        await t.continuar();
        // (monta a perda no passo anterior: volta uma vez)
        t.el.querySelector<HTMLButtonElement>('[data-testid="passo-voltar"] button')!.click();
        await assentar(t.fixture);
        await preencherPerdas(t);
        await t.continuar();
        t.confirmar()!.click();
        t.http
          .expectOne(`${PEDIDOS}/p-1/conclusao`)
          .flush(VENDA, { status: 201, statusText: 'Created' });
        await assentar(t.fixture);
        t.http.expectOne(`${PEDIDOS}/p-1/perdas`).flush(corpo, { status, statusText: 'x' });
        await assentar(t.fixture);

        expect(t.store.perdasPendentes()['p-1']).toEqual([OCORRENCIA_VAZIO]);
        expect(t.navegar).toHaveBeenCalledWith('/pedidos/p-1');
        // a conclusão não é reenviada: nenhuma requisição pendente (verify no afterEach)
      },
    );

    it('409 PEDIDO_STATUS_INVALIDO na conclusão: mensagem na tela, pedido recarregado e nenhuma perda', async () => {
      const t = await montar();
      await t.continuar();
      await t.continuar();
      await t.adicionarOcorrencia();
      escolher(t.el, 'Produto da ocorrência 1', 'p-1|m-1');
      await assentar(t.fixture);
      await t.continuar();
      t.confirmar()!.click();
      t.http
        .expectOne(`${PEDIDOS}/p-1/conclusao`)
        .flush(
          { code: 'PEDIDO_STATUS_INVALIDO', message: 'x', traceId: 't' },
          { status: 409, statusText: 'Conflict' },
        );
      await assentar(t.fixture);
      t.http.expectOne(`${PEDIDOS}/p-1`).flush(pedido('CANCELADO'));
      t.http.expectOne(`${CLIENTES}/c-1`).flush(CLIENTE);
      await assentar(t.fixture);

      expect(t.el.querySelector('[role="alert"].erro')?.textContent).toContain(
        'A situação deste pedido mudou. A tela foi atualizada.',
      );
      expect(t.confirmar()).toBeNull();
      expect(t.navegar).not.toHaveBeenCalled();
    });

    it('4xx da conclusão aparece na tela e o Confirmar volta a funcionar', async () => {
      const t = await montar();
      await t.continuar();
      await t.continuar();
      await t.continuar();
      t.confirmar()!.click();
      t.http
        .expectOne(`${PEDIDOS}/p-1/conclusao`)
        .flush(
          { code: 'CREDITO_INSUFICIENTE', message: 'x', traceId: 't' },
          { status: 422, statusText: 'x' },
        );
      await assentar(t.fixture);
      // CREDITO_INSUFICIENTE recarrega os saldos
      t.http.expectOne(`${CLIENTES}/c-1/saldos`).flush(SALDOS);
      await assentar(t.fixture);
      expect(t.el.querySelector('.erro')).not.toBeNull();
      expect(t.confirmar()!.disabled).toBe(false);
      expect(t.navegar).not.toHaveBeenCalled();
    });

    it('CREDITO_INSUFICIENTE: os saldos novos limitam a linha de crédito e o próximo Confirmar leva o teto novo', async () => {
      const t = await montar({ saldos: { ...SALDOS, saldo: 40, creditoDisponivel: 40 } });
      await t.continuar();
      await t.continuar();
      await t.continuar();
      const valores = () =>
        Array.from(
          t.el.querySelectorAll<HTMLInputElement>('.forma-linha ce-money-input input'),
        ).map((i) => i.value);
      t.botaoExato('Crédito do cliente').click();
      await assentar(t.fixture);
      expect(valores()).toEqual(['40,00']);

      t.confirmar()!.click();
      const primeira = t.http.expectOne(`${PEDIDOS}/p-1/conclusao`);
      expect(primeira.request.body.pagamentos).toEqual([{ forma: 'CREDITO_CLIENTE', valor: 40 }]);
      primeira.flush(
        { code: 'CREDITO_INSUFICIENTE', message: 'x', traceId: 't' },
        { status: 422, statusText: 'x' },
      );
      await assentar(t.fixture);
      t.http
        .expectOne(`${CLIENTES}/c-1/saldos`)
        .flush({ ...SALDOS, saldo: 10, creditoDisponivel: 10 });
      await assentar(t.fixture);
      expect(valores()).toEqual(['10,00']);

      t.confirmar()!.click();
      const segunda = t.http.expectOne(`${PEDIDOS}/p-1/conclusao`);
      expect(segunda.request.body.pagamentos).toEqual([{ forma: 'CREDITO_CLIENTE', valor: 10 }]);
      segunda.flush(VENDA, { status: 201, statusText: 'Created' });
      await assentar(t.fixture);
      expect(t.navegar).toHaveBeenCalledWith('/pedidos/p-1');
    });

    it('item que não está mais no catálogo aparece como erro e bloqueia o Continuar', async () => {
      const t = await montar({ catalogo: [GELO] });
      expect(t.el.querySelector('[data-testid="itens-fora-do-catalogo"]')?.textContent).toContain(
        '1 item',
      );
      expect(
        t.el.querySelector<HTMLButtonElement>('[data-testid="passo-continuar"] button')!.disabled,
      ).toBe(true);
    });

    it('pedido fora de EM_ANDAMENTO: aviso com link para o pedido e nenhum Confirmar', async () => {
      const t = await montar({ status: 'CONCLUIDO' });
      expect(t.el.querySelector('[data-testid="conclusao-indisponivel"]')).not.toBeNull();
      expect(t.el.querySelector('a')?.getAttribute('href')).toBe('/pedidos/p-1');
      expect(t.confirmar()).toBeNull();
      expect(t.el.querySelector('ce-passo-a-passo')).toBeNull();
    });
  });

  describe('desktop (≥ 960 px)', () => {
    it('painel de cobrança com o Confirmar à vista, sem passo a passo; confirma as duas chamadas em ordem', async () => {
      const t = await montar({ desktop: true });
      expect(t.el.querySelector('ce-passo-a-passo')).toBeNull();
      const painel = t.el.querySelector('ce-cobrar-painel')!;
      expect(painel.querySelector('[data-testid="confirmar-venda"]')).not.toBeNull();
      expect(painel.textContent).toContain('Concluir pedido');
      // itens, perdas e responsáveis na coluna
      expect(t.el.querySelectorAll('ce-item-venda-card')).toHaveLength(2);
      expect(t.el.querySelector('[data-testid="perdas-responsaveis"]')?.textContent).toContain(
        'Beto',
      );

      await preencherPerdas(t);
      painel.querySelector<HTMLButtonElement>('[data-testid="confirmar-venda"] button')!.click();
      const conclusao = t.http.expectOne(`${PEDIDOS}/p-1/conclusao`);
      expect(conclusao.request.body).toEqual(
        expect.objectContaining({ funcionarioId: 'f-1', observacao: null, pagamentos: [] }),
      );
      t.http.expectNone(`${PEDIDOS}/p-1/perdas`);
      conclusao.flush(VENDA, { status: 201, statusText: 'Created' });
      await assentar(t.fixture);
      const perdas = t.http.expectOne(`${PEDIDOS}/p-1/perdas`);
      expect(perdas.request.body).toEqual({
        funcionarioId: 'f-1',
        ocorrencias: [OCORRENCIA_VAZIO],
      });
      perdas.flush(pedido('CONCLUIDO'));
      await assentar(t.fixture);
      expect(t.navegar).toHaveBeenCalledWith('/pedidos/p-1');
    });

    it('ocorrência incompleta desabilita o Confirmar do painel', async () => {
      const t = await montar({ desktop: true });
      expect(t.confirmar()!.disabled).toBe(false);
      await t.adicionarOcorrencia();
      expect(t.confirmar()!.disabled).toBe(true);
    });
  });
});
