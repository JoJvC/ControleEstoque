import { CascoClientePorTipo } from '../../core/api/models/clientes';
import { TipoCascoResponse } from '../../core/api/models/estoque';
import { PagamentoFiadoResponse } from '../../core/api/models/financeiro';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';

const preco = new PrecoPipe();

export interface LinhaRecolher {
  tipoCascoId: string;
  nome: string;
  saldo: number;
}

export interface TipoConversivel {
  tipoCascoId: string;
  nome: string;
  saldo: number;
  precoVasilhame: number;
}

/** Uma linha por tipo (ordem da lista de tipos), saldo 0 quando o tipo não vem nos saldos; tipo só nos saldos entra no fim. */
export function linhasRecolher(
  tipos: readonly TipoCascoResponse[],
  cascosPorTipo: readonly CascoClientePorTipo[],
): LinhaRecolher[] {
  const saldos = new Map(cascosPorTipo.map((c) => [c.tipoCascoId, c]));
  const linhas = tipos.map((t) => ({
    tipoCascoId: t.id,
    nome: t.nome,
    saldo: saldos.get(t.id)?.saldo ?? 0,
  }));
  const conhecidos = new Set(tipos.map((t) => t.id));
  for (const c of cascosPorTipo) {
    if (!conhecidos.has(c.tipoCascoId)) {
      linhas.push({ tipoCascoId: c.tipoCascoId, nome: c.nome, saldo: c.saldo });
    }
  }
  return linhas;
}

/** Só as linhas com quantidade > 0; lista vazia = não envia nada. */
export function corpoDevolucao(
  contadores: Readonly<Record<string, number>>,
): { tipoCascoId: string; quantidade: number }[] {
  return Object.entries(contadores)
    .filter(([, quantidade]) => quantidade > 0)
    .map(([tipoCascoId, quantidade]) => ({ tipoCascoId, quantidade }));
}

/** Tipos da lista com saldo de casco > 0, com o preço padrão do vasilhame. */
export function tiposConversiveis(
  tipos: readonly TipoCascoResponse[],
  cascosPorTipo: readonly CascoClientePorTipo[],
): TipoConversivel[] {
  const saldos = new Map(cascosPorTipo.map((c) => [c.tipoCascoId, c.saldo]));
  return tipos
    .map((t) => ({
      tipoCascoId: t.id,
      nome: t.nome,
      saldo: saldos.get(t.id) ?? 0,
      precoVasilhame: t.precoVasilhame,
    }))
    .filter((t) => t.saldo > 0);
}

/** Linhas do resultado do Receber fiado: vendas quitadas/abatidas (FIFO) e o que virou crédito. */
export function resumoPagamentoFiado(resposta: PagamentoFiadoResponse): string[] {
  const linhas = resposta.vendasAbatidas.map((v) => {
    const data = formatarData(v.data);
    return v.novoStatus === 'PAGA'
      ? `${data} — quitada (${preco.transform(v.valorAbatido)})`
      : `${data} — abatida ${preco.transform(v.valorAbatido)}, resta ${preco.transform(v.restante)}`;
  });
  if (resposta.valorEmCredito > 0) {
    linhas.push(`${preco.transform(resposta.valorEmCredito)} virou crédito`);
  }
  return linhas;
}

/** dd/MM de 'yyyy-MM-dd...' sem passar por Date (evita fuso). */
function formatarData(iso: string): string {
  const [, mes, dia] = /^\d{4}-(\d{2})-(\d{2})/.exec(iso) ?? [];
  return mes ? `${dia}/${mes}` : iso;
}
