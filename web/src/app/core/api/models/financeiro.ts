// Espelho manual de src/financeiro/ControleEstoque.Financeiro.Contracts — não inventar campos.

export interface PagamentoFiadoRequest {
  valor: number;
  /** Texto livre (vai só para a observação do lançamento). */
  forma: string | null;
}

export interface PagamentoFiadoResponse {
  novoSaldoFiado: number;
}
