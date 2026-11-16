import { ProdutoResponse, TipoCascoResponse } from '../../core/api/models/estoque';
import { ConcluirPedidoRequest, ItemPedidoResponse } from '../../core/api/models/pedidos';
import { ItemCarrinho, RascunhoVenda, paraCreateVendaRequest } from '../vendas/carrinho';

export interface ItensDoPedido {
  readonly itens: readonly ItemCarrinho[];
  /** Itens cujo produto ou marca não está mais no catálogo: não entram em `itens` e bloqueiam o Confirmar. */
  readonly foraDoCatalogo: number;
}

/** O pedido só guarda ids: o item do carrinho precisa do produto e da marca do catálogo. */
export function itensDoPedido(
  itens: readonly ItemPedidoResponse[],
  produtos: readonly ProdutoResponse[],
): ItensDoPedido {
  const resolvidos: ItemCarrinho[] = [];
  for (const i of itens) {
    const produto = produtos.find((p) => p.id === i.produtoId);
    const marca = produto?.marcas.find((m) => m.marcaId === i.marcaId);
    if (!produto || !marca) {
      continue;
    }
    resolvidos.push({
      produto,
      marca,
      quantidade: i.quantidade,
      precoUnitario: i.precoUnitario,
      desconto: i.desconto && {
        tipo: i.desconto.tipo,
        valor: i.desconto.valor,
        motivo: i.desconto.motivo ?? '',
      },
    });
  }
  return { itens: resolvidos, foraDoCatalogo: itens.length - resolvidos.length };
}

/**
 * Mesmo corpo da venda sem cliente nem endereço (vêm do pedido) e sem caixa; a observação vai nula.
 * Casco e sucata só vão para os tipos de casco do carrinho, como na venda.
 */
export function paraConcluirPedidoRequest(
  rascunho: Omit<RascunhoVenda, 'clienteId' | 'enderecoEntregaId'>,
  tiposCasco: readonly TipoCascoResponse[],
): ConcluirPedidoRequest {
  const venda = paraCreateVendaRequest(
    { ...rascunho, clienteId: '', enderecoEntregaId: null },
    tiposCasco,
  );
  return {
    funcionarioId: venda.funcionarioId,
    itens: venda.itens,
    vasilhames: venda.vasilhames,
    pagamentos: venda.pagamentos,
    cascosDevolvidos: venda.cascosDevolvidos,
    sucataEntregue: venda.sucataEntregue,
    observacao: venda.observacao,
  };
}
