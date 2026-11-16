import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ProdutoResponse } from '../../core/api/models/estoque';
import { produtoResp } from '../../core/api/testing';
import { ConfigStore } from '../../core/config/app-config';
import { ItemCarrinho } from './carrinho';
import { ItemVendaSheet, ItemVendaSheetDados } from './item-venda-sheet';
import { itemCarrinho } from './testing';

const PRODUTO: ProdutoResponse = produtoResp({ nome: 'Água 20L' });

async function montar(existente: ItemCarrinho | null, clienteId: string | null = 'c-1') {
  const close = vi.fn();
  const dados: ItemVendaSheetDados = {
    produto: PRODUTO,
    marca: PRODUTO.marcas[0],
    existente,
    clienteId,
  };
  await TestBed.configureTestingModule({
    imports: [ItemVendaSheet],
    providers: [
      { provide: DIALOG_DATA, useValue: dados },
      { provide: DialogRef, useValue: { close } },
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ItemVendaSheet);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const botao = (texto: string) =>
    Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(texto),
    ) as HTMLButtonElement;
  const http = TestBed.inject(HttpTestingController);
  return { fixture, el, close, botao, http };
}

describe('ItemVendaSheet', () => {
  it('desconto sem motivo não fecha e mostra o erro inline', async () => {
    const { fixture, el, close, botao } = await montar(null);

    (el.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
    await fixture.whenStable();

    // O primeiro campo de dinheiro é o preço; o segundo, o valor do desconto.
    const dinheiro = el.querySelectorAll<HTMLInputElement>('ce-money-input input');
    dinheiro[1].value = '500';
    dinheiro[1].dispatchEvent(new Event('input'));
    await fixture.whenStable();

    botao('Adicionar ao carrinho').click();
    await fixture.whenStable();

    expect(close).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Informe o motivo do desconto.',
    );
  });

  it('com motivo, confirma e fecha com o item', async () => {
    const { fixture, el, close, botao } = await montar(null);

    (el.querySelector('input[type="checkbox"]') as HTMLInputElement).click();
    await fixture.whenStable();
    const dinheiro = el.querySelectorAll<HTMLInputElement>('ce-money-input input');
    dinheiro[1].value = '500';
    dinheiro[1].dispatchEvent(new Event('input'));
    const motivo = el.querySelector('ce-input input') as HTMLInputElement;
    motivo.value = 'cliente antigo';
    motivo.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    botao('Adicionar ao carrinho').click();

    expect(close).toHaveBeenCalledWith(
      itemCarrinho({
        produto: PRODUTO,
        desconto: { tipo: 'VALOR', valor: 5, motivo: 'cliente antigo' },
      }),
    );
  });

  it('não oferece opção de vasilhame no item: o vasilhame é uma linha própria da venda', async () => {
    const { el, close, botao } = await montar(null);

    expect(el.textContent).not.toMatch(/vasilhame/i);
    expect(el.querySelectorAll('input[type="checkbox"]')).toHaveLength(1); // só o desconto
    botao('Adicionar ao carrinho').click();
    expect(close).toHaveBeenCalledWith(itemCarrinho({ produto: PRODUTO }));
  });

  it('Repetir último preço com 200 preenche o preço e o item confirmado', async () => {
    const { fixture, el, close, botao, http } = await montar(null);

    botao('Repetir último preço').click();
    const req = http.expectOne((r) => r.url === '/api/vendas/v1/vendas/ultimo-preco');
    expect(req.request.params.get('produtoId')).toBe(PRODUTO.id);
    expect(req.request.params.get('marcaId')).toBe(PRODUTO.marcas[0].marcaId);
    req.flush({ vendaId: 'v-1', data: '2026-11-01T10:00:00', precoUnitario: 12 });
    await fixture.whenStable();

    expect(el.querySelector<HTMLInputElement>('ce-money-input input')!.value).toBe('12,00');
    expect(el.textContent).toContain('Última venda em 01/11/2026');
    botao('Adicionar ao carrinho').click();
    expect(close).toHaveBeenCalledWith(itemCarrinho({ produto: PRODUTO, precoUnitario: 12 }));
  });

  it('Repetir último preço com 204 avisa, mantém o preço e desabilita o botão', async () => {
    const { fixture, el, botao, http } = await montar(null);
    const antes = el.querySelector<HTMLInputElement>('ce-money-input input')!.value;

    botao('Repetir último preço').click();
    http
      .expectOne((r) => r.url === '/api/vendas/v1/vendas/ultimo-preco')
      .flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(el.textContent).toContain('Nenhuma venda anterior deste produto para este cliente');
    expect(el.querySelector<HTMLInputElement>('ce-money-input input')!.value).toBe(antes);
    expect(botao('Repetir último preço').disabled).toBe(true);
  });

  it('sem cliente o botão fica desabilitado e não sai requisição', async () => {
    const { el, botao, http } = await montar(null, null);

    expect(botao('Repetir último preço').disabled).toBe(true);
    expect(el.textContent).toContain('Escolha o cliente para repetir o último preço');
    botao('Repetir último preço').click();
    http.expectNone(() => true);
  });

  it('o botão de remover fecha com "remover"', async () => {
    const existente = itemCarrinho({ produto: PRODUTO, quantidade: 2 });
    const { fixture, close, botao } = await montar(existente);

    botao('Remover do carrinho').click();
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith('remover');
  });
});
