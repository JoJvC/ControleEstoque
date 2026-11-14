// Espelho manual dos DTOs de relatório nos Domain/Contracts de cada contexto — não inventar campos.
// DateOnly serializa como yyyy-MM-dd; decimal e long como number.
import { StatusCaixa } from './financeiro';
import { EstoqueItemResponse } from './estoque';

// vendas — Vendas.Domain/Models.cs
export interface FaturamentoPorProduto {
  produtoId: string;
  nome: string;
  quantidade: number;
  totalLiquido: number;
}

export interface FaturamentoPorDia {
  dia: string;
  totalLiquido: number;
}

export interface FaturamentoPorCategoria {
  categoria: string;
  quantidade: number;
  totalLiquido: number;
}

export interface RelatorioFaturamento {
  totalBruto: number;
  totalDesconto: number;
  totalLiquido: number;
  porProduto: FaturamentoPorProduto[];
  porDia: FaturamentoPorDia[];
  porCategoria: FaturamentoPorCategoria[];
}

export interface VendasPorFuncionario {
  funcionarioId: string;
  nome: string;
  quantidadeVendas: number;
  totalLiquido: number;
}

// financeiro — Financeiro.Domain/Models.cs
export interface DiaCaixa {
  data: string;
  status: StatusCaixa;
  saldoInicial: number;
  entradas: number;
  saidas: number;
  saldoFinal: number | null;
}

export interface DespesaPorTipo {
  tipoDespesa: string;
  total: number;
}

export interface RelatorioCaixa {
  dias: DiaCaixa[];
  despesasPorTipo: DespesaPorTipo[];
}

export interface SaldoFiadoCliente {
  clienteId: string;
  nome: string;
  saldoDevedor: number;
}

// clientes — Clientes.Domain/Models.cs
export interface SaldoCascoRelatorio {
  clienteId: string;
  nome: string;
  saldoCascos: number;
}

export interface SucataEntregueRelatorio {
  clienteId: string;
  nome: string;
  totalEntregue: number;
}

// estoque — wrapper anônimo de EstoqueEndpoints.cs; o item é o EstoqueItemResponse existente
export interface RelatorioEstoque {
  itens: EstoqueItemResponse[];
  alertasEstoqueMinimo: EstoqueItemResponse[];
}

// rh — RH.Domain/Models.cs
export interface SaldoFuncionario {
  funcionarioId: string;
  nome: string;
  saldoAPagar: number;
}
