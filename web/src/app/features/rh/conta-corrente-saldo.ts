import { LancamentoResponse, TipoLancamentoFuncionario } from '../../core/api/models/rh';

export interface LinhaExtrato {
  readonly lancamento: LancamentoResponse;
  /** Efeito no saldo a pagar: + soma (diária), − subtrai (vale, pagamento). */
  readonly delta: number;
  /** Saldo a pagar logo depois deste lançamento. */
  readonly saldoApos: number;
}

/** Regra do back: saldo = diárias − vales − pagamentos (infra/postgres/init.sql, vw_saldo_funcionario). */
export function deltaDoLancamento(tipo: TipoLancamentoFuncionario, valor: number): number {
  return tipo === 'DIARIA' ? valor : -valor;
}

/** Saldo que ficaria depois de lançar `valor` de `tipo` sobre `saldo` (prévia da sheet). */
export function saldoPrevisto(
  saldo: number,
  tipo: TipoLancamentoFuncionario,
  valor: number,
): number {
  return saldo + deltaDoLancamento(tipo, valor);
}

/**
 * Da mais nova para a mais antiga. A âncora é o saldo atual (do mesmo GET dos lançamentos):
 * o saldo da linha anterior é o da seguinte menos o delta da seguinte.
 */
export function saldoPorLancamento(
  lancamentos: readonly LancamentoResponse[],
  saldoAPagar: number,
): LinhaExtrato[] {
  // ponytail: empate de timestamp mantém a ordem da API (sort estável); sem desempate por id, o saldo
  // intermediário dessas linhas pode trocar, o final e a âncora seguem certos.
  const ordenados = [...lancamentos].sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
  let saldoApos = saldoAPagar;
  return ordenados.map((lancamento) => {
    const delta = deltaDoLancamento(lancamento.tipo, lancamento.valor);
    const linha = { lancamento, delta, saldoApos };
    saldoApos -= delta;
    return linha;
  });
}
