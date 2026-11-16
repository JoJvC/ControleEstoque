// Espelho manual de src/vendas/ControleEstoque.Vendas.Contracts (VendasContracts.cs:134-188) — não inventar campos.

import { DescontoRequest, ItemVendaRequest } from './vendas';

export type StatusPedido = 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';
export type GalaoPerda = 'CHEIO' | 'VAZIO';
export type MotivoPerda = 'PERDIDO' | 'QUEBRADO';

export interface CriarPedidoRequest {
  funcionarioId: string;
  clienteId: string;
  /** Id de um endereço do cliente, não texto livre. */
  enderecoEntregaId: string | null;
  itens: ItemVendaRequest[];
  funcionariosIds: string[];
  observacao: string | null;
}

export interface IniciarPedidoRequest {
  funcionarioId: string;
  funcionariosIds: string[];
}

export interface CancelarPedidoRequest {
  funcionarioId: string;
}

export interface PedidoResumoResponse {
  id: string;
  clienteId: string;
  enderecoEntregaId: string | null;
  status: StatusPedido;
  observacao: string | null;
  createdAt: string;
  iniciadoEm: string | null;
  canceladoEm: string | null;
}

export interface ItemPedidoResponse {
  produtoId: string;
  marcaId: string;
  quantidade: number;
  precoUnitario: number;
  desconto: DescontoRequest | null;
}

export interface FuncionarioPedidoResponse {
  id: string;
  nome: string;
}

export interface PerdaPedidoResponse {
  galao: GalaoPerda;
  produtoId: string | null;
  marcaId: string | null;
  tipoCascoId: string;
  quantidade: number;
  motivo: MotivoPerda;
  registradoEm: string;
}

export interface PedidoResponse extends PedidoResumoResponse {
  createdBy: string;
  canceladoPor: string | null;
  itens: ItemPedidoResponse[];
  funcionarios: FuncionarioPedidoResponse[];
  vendaId: string | null;
  perdas: PerdaPedidoResponse[];
}
