import { SelectOpcao } from '../../ui/atoms/select';
import { FORMAS, PagamentoEdicao } from '../../ui/organisms/pagamento-lista';

export const FORMA_CREDITO = 'CREDITO_CLIENTE';

const OPCAO_CREDITO: SelectOpcao = { value: FORMA_CREDITO, label: 'Crédito do cliente' };

/**
 * Formas oferecidas na venda: 'Crédito do cliente' só com cliente (crédito não nulo) e crédito > 0.
 * `FORMAS` fica sem ela: pagar fiado com crédito (receber-fiado-sheet) e pagar venda lançada não usam.
 */
export function formasDaVenda(creditoDisponivel: number | null): SelectOpcao[] {
  return creditoDisponivel !== null && creditoDisponivel > 0 ? [...FORMAS, OPCAO_CREDITO] : FORMAS;
}

/** Valor da linha de crédito: nunca passa do que sobra do crédito (disponível − já usado em outras linhas). */
export function limitarCredito(
  valorDigitado: number,
  creditoDisponivel: number,
  jaUsadoEmOutrasLinhasCredito: number,
): number {
  const sobra = Math.round((creditoDisponivel - jaUsadoEmOutrasLinhasCredito) * 100) / 100;
  return Math.max(0, Math.min(valorDigitado, sobra));
}

/**
 * Limita as linhas de crédito ao disponível; sem crédito (null ou 0) a linha de crédito sai da lista,
 * para o crédito de um cliente nunca ir no pedido de outro nem ficar órfã com 0,00.
 */
export function limitarPagamentos(
  pagamentos: readonly PagamentoEdicao[],
  creditoDisponivel: number | null,
): readonly PagamentoEdicao[] {
  if (creditoDisponivel === null || creditoDisponivel <= 0) {
    return pagamentos.some((p) => p.forma === FORMA_CREDITO)
      ? pagamentos.filter((p) => p.forma !== FORMA_CREDITO)
      : pagamentos;
  }
  let usado = 0;
  return pagamentos.map((p) => {
    if (p.forma !== FORMA_CREDITO || p.valor === null) {
      return p;
    }
    const valor = limitarCredito(p.valor, creditoDisponivel, usado);
    usado += valor;
    return valor === p.valor ? p : { ...p, valor };
  });
}

/**
 * Teto do crédito na edição, espelho do servidor (`PostgresVendaLookup.CreditoDisponivel`):
 * max(0, saldo + estorno dos lançamentos da própria venda). O estorno é o crédito que ela usou mais o
 * fiado que gerou, ou seja, o total líquido menos o que foi pago nas outras formas.
 */
export function creditoNaEdicao(
  saldo: number,
  venda: { totalLiquido: number; pagamentos: readonly { forma: string; valor: number }[] },
): number {
  const semCredito = venda.pagamentos
    .filter((p) => p.forma !== FORMA_CREDITO)
    .reduce((soma, p) => soma + Math.round(p.valor * 100), 0);
  const estorno = Math.max(0, Math.round(venda.totalLiquido * 100) - semCredito);
  return Math.max(0, Math.round(saldo * 100) + estorno) / 100;
}
