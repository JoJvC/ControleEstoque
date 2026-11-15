import { TipoCascoResponse } from '../../core/api/models/estoque';
import { CascoClientePorTipo } from '../../core/api/models/clientes';
import { CascoPorTipoRequest } from '../../core/api/models/vendas';
import type { ItemCarrinho } from './carrinho';

/** Quantidade digitada por tipo de casco (chave = tipoCascoId). */
export type QuantidadesPorTipo = Readonly<Record<string, number>>;

export interface TipoCascoDoCarrinho {
  readonly tipoCascoId: string;
  readonly nome: string;
  readonly aceitaSucata: boolean;
  /** Soma das quantidades das linhas desse tipo que não pagaram o vasilhame (troca ou empréstimo). */
  readonly vendidosEmTroca: number;
}

/** Tipos de casco das linhas retornáveis do carrinho; descartável e linha sem tipo resolvido ficam fora. */
export function tiposCascoDoCarrinho(
  itens: readonly ItemCarrinho[],
  tiposCasco: readonly TipoCascoResponse[],
): TipoCascoDoCarrinho[] {
  const porTipo = new Map<string, TipoCascoDoCarrinho>();
  for (const item of itens) {
    const tipoId = item.produto.tipo === 'RETORNAVEL' ? item.marca.tipoCascoResolvidoId : null;
    const tipo = tipoId === null ? undefined : tiposCasco.find((t) => t.id === tipoId);
    if (!tipo) {
      continue;
    }
    porTipo.set(tipo.id, {
      tipoCascoId: tipo.id,
      nome: tipo.nome,
      aceitaSucata: tipo.aceitaSucata,
      vendidosEmTroca:
        (porTipo.get(tipo.id)?.vendidosEmTroca ?? 0) + (item.pagouVasilhame ? 0 : item.quantidade),
    });
  }
  return [...porTipo.values()];
}

/** 'Devolveu todos na hora' trava a devolução na quantidade vendida em troca; desmarcado, vale o digitado. */
export function quantidadeDevolvida(
  tipo: TipoCascoDoCarrinho,
  naHora: boolean,
  digitado: number,
): { readonly valor: number; readonly travado: boolean } {
  return naHora
    ? { valor: tipo.vendidosEmTroca, travado: true }
    : { valor: digitado, travado: false };
}

/** Listas do pedido: só tipos do carrinho e quantidade > 0; sucata só onde o tipo a aceita. */
export function cascosParaRequest(
  tipos: readonly TipoCascoDoCarrinho[],
  naHora: boolean,
  devolvidos: QuantidadesPorTipo,
  sucata: QuantidadesPorTipo,
): { cascosDevolvidos: CascoPorTipoRequest[]; sucataEntregue: CascoPorTipoRequest[] } {
  const cascosDevolvidos: CascoPorTipoRequest[] = [];
  const sucataEntregue: CascoPorTipoRequest[] = [];
  for (const tipo of tipos) {
    const { valor } = quantidadeDevolvida(tipo, naHora, devolvidos[tipo.tipoCascoId] ?? 0);
    if (valor > 0) {
      cascosDevolvidos.push({ tipoCascoId: tipo.tipoCascoId, quantidade: valor });
    }
    const entregue = sucata[tipo.tipoCascoId] ?? 0;
    if (tipo.aceitaSucata && entregue > 0) {
      sucataEntregue.push({ tipoCascoId: tipo.tipoCascoId, quantidade: entregue });
    }
  }
  return { cascosDevolvidos, sucataEntregue };
}

/** Saldo de casco do cliente por tipo: só os com saldo ≠ 0; negativo é casco a favor do cliente. */
export function linhasCascoPorTipo(cascos: readonly CascoClientePorTipo[]): string[] {
  return cascos
    .filter((c) => c.saldo !== 0)
    .map((c) =>
      c.saldo < 0 ? `${c.nome} = ${-c.saldo} a favor do cliente` : `${c.nome} = ${c.saldo}`,
    );
}
