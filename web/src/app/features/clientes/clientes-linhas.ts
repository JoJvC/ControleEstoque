import { ClienteResponse } from '../../core/api/models/clientes';
import { SaldoCascoRelatorio, SaldoFiadoCliente } from '../../core/api/models/relatorios';

export type FiltroClientes = 'todos' | 'fiado' | 'casco';

export interface LinhaCliente {
  id: string;
  nome: string;
  secundario?: string;
  saldoCascos?: number;
  /** Saldo único do relatório: negativo é fiado, positivo é crédito; ausente = em dia. */
  saldo?: number;
}

/** Valor de `?filtro=`: só 'fiado' e 'casco' valem; ausente (undefined/null) ou desconhecido é 'todos'. */
export function normalizarFiltro(v: string | null | undefined): FiltroClientes {
  return v === 'fiado' || v === 'casco' ? v : 'todos';
}

/** URL da lista (id nulo) ou do detalhe, levando o chip no query param; 'todos' omite o param. */
export function urlLista(id: string | null | undefined, filtro: FiltroClientes): string {
  const base = id ? `/clientes/${id}` : '/clientes';
  return filtro === 'todos' ? base : `${base}?filtro=${filtro}`;
}

/**
 * Linhas da lista. Em 'todos' a API já filtrou por nome; nos relatórios o termo filtra aqui.
 * Os saldos são só junção por id (os relatórios já trazem o saldo pronto, sem soma no front).
 */
export function montarLinhas(
  filtro: FiltroClientes,
  clientes: readonly ClienteResponse[],
  fiado: readonly SaldoFiadoCliente[],
  cascos: readonly SaldoCascoRelatorio[],
  termo: string,
): LinhaCliente[] {
  const saldos = new Map(fiado.map((f) => [f.clienteId, f.saldo]));
  const saldoCascos = new Map(cascos.map((c) => [c.clienteId, c.saldoCascos]));
  // Saldo 0 ou fora do relatório: sem selo (undefined). Negativo passa como vem.
  const selo = (n: number | undefined) => (n === 0 ? undefined : n);
  const comSaldos = (id: string, nome: string, secundario?: string): LinhaCliente => ({
    id,
    nome,
    secundario,
    saldoCascos: selo(saldoCascos.get(id)),
    saldo: selo(saldos.get(id)),
  });

  if (filtro === 'todos') {
    return clientes.map((c) => {
      const principal = c.enderecos.find((e) => e.principal);
      return comSaldos(c.id, c.nome, principal?.bairro || c.telefone || undefined);
    });
  }
  const busca = termo.trim().toLowerCase();
  // 'Com fiado' fica só com saldo negativo: o relatório também traz quem tem crédito.
  const itens: readonly { clienteId: string; nome: string }[] =
    filtro === 'fiado' ? fiado.filter((f) => f.saldo < 0) : cascos;
  return itens
    .filter((i) => i.nome.toLowerCase().includes(busca))
    .map((i) => comSaldos(i.clienteId, i.nome));
}
