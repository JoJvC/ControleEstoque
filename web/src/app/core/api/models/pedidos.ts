// Espelho manual de src/vendas/ControleEstoque.Vendas.Contracts (VendasContracts.cs:134-188) — não inventar campos.

import {
  CascoPorTipoRequest,
  DescontoRequest,
  ItemVendaRequest,
  PagamentoRequest,
  SucataEntregueRequest,
  VasilhameRequest,
} from './vendas';

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

/** Cliente e endereço vêm do pedido; os itens são os do pedido, já editados. */
export interface ConcluirPedidoRequest {
  funcionarioId: string;
  itens: ItemVendaRequest[];
  vasilhames: VasilhameRequest[];
  pagamentos: PagamentoRequest[];
  cascosDevolvidos: CascoPorTipoRequest[];
  sucataEntregue: SucataEntregueRequest[];
  observacao: string | null;
}

/** CHEIO leva produto+marca; VAZIO leva o tipo de casco. */
export interface OcorrenciaPerdaRequest {
  galao: GalaoPerda;
  produtoId: string | null;
  marcaId: string | null;
  tipoCascoId: string | null;
  quantidade: number;
  motivo: MotivoPerda;
}

/** Os responsáveis são os funcionários do pedido: o request não leva o campo. */
export interface RegistrarPerdasRequest {
  funcionarioId: string;
  ocorrencias: OcorrenciaPerdaRequest[];
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
