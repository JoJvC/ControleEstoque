import { ClienteResponse } from '../../core/api/models/clientes';
import { SaldoCascoRelatorio, SaldoFiadoCliente } from '../../core/api/models/relatorios';

export type FiltroClientes = 'todos' | 'fiado' | 'casco';

export interface LinhaCliente {
  id: string;
  nome: string;
  secundario?: string;
  saldoCascos?: number;
  saldoFiado?: number;
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
  const saldoFiado = new Map(fiado.map((f) => [f.clienteId, f.saldoDevedor]));
  const saldoCascos = new Map(cascos.map((c) => [c.clienteId, c.saldoCascos]));
  // Saldo 0 ou fora do relatório: sem selo (undefined). Negativo passa como vem.
  const selo = (n: number | undefined) => (n === 0 ? undefined : n);
  const comSaldos = (id: string, nome: string, secundario?: string): LinhaCliente => ({
    id,
    nome,
    secundario,
    saldoCascos: selo(saldoCascos.get(id)),
    saldoFiado: selo(saldoFiado.get(id)),
  });

  if (filtro === 'todos') {
    return clientes.map((c) => {
      const principal = c.enderecos.find((e) => e.principal);
      return comSaldos(c.id, c.nome, principal?.bairro || c.telefone || undefined);
    });
  }
  const busca = termo.trim().toLowerCase();
  const itens: readonly { clienteId: string; nome: string }[] = filtro === 'fiado' ? fiado : cascos;
  return itens
    .filter((i) => i.nome.toLowerCase().includes(busca))
    .map((i) => comSaldos(i.clienteId, i.nome));
}
