import { ProdutoMarcaResponse, ProdutoResponse } from '../../core/api/models/estoque';
import { FuncionarioResponse } from '../../core/api/models/rh';
import { CriarPedidoRequest, PedidoResponse, StatusPedido } from '../../core/api/models/pedidos';
import { ItemCarrinho, itemNovo, mesmoItem, paraItemRequest } from '../vendas/carrinho';

const ROTULOS: Record<StatusPedido, string> = {
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};

export const rotuloStatus = (status: StatusPedido): string => ROTULOS[status] ?? status;

/** Item novo do pedido: quantidade 1 e preço de referência da marca (o desconto fica para depois). */
export const itemDoPedido = (produto: ProdutoResponse, marca: ProdutoMarcaResponse): ItemCarrinho =>
  itemNovo(produto, marca, 1);

/** Tocar de novo no mesmo produto+marca soma 1 em vez de duplicar a linha. */
export function adicionarItem(
  itens: readonly ItemCarrinho[],
  produto: ProdutoResponse,
  marca: ProdutoMarcaResponse,
): ItemCarrinho[] {
  return itens.some((i) => mesmoItem(i, produto, marca))
    ? alterarQuantidade(itens, produto, marca, 1)
    : [...itens, itemDoPedido(produto, marca)];
}

/** Soma `delta` (+1/−1) à quantidade; o item some ao chegar a 0. */
export function alterarQuantidade(
  itens: readonly ItemCarrinho[],
  produto: ProdutoResponse,
  marca: ProdutoMarcaResponse,
  delta: number,
): ItemCarrinho[] {
  return itens
    .map((i) => (mesmoItem(i, produto, marca) ? { ...i, quantidade: i.quantidade + delta } : i))
    .filter((i) => i.quantidade > 0);
}

export interface DadosDoPedido {
  funcionarioId: string;
  clienteId: string;
  enderecoEntregaId: string | null;
  itens: readonly ItemCarrinho[];
  funcionariosIds: readonly string[];
  observacao: string;
}

export const paraCriarPedidoRequest = (d: DadosDoPedido): CriarPedidoRequest => ({
  funcionarioId: d.funcionarioId,
  clienteId: d.clienteId,
  enderecoEntregaId: d.enderecoEntregaId,
  itens: d.itens.map(paraItemRequest),
  funcionariosIds: [...d.funcionariosIds],
  observacao: d.observacao.trim() || null,
});

/** Pré-marcação do início: os funcionários do cadastro que ainda estão ativos. */
export function selecaoInicial(
  pedido: Pick<PedidoResponse, 'funcionarios'>,
  ativos: readonly Pick<FuncionarioResponse, 'id'>[],
): Set<string> {
  const ids = new Set(ativos.map((f) => f.id));
  return new Set(pedido.funcionarios.map((f) => f.id).filter((id) => ids.has(id)));
}

export const podeIniciar = (status: StatusPedido): boolean => status === 'PENDENTE';

export const podeCancelar = (status: StatusPedido): boolean =>
  status === 'PENDENTE' || status === 'EM_ANDAMENTO';

export const podeConcluir = (status: StatusPedido): boolean => status === 'EM_ANDAMENTO';

export const podeRegistrarPerdas = (status: StatusPedido): boolean => status === 'CONCLUIDO';
