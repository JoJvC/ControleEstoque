import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { vi } from 'vitest';

import { ApiError } from '../../core/http/api-error';
import { OperatorStore } from '../../core/operator/operator-store';
import { ToastService } from '../../core/toast/toast-service';
import { ProdutosStore } from '../produtos/produtos-store';
import { AbastecimentoPage } from './abastecimento-page';
import { EstoqueStore } from './estoque-store';

const PRODUTOS = [
  { id: 'p1', nome: 'Copo', tamanho: null, estoqueMinimo: 5 },
  { id: 'p2', nome: 'Gelo', tamanho: '5kg', estoqueMinimo: 5 },
];
const SALDOS = [
  { produtoId: 'p1', quantidade: 20, estoqueMinimo: 5, abaixoMinimo: false },
  { produtoId: 'p2', quantidade: 2, estoqueMinimo: 5, abaixoMinimo: true },
];

function montar(
  produtoId: string | null = null,
  abastecer = vi.fn().mockResolvedValue(undefined),
  produtos = signal<unknown[]>(PRODUTOS),
) {
  const navegar = vi.fn().mockResolvedValue(true);
  TestBed.configureTestingModule({
    providers: [
      {
        provide: EstoqueStore,
        useValue: { abastecer, carregar: vi.fn(), itens: signal(SALDOS) },
      },
      { provide: ProdutosStore, useValue: { carregar: vi.fn(), produtos } },
      { provide: OperatorStore, useValue: { operator: signal({ id: 'f1' }) } },
      { provide: ToastService, useValue: { success: vi.fn() } },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: convertToParamMap(produtoId ? { produtoId } : {}) },
        },
      },
      { provide: Router, useValue: { navigateByUrl: navegar } },
    ],
  });
  const fixture = TestBed.createComponent(AbastecimentoPage);
  fixture.detectChanges();
  return { fixture, abastecer, navegar, produtos, el: fixture.nativeElement as HTMLElement };
}
type Montado = ReturnType<typeof montar>;

const botao = (t: Montado, rot: string) =>
  Array.from(t.el.querySelectorAll('button')).find((b) =>
    (b.textContent + (b.getAttribute('aria-label') ?? '')).includes(rot),
  ) as HTMLButtonElement;
const mais = (t: Montado, nome: string, vezes = 1) => {
  for (let i = 0; i < vezes; i++) {
    botao(t, `Aumentar ${nome}`).click();
    t.fixture.detectChanges();
  }
};
const qtdInputs = (t: Montado) =>
  Array.from(t.el.querySelectorAll('.item ce-quantity-stepper input')) as HTMLInputElement[];
const submeter = async (t: Montado) => {
  (t.el.querySelector('button[type="submit"]') as HTMLButtonElement).click();
  await t.fixture.whenStable();
  t.fixture.detectChanges();
};

describe('AbastecimentoPage', () => {
  it('título do header e do botão de submit: "Chegou mercadoria"', () => {
    const el = montar().el;
    expect(el.querySelector('ce-app-header')?.textContent).toContain('Chegou mercadoria');
    expect(el.querySelector('button[type="submit"]')?.textContent).toContain('Chegou mercadoria');
  });

  it('lista todos os produtos, abaixo do mínimo primeiro, com "tem N" e o flag do servidor', () => {
    const t = montar();
    const itens = Array.from(t.el.querySelectorAll('.item'));
    expect(itens.map((i) => i.querySelector('b')?.textContent)).toEqual(['Gelo 5kg', 'Copo']);
    expect(itens[0].textContent).toContain('tem 2');
    expect(itens[0].textContent).toContain('abaixo do mínimo (5)');
    expect(itens[1].textContent).not.toContain('abaixo do mínimo');
  });

  it('produtoId válido, depois de os produtos carregarem, pré-seleciona o item', () => {
    const t = montar('p2', undefined, signal<unknown[]>([]));
    expect(qtdInputs(t).length).toBe(0);
    t.produtos.set(PRODUTOS);
    t.fixture.detectChanges();
    const sel = t.el.querySelectorAll('.item--sel');
    expect(sel.length).toBe(1);
    expect(sel[0].textContent).toContain('Gelo');
    expect(sel[0].textContent).toContain('Custo unitário');
  });

  it.each([['inexistente'], [null]])('produtoId %s deixa tudo vazio, sem erro', (id) => {
    const t = montar(id);
    expect(t.el.querySelectorAll('.item--sel').length).toBe(0);
    expect(t.el.querySelector('[role="alert"]')).toBeNull();
  });

  it('submeter envia só os itens com quantidade e volta a /estoque', async () => {
    const t = montar();
    mais(t, 'Copo', 2);
    const custo = t.el.querySelector('.item--sel ce-money-input input') as HTMLInputElement;
    custo.value = '3,00';
    custo.dispatchEvent(new Event('input'));
    botao(t, 'Fornecedor entrega').click();
    t.fixture.detectChanges();
    botao(t, 'Usar soma dos itens').click();
    await submeter(t);
    expect(t.abastecer).toHaveBeenCalledWith({
      tipoFrete: 'TERCEIRIZADO',
      custoTotal: 6,
      funcionarioId: 'f1',
      observacao: null,
      itens: [{ produtoId: 'p1', quantidade: 2, custoUnitario: 3 }],
    });
    expect(t.navegar).toHaveBeenCalledWith('/estoque');
  });

  it('contador: Mais e Menos por clique, com resumo na barra', () => {
    const t = montar();
    mais(t, 'Copo', 2);
    expect(t.el.querySelector('.resumo')?.textContent).toContain('1 produto');
    expect(t.el.querySelector('.resumo')?.textContent).toContain('2 un');
    botao(t, 'Diminuir Copo').click();
    t.fixture.detectChanges();
    expect(t.el.querySelector('.resumo')?.textContent).toContain('1 un');
  });

  it('validação local: cada mensagem aparece com o campo faltando', async () => {
    const t = montar();
    await submeter(t);
    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain('ao menos um produto');
    mais(t, 'Copo');
    await submeter(t);
    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain('custo unitário');
    const custo = t.el.querySelector('.item--sel ce-money-input input') as HTMLInputElement;
    custo.value = '1,00';
    custo.dispatchEvent(new Event('input'));
    await submeter(t);
    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain('tipo de frete');
    botao(t, 'Retirada nossa').click();
    t.fixture.detectChanges();
    await submeter(t);
    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain('custo total');
    expect(t.abastecer).not.toHaveBeenCalled();
  });

  it('erro da API mostra userMessage em role="alert" e não navega', async () => {
    const abastecer = vi
      .fn()
      .mockRejectedValue(new ApiError(422, 'VALIDACAO', 'Quantidade inválida', null));
    const t = montar(null, abastecer);
    mais(t, 'Copo');
    const custo = t.el.querySelector('.item--sel ce-money-input input') as HTMLInputElement;
    custo.value = '1,00';
    custo.dispatchEvent(new Event('input'));
    botao(t, 'Retirada nossa').click();
    t.fixture.detectChanges();
    botao(t, 'Usar soma dos itens').click();
    await submeter(t);
    expect(abastecer).toHaveBeenCalled();
    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain('Quantidade inválida');
    expect(t.navegar).not.toHaveBeenCalled();
  });

  it('clique em voltar navega a /estoque sem abastecer', () => {
    const t = montar();
    (t.el.querySelector('ce-app-header button') as HTMLButtonElement).click();
    expect(t.navegar).toHaveBeenCalledWith('/estoque');
    expect(t.abastecer).not.toHaveBeenCalled();
  });
});
