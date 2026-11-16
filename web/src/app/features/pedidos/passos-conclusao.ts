import { ItemCarrinho, VasilhameCarrinho } from '../vendas/carrinho';
import { PassoVenda, ROTULO_PASSO, passosDaVenda, podeAvancarPasso } from '../vendas/passos-venda';

export type PassoConclusao = PassoVenda | 'perdas';

export const ROTULO_PASSO_CONCLUSAO: Readonly<Record<PassoConclusao, string>> = {
  ...ROTULO_PASSO,
  perdas: 'Perdas e quebras',
};

/** Os passos da venda com 'perdas' antes de 'pagamento': o Confirmar continua no último passo. */
export function passosDaConclusao(
  itens: readonly ItemCarrinho[],
  vasilhames: readonly VasilhameCarrinho[],
): PassoConclusao[] {
  const passos = passosDaVenda(itens, vasilhames);
  return [...passos.slice(0, -1), 'perdas', 'pagamento'];
}

export interface BloqueiosConclusao {
  readonly carrinhoVazio: boolean;
  readonly sucataExcede: boolean;
  /** Item do pedido que não está mais no catálogo: não dá para montar o pedido de conclusão. */
  readonly itemForaDoCatalogo: boolean;
  /** Ocorrências completas e responsável no pedido (perdas-form.perdasProntas). */
  readonly perdasProntas: boolean;
}

/** O endereço vem do pedido (enderecoOk: true); 'perdas' e 'pagamento' pedem também as perdas prontas. */
export function podeAvancarConclusao(passo: PassoConclusao, b: BloqueiosConclusao): boolean {
  if (b.itemForaDoCatalogo) {
    return false;
  }
  const venda = { carrinhoVazio: b.carrinhoVazio, enderecoOk: true, sucataExcede: b.sucataExcede };
  if (passo === 'perdas') {
    return podeAvancarPasso('pagamento', venda) && b.perdasProntas;
  }
  const ok = podeAvancarPasso(passo, venda);
  return passo === 'pagamento' ? ok && b.perdasProntas : ok;
}
