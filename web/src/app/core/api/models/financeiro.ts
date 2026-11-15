// Espelho manual de src/financeiro/ControleEstoque.Financeiro.Contracts — não inventar campos.

export interface PagamentoFiadoRequest {
  valor: number;
  /** Texto livre (vai só para a observação do lançamento). */
  forma: string | null;
}

export interface PagamentoFiadoResponse {
  novoSaldoFiado: number;
}

export type StatusCaixa = 'ABERTO' | 'FECHADO';

export interface AbrirCaixaRequest {
  /** yyyy-MM-dd; a API assume hoje quando omitido. */
  data: string | null;
  saldoInicial: number;
}

export interface CaixaResponse {
  id: string;
  data: string;
  status: StatusCaixa;
  saldoInicial: number;
  totalEntradas: number | null;
  totalSaidas: number | null;
  saldoFinal: number | null;
}

export interface DespesaResponse {
  id: string;
  tipoDespesaId: string;
  tipoDespesa: string;
  valor: number;
  descricao: string | null;
}

export interface ResumoCaixaResponse {
  caixa: CaixaResponse;
  entradas: number;
  totalDespesas: number;
  saldoParcial: number;
  despesas: DespesaResponse[];
}

export interface CreateDespesaRequest {
  tipoDespesaId: string;
  valor: number;
  descricao: string | null;
}

export interface DiariaFechamentoRequest {
  funcionarioId: string;
  valor: number;
}

export interface FecharCaixaRequest {
  diarias: DiariaFechamentoRequest[] | null;
}

export interface FechamentoResponse {
  caixaId: string;
  data: string;
  totalEntradas: number;
  totalSaidas: number;
  saldoFinal: number;
  diariasLancadas: number;
}

export interface CreateTipoDespesaRequest {
  nome: string;
}

export interface TipoDespesaResponse {
  id: string;
  nome: string;
}
