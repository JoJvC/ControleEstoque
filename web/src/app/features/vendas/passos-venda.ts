import { ItemCarrinho, VasilhameCarrinho } from './carrinho';

export type PassoVenda = 'itens' | 'cascos' | 'pagamento';

export const ROTULO_PASSO: Readonly<Record<PassoVenda, string>> = {
  itens: 'Cliente e produtos',
  cascos: 'Cascos',
  pagamento: 'Pagamento',
};

/**
 * Passos ativos da venda no celular. 'cascos' só entra com retornável de tipo de casco resolvido
 * (mesma regra de `tiposCascoDoCarrinho`) ou com vasilhame comprado.
 */
export function passosDaVenda(
  itens: readonly ItemCarrinho[],
  vasilhames: readonly VasilhameCarrinho[],
): PassoVenda[] {
  const temCasco =
    vasilhames.length > 0 ||
    itens.some((i) => i.produto.tipo === 'RETORNAVEL' && Boolean(i.marca.tipoCascoResolvidoId));
  return temCasco ? ['itens', 'cascos', 'pagamento'] : ['itens', 'pagamento'];
}

/** Os mesmos bloqueios que hoje desabilitam o Confirmar da venda. */
export interface BloqueiosVenda {
  readonly carrinhoVazio: boolean;
  /** Cliente escolhido e, havendo mais de um endereço, o de entrega também. */
  readonly enderecoOk: boolean;
  readonly sucataExcede: boolean;
}

/**
 * Itens: o que já bloqueava o Cobrar (carrinho vazio, cliente/endereço). Cascos: a sucata acima do total,
 * porque o aviso só aparece nesse passo (do passo 1 o usuário sempre consegue ir corrigir). Pagamento:
 * os mesmos bloqueios do Confirmar. Nenhuma validação nova.
 */
export function podeAvancarPasso(passo: PassoVenda, b: BloqueiosVenda): boolean {
  if (passo === 'cascos') {
    return !b.sucataExcede;
  }
  const base = !b.carrinhoVazio && b.enderecoOk;
  return passo === 'itens' ? base : base && !b.sucataExcede;
}
