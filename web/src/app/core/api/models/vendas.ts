// Espelho manual de src/vendas/ControleEstoque.Vendas.Contracts — não inventar campos.
// Enums serializam como string (JsonStringEnumConverter).

export type FormaPagamento =
  'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'DINHEIRO' | 'OUTRO' | 'CREDITO_CLIENTE';

export type StatusPagamento = 'PENDENTE' | 'PARCIAL' | 'PAGA';

export type TipoDesconto = 'VALOR' | 'PERCENTUAL';

export interface DescontoRequest {
  tipo: TipoDesconto;
  valor: number;
  motivo: string | null;
}

export interface ItemVendaRequest {
  produtoId: string;
  marcaId: string;
  quantidade: number;
  precoUnitario: number;
  desconto: DescontoRequest | null;
}

export type ModoCreditoVasilhame = 'ABATER_CREDITO' | 'COMPRAR' | 'CONVERTER_CASCO';

/** Vasilhame vendido por tipo de casco; `modoCredito` omitido vale ABATER_CREDITO. */
export interface VasilhameRequest {
  tipoCascoId: string;
  quantidade: number;
  precoUnitario: number;
  modoCredito?: ModoCreditoVasilhame;
}

/** Casco devolvido ou sucata entregue, por tipo de casco. */
export interface CascoPorTipoRequest {
  tipoCascoId: string;
  quantidade: number;
}

/** Sucata entregue por tipo de casco; o valor unitário (≥ 0) vira desconto da venda. */
export interface SucataEntregueRequest {
  tipoCascoId: string;
  quantidade: number;
  valorUnitario: number;
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
  vasilhames: VasilhameRequest[];
  pagamentos: PagamentoRequest[];
  cascosDevolvidos: CascoPorTipoRequest[];
  sucataEntregue: SucataEntregueRequest[];
  observacao: string | null;
  /** Lança a venda num caixa aberto de outra data (caixa reaberto); sem ele, vai para o caixa do dia. */
  caixaId?: string;
}

export interface CancelarVendaRequest {
  funcionarioId: string;
}

export interface VendaResponse {
  id: string;
  totalBruto: number;
  totalDesconto: number;
  totalLiquido: number;
  totalPago: number;
  descontoSucata: number;
  creditoGerado: number;
  saldoFiadoGerado: number;
  statusPagamento: StatusPagamento;
  saldoCascoCliente: number;
  saldoCascoClientePorTipo: SaldoCascoPorTipoResponse[];
}

export interface UltimoPrecoResponse {
  vendaId: string;
  data: string;
  precoUnitario: number;
}

export interface SaldoCascoPorTipoResponse {
  tipoCascoId: string;
  nome: string;
  saldo: number;
}

export interface ItemVendaResponse {
  produtoId: string;
  marcaId: string;
  tipoCascoId: string | null;
  quantidade: number;
  precoUnitario: number;
  descontoTipo: TipoDesconto | null;
  descontoValor: number | null;
  motivoDesconto: string | null;
  totalItem: number;
}

export interface VasilhameResponse {
  tipoCascoId: string;
  quantidade: number;
  quantidadeAbatida: number;
  precoUnitario: number;
  modo: ModoCreditoVasilhame;
  total: number;
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
  cupomNumero: string | null;
  cupomEmitidoEm: string | null;
  itens: ItemVendaResponse[];
  vasilhames: VasilhameResponse[];
  pagamentos: PagamentoResponse[];
  cascosDevolvidos: CascoPorTipoRequest[];
  sucataEntregue: SucataEntregueRequest[];
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
