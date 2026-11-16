import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ProdutoResponse } from '../../core/api/models/estoque';
import { produtoResp } from '../../core/api/testing';
import { ItemCarrinho } from './carrinho';
import { ItemVendaSheet, ItemVendaSheetDados } from './item-venda-sheet';
import { itemCarrinho } from './testing';

const PRODUTO: ProdutoResponse = produtoResp({ nome: 'Água 20L' });

async function montar(existente: ItemCarrinho | null) {
  const close = vi.fn();
  const dados: ItemVendaSheetDados = {
    produto: PRODUTO,
    marca: PRODUTO.marcas[0],
    existente,
  };
  await TestBed.configureTestingModule({
    imports: [ItemVendaSheet],
    providers: [
      { provide: DIALOG_DATA, useValue: dados },
      { provide: DialogRef, useValue: { close } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ItemVendaSheet);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const botao = (texto: string) =>
    Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes(texto),
    ) as HTMLButtonElement;
  return { fixture, el, close, botao };
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

  it('o botão de remover fecha com "remover"', async () => {
    const existente = itemCarrinho({ produto: PRODUTO, quantidade: 2 });
    const { fixture, close, botao } = await montar(existente);

    botao('Remover do carrinho').click();
    await fixture.whenStable();

    expect(close).toHaveBeenCalledWith('remover');
  });
});
