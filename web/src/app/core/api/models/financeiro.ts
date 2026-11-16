// Espelho manual de src/financeiro/ControleEstoque.Financeiro.Contracts — não inventar campos.

import { FormaPagamento } from './vendas';

export interface PagamentoFiadoRequest {
  valor: number;
  /** Texto livre (vai só para a observação do lançamento). */
  forma: string | null;
}

export interface VendaAbatida {
  vendaId: string;
  data: string;
  valorAbatido: number;
  novoStatus: 'PENDENTE' | 'PARCIAL' | 'PAGA';
  restante: number;
}

export interface PagamentoFiadoResponse {
  novoSaldoFiado: number;
  /** Saldo único: negativo é fiado, positivo é crédito. */
  novoSaldo: number;
  /** Da venda mais antiga para a mais nova (FIFO). */
  vendasAbatidas: VendaAbatida[];
  valorEmCredito: number;
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
  caixasComDiariasPendentes: CaixaDiariasPendentes[];
}

export interface CaixaDiariasPendentes {
  id: string;
  data: string;
}

export interface CreateDespesaRequest {
  tipoDespesaId: string;
  valor: number;
  descricao: string | null;
}

export interface DiariaFechamentoRequest {
  funcionarioId: string;
  /** Nulo: o servidor usa a diária cadastrada do funcionário. */
  valor: number | null;
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

export interface ItemListaCaixa {
  id: string;
  data: string;
  status: StatusCaixa;
  fechadoPeloSistema: boolean;
  diariasPendentes: boolean;
  saldoInicial: number;
  totalEntradas: number;
  totalSaidas: number;
  saldoFinal: number;
  dinheiroNaGaveta: number;
}

export interface PessoaCaixa {
  id: string;
  nome: string;
}

export interface EntradaCaixa {
  hora: string;
  origem: 'VENDA' | 'RECEBIMENTO_FIADO';
  clienteId: string;
  clienteNome: string;
  forma: FormaPagamento;
  valor: number;
}

export interface SaidaCaixa {
  hora: string;
  descricao: string;
  forma: FormaPagamento;
  valor: number;
}

export interface TotalPorForma {
  forma: FormaPagamento;
  valor: number;
}

export interface DiariaLancada {
  funcionarioId: string;
  funcionarioNome: string;
  valor: number;
  hora: string;
}

export interface DetalheCaixa {
  id: string;
  data: string;
  status: StatusCaixa;
  saldoInicial: number;
  entradas: EntradaCaixa[];
  saidas: SaidaCaixa[];
  totaisPorForma: TotalPorForma[];
  totalEntradas: number;
  totalSaidas: number;
  saldoFinal: number;
  dinheiroNaGaveta: number;
  diarias: { lancadas: DiariaLancada[]; pendentes: boolean };
  abertura: { por: PessoaCaixa | null; em: string };
  /** Nulo se o caixa não está FECHADO. */
  fechamento: { em: string | null; pelaSistema: boolean; por: PessoaCaixa | null } | null;
}

export interface ReabrirCaixaRequest {
  funcionarioId: string;
  motivo: string;
}

export interface LancarDiariasRequest {
  diarias: DiariaFechamentoRequest[];
}

export interface LancamentoDiariasResponse {
  caixaId: string;
  data: string;
  diariasLancadas: number;
}
