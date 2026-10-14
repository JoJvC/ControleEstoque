// Espelho manual de src/vendas/ControleEstoque.Vendas.Contracts — não inventar campos.
// Enums serializam como string (JsonStringEnumConverter).

export type FormaPagamento = 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'DINHEIRO' | 'OUTRO';

export type StatusPagamento = 'PENDENTE' | 'PARCIAL' | 'PAGA';

export type TipoDesconto = 'VALOR' | 'PERCENTUAL';

export interface DescontoRequest {
  tipo: TipoDesconto;
  valor: number;
  motivo: string | null;
}

export interface ItemVendaRequest {
  produtoId: string;
  quantidade: number;
  precoUnitario: number;
  desconto: DescontoRequest | null;
}

export interface PagamentoRequest {
  forma: FormaPagamento;
  valor: number;
}

export interface CreateVendaRequest {
  clienteId: string;
  funcionarioId: string;
  enderecoEntregaId: string | null;
  itens: ItemVendaRequest[];
  pagamentos: PagamentoRequest[];
  cascosDevolvidos: number;
  cascosDevolvidosNaHora: boolean;
  sucataEntregue: number;
  observacao: string | null;
}

export interface VendaResponse {
  id: string;
  totalBruto: number;
  totalDesconto: number;
  totalLiquido: number;
  totalPago: number;
  saldoFiadoGerado: number;
  statusPagamento: StatusPagamento;
  saldoCascoCliente: number;
}

export interface ItemVendaResponse {
  produtoId: string;
  quantidade: number;
  precoUnitario: number;
  descontoTipo: TipoDesconto | null;
  descontoValor: number | null;
  motivoDesconto: string | null;
  totalItem: number;
}

export interface PagamentoResponse {
  forma: FormaPagamento;
  valor: number;
}

export interface VendaDetalheResponse {
  id: string;
  clienteId: string;
  funcionarioId: string;
  enderecoEntregaId: string | null;
  data: string;
  totalBruto: number;
  totalDesconto: number;
  totalLiquido: number;
  statusPagamento: StatusPagamento;
  observacao: string | null;
  cupomEmitido: boolean;
  itens: ItemVendaResponse[];
  pagamentos: PagamentoResponse[];
}

export interface AddPagamentoRequest {
  forma: FormaPagamento;
  valor: number;
}

export interface CupomFiscalResponse {
  cupomId: string;
  numero: string;
  emitidoEm: string;
}
