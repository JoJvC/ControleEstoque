import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { VendaDetalheResponse } from '../../core/api/models/vendas';
import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
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
  TestBed.configureTestingModule({
    providers: [
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
  return { fixture, http, navegar, el, texto: () => (el.textContent ?? '').replace(/\s+/g, ' ') };
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

  it('área de ações tem só o botão Editar, que navega para a edição', async () => {
    const t = await montar();
    t.http.expectOne(`${URL_VENDAS}/v-1`).flush(VENDA);
    t.http.expectOne(`${URL_CLIENTES}/c-1`).flush({ id: 'c-1', nome: 'Maria' });
    t.http.expectOne(`${URL_PRODUTOS}/p-agua`).flush({ id: 'p-agua', nome: 'Água 20L' });
    await assentar(t.fixture);
    const acoes = t.el.querySelector('[data-testid="venda-acoes"]');
    expect(acoes).not.toBeNull();
    const botoes = acoes!.querySelectorAll('button');
    expect(botoes).toHaveLength(1);
    expect(botoes[0].textContent).toContain('Editar');
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
