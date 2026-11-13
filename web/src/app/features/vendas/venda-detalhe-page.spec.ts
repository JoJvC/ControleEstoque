import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { VendaDetalheResponse } from '../../core/api/models/vendas';
import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { SheetService } from '../../core/overlay/sheet-service';
import { PrintService } from '../../core/platform/print-service';
import { VendaStore } from './venda-store';
import { VendaDetalhePage } from './venda-detalhe-page';

const URL_VENDAS = '/api/vendas/v1/vendas';
const URL_CLIENTES = '/api/clientes/v1/clientes';
const URL_PRODUTOS = '/api/estoque/v1/produtos';

const VENDA: VendaDetalheResponse = {
  id: 'v-1',
  clienteId: 'c-1',
  funcionarioId: 'f-1',
  enderecoEntregaId: null,
  data: '2026-01-02T10:30:00',
  totalBruto: 120,
  totalDesconto: 20,
  totalLiquido: 100,
  statusPagamento: 'PARCIAL',
  observacao: 'entregar à tarde',
  cupomEmitido: false,
  cupomNumero: null,
  cupomEmitidoEm: null,
  itens: [
    {
      produtoId: 'p-agua',
      quantidade: 2,
      precoUnitario: 60,
      descontoTipo: 'VALOR',
      descontoValor: 20,
      motivoDesconto: 'cliente antigo',
      totalItem: 100,
    },
  ],
  pagamentos: [{ forma: 'PIX', valor: 40 }],
  cascosDevolvidos: 0,
  sucataEntregue: 0,
};

async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
}

async function montar() {
  const abrir = vi.fn();
  const printHtml = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: SheetService, useValue: { abrir } },
      { provide: PrintService, useValue: { printHtml } },
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(VendaDetalhePage);
  fixture.componentRef.setInput('id', 'v-1');
  fixture.detectChanges();
  await assentar(fixture);
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    http,
    navegar,
    abrir,
    printHtml,
    el,
    texto: () => (el.textContent ?? '').replace(/\s+/g, ' '),
  };
}

describe('VendaDetalhePage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('renderiza cliente, totais, itens e pagamentos; 1 GET de cliente', async () => {
    const t = await montar();
    t.http.expectOne(`${URL_VENDAS}/v-1`).flush(VENDA);
    await assentar(t.fixture);
    expect(t.texto()).toContain('Carregando cliente…');
    t.http
      .expectOne(`${URL_CLIENTES}/c-1`)
      .flush({ id: 'c-1', nome: 'Maria', telefone: null, observacoes: null, enderecos: [] });
    expect(t.texto()).toContain('Carregando produto…');
    t.http.expectOne(`${URL_PRODUTOS}/p-agua`).flush({ id: 'p-agua', nome: 'Água 20L' });
    await assentar(t.fixture);

    const texto = t.texto();
    expect(texto).toContain('Maria');
    expect(texto).toContain('02/01/2026 10:30');
    expect(texto).toContain('Parcial');
    expect(texto).toContain('entregar à tarde');
    expect(texto).toContain('Água 20L');
    expect(texto).not.toContain('p-agua');
    expect(texto).toMatch(/2 × R\$ 60,00/);
    expect(texto).toContain('cliente antigo');
    expect(texto).toMatch(/PIX ?R\$ 40,00/);
    expect(texto).toMatch(/Bruto ?R\$ 120,00/);
    expect(texto).toMatch(/Desconto ?R\$ 20,00/);
    expect(texto).toMatch(/Líquido ?R\$ 100,00/);
  });

  it('404 mostra o estado de erro com a mensagem', async () => {
    const t = await montar();
    t.http
      .expectOne(`${URL_VENDAS}/v-1`)
      .flush(
        { code: 'VENDA_NAO_ENCONTRADA', message: 'x', traceId: 't' },
        { status: 404, statusText: 'Not Found' },
      );
    await assentar(t.fixture);
    expect(t.texto()).toContain('Venda não encontrada.');
    expect(t.el.querySelector('[data-testid="venda-acoes"]')).toBeNull();
  });

  it('"Voltar" navega para /vendas', async () => {
    const t = await montar();
    t.http.expectOne(`${URL_VENDAS}/v-1`).flush(VENDA);
    t.http.expectOne(`${URL_CLIENTES}/c-1`).flush({ id: 'c-1', nome: 'Maria' });
    t.http.expectOne(`${URL_PRODUTOS}/p-agua`).flush({ id: 'p-agua', nome: 'Água 20L' });
    await assentar(t.fixture);
    const voltar = Array.from(t.el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Voltar'),
    )!;
    voltar.click();
    expect(t.navegar).toHaveBeenCalledWith('/vendas');
  });

  it('área de ações tem Editar (navega), Adicionar pagamento e Emitir cupom fiscal', async () => {
    const t = await montar();
    t.http.expectOne(`${URL_VENDAS}/v-1`).flush(VENDA);
    t.http.expectOne(`${URL_CLIENTES}/c-1`).flush({ id: 'c-1', nome: 'Maria' });
    t.http.expectOne(`${URL_PRODUTOS}/p-agua`).flush({ id: 'p-agua', nome: 'Água 20L' });
    await assentar(t.fixture);
    const acoes = t.el.querySelector('[data-testid="venda-acoes"]');
    expect(acoes).not.toBeNull();
    const botoes = acoes!.querySelectorAll('button');
    expect(Array.from(botoes).map((b) => b.textContent?.trim())).toEqual([
      'Editar',
      'Adicionar pagamento',
      'Emitir cupom fiscal',
    ]);
    botoes[0].click();
    expect(t.navegar).toHaveBeenCalledWith('/vendas/editar/v-1');
  });

  it('produto 404 mostra "Produto removido"', async () => {
    const t = await montar();
    t.http.expectOne(`${URL_VENDAS}/v-1`).flush(VENDA);
    t.http.expectOne(`${URL_CLIENTES}/c-1`).flush({ id: 'c-1', nome: 'Maria' });
    t.http
      .expectOne(`${URL_PRODUTOS}/p-agua`)
      .flush(
        { code: 'PRODUTO_NAO_ENCONTRADO', message: 'x', traceId: 't' },
        { status: 404, statusText: 'Not Found' },
      );
    await assentar(t.fixture);
    expect(t.texto()).toContain('Produto removido');
  });
});

describe('VendaDetalhePage: pagamento e cupom', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const CLIENTE = { id: 'c-1', nome: 'Maria', telefone: null, observacoes: null, enderecos: [] };

  async function aberta(venda: VendaDetalheResponse = VENDA) {
    const t = await montar();
    t.http.expectOne(`${URL_VENDAS}/v-1`).flush(venda);
    t.http.expectOne(`${URL_CLIENTES}/c-1`).flush(CLIENTE);
    t.http.expectOne(`${URL_PRODUTOS}/p-agua`).flush({ id: 'p-agua', nome: 'Água 20L' });
    await assentar(t.fixture);
    const botao = (rotulo: string) =>
      Array.from(t.el.querySelectorAll('button')).find((b) => b.textContent?.includes(rotulo));
    return { ...t, botao };
  }

  function erro(status: number, code: string) {
    return [
      { code, message: 'x', traceId: 't' },
      { status, statusText: 'Erro' },
    ] as const;
  }

  it('mostra o saldo a pagar e abre o sheet com { vendaId, saldo }; ao fechar, status e saldo novos', async () => {
    const t = await aberta();
    expect(t.texto()).toContain('Saldo a pagar R$ 60,00');
    t.abrir.mockImplementation(() => {
      // o sheet real faz este POST pelo store, que recarrega o detalhe
      void TestBed.inject(VendaStore).adicionarPagamento('v-1', { forma: 'PIX', valor: 60 });
      return { closed: of({ id: 'v-1' }) };
    });

    t.botao('Adicionar pagamento')!.click();
    await assentar(t.fixture);

    expect(t.abrir).toHaveBeenCalledWith(expect.anything(), { vendaId: 'v-1', saldo: 60 });
    t.http.expectOne(`${URL_VENDAS}/v-1/pagamentos`).flush({ id: 'v-1' });
    await assentar(t.fixture);
    t.http.expectOne((r) => r.method === 'GET' && r.url === URL_VENDAS).flush([]);
    t.http.expectOne(`${URL_VENDAS}/v-1`).flush({
      ...VENDA,
      statusPagamento: 'PAGA',
      pagamentos: [
        { forma: 'PIX', valor: 40 },
        { forma: 'PIX', valor: 60 },
      ],
    });
    await assentar(t.fixture);

    expect(t.texto()).toContain('Paga');
    expect(t.texto()).not.toContain('Saldo a pagar');
    expect(t.botao('Adicionar pagamento')).toBeUndefined();
  });

  it('sheet cancelado não muda nada', async () => {
    const t = await aberta();
    t.abrir.mockReturnValue({ closed: of(undefined) });
    t.botao('Adicionar pagamento')!.click();
    await assentar(t.fixture);
    expect(t.texto()).toContain('Saldo a pagar R$ 60,00');
  });

  it('Emitir cupom fiscal: 201 recarrega o detalhe e chama printHtml com número e itens', async () => {
    const t = await aberta();
    t.botao('Emitir cupom fiscal')!.click();
    await assentar(t.fixture);
    t.http
      .expectOne(`${URL_VENDAS}/v-1/cupom-fiscal`)
      .flush({ cupomId: 'k-1', numero: 'CF-00000001', emitidoEm: '2026-01-02T11:00:00Z' });
    await assentar(t.fixture);
    t.http.expectOne(`${URL_VENDAS}/v-1`).flush({
      ...VENDA,
      cupomEmitido: true,
      cupomNumero: 'CF-00000001',
      cupomEmitidoEm: '2026-01-02T11:00:00Z',
    });
    await assentar(t.fixture);

    expect(t.printHtml).toHaveBeenCalledTimes(1);
    const [titulo, html] = t.printHtml.mock.calls[0];
    expect(titulo).toBe('Cupom fiscal CF-00000001');
    expect(html).toContain('CF-00000001');
    expect(html).toContain('Água 20L');
    expect(t.texto()).toContain('Cupom fiscal nº CF-00000001');
    expect(t.botao('Emitir cupom fiscal')).toBeUndefined();
  });

  it('409 CUPOM_JA_EMITIDO: GET, mostra número e data e não imprime', async () => {
    const t = await aberta();
    t.botao('Emitir cupom fiscal')!.click();
    await assentar(t.fixture);
    t.http.expectOne(`${URL_VENDAS}/v-1/cupom-fiscal`).flush(...erro(409, 'CUPOM_JA_EMITIDO'));
    await assentar(t.fixture);
    t.http.expectOne(`${URL_VENDAS}/v-1`).flush({
      ...VENDA,
      cupomEmitido: true,
      cupomNumero: 'CF-00000007',
      cupomEmitidoEm: '2026-01-02T11:00:00',
    });
    await assentar(t.fixture);

    expect(t.texto()).toContain('Cupom fiscal nº CF-00000007 · 02/01/2026 11:00');
    expect(t.el.querySelector('[role="alert"]')).toBeNull();
    expect(t.printHtml).not.toHaveBeenCalled();
  });

  it('Imprimir cupom, com o cupom já emitido, chama printHtml', async () => {
    const t = await aberta({
      ...VENDA,
      cupomEmitido: true,
      cupomNumero: 'CF-00000009',
      cupomEmitidoEm: '2026-01-02T11:00:00',
    });
    expect(t.botao('Emitir cupom fiscal')).toBeUndefined();
    t.botao('Imprimir cupom')!.click();
    expect(t.printHtml).toHaveBeenCalledTimes(1);
    expect(t.printHtml.mock.calls[0][1]).toContain('CF-00000009');
  });

  it('outro erro ao emitir aparece inline e não imprime', async () => {
    const t = await aberta();
    t.botao('Emitir cupom fiscal')!.click();
    await assentar(t.fixture);
    t.http.expectOne(`${URL_VENDAS}/v-1/cupom-fiscal`).flush(...erro(404, 'VENDA_NAO_ENCONTRADA'));
    await assentar(t.fixture);

    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain('Venda não encontrada.');
    expect(t.printHtml).not.toHaveBeenCalled();
  });
});
