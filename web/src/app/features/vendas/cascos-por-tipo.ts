import { TipoCascoResponse } from '../../core/api/models/estoque';
import { CascoClientePorTipo } from '../../core/api/models/clientes';
import { CascoPorTipoRequest, SucataEntregueRequest } from '../../core/api/models/vendas';
import type { ItemCarrinho } from './carrinho';

/** Quantidade digitada por tipo de casco (chave = tipoCascoId). */
export type QuantidadesPorTipo = Readonly<Record<string, number>>;

export interface TipoCascoDoCarrinho {
  readonly tipoCascoId: string;
  readonly nome: string;
  readonly aceitaSucata: boolean;
  /** Galões cheios do tipo no carrinho menos os vasilhames vendidos do tipo, no mínimo 0 (empréstimo). */
  readonly vendidosEmTroca: number;
}

/**
 * Tipos de casco das linhas retornáveis do carrinho; descartável e linha sem tipo resolvido ficam fora.
 * `vasilhames` (quantidade vendida por tipo) abate o empréstimo: max(0, G − V), como no backend.
 */
export function tiposCascoDoCarrinho(
  itens: readonly ItemCarrinho[],
  tiposCasco: readonly TipoCascoResponse[],
  vasilhames: QuantidadesPorTipo = {},
): TipoCascoDoCarrinho[] {
  const cheios = new Map<string, number>();
  const porTipo = new Map<string, TipoCascoDoCarrinho>();
  for (const item of itens) {
    const tipoId = item.produto.tipo === 'RETORNAVEL' ? item.marca.tipoCascoResolvidoId : null;
    const tipo = tipoId === null ? undefined : tiposCasco.find((t) => t.id === tipoId);
    if (!tipo) {
      continue;
    }
    cheios.set(tipo.id, (cheios.get(tipo.id) ?? 0) + item.quantidade);
    porTipo.set(tipo.id, {
      tipoCascoId: tipo.id,
      nome: tipo.nome,
      aceitaSucata: tipo.aceitaSucata,
      vendidosEmTroca: 0,
    });
  }
  return [...porTipo.values()].map((t) => ({
    ...t,
    vendidosEmTroca: Math.max(
      0,
      (cheios.get(t.tipoCascoId) ?? 0) - (vasilhames[t.tipoCascoId] ?? 0),
    ),
  }));
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

/** Sucata aceita (tipo que a aceita, quantidade > 0) com o valor unitário digitado (0 se vazio). */
function sucataValida(
  tipos: readonly TipoCascoDoCarrinho[],
  sucata: QuantidadesPorTipo,
  valores: QuantidadesPorTipo,
): SucataEntregueRequest[] {
  return tipos
    .filter((t) => t.aceitaSucata && (sucata[t.tipoCascoId] ?? 0) > 0)
    .map((t) => ({
      tipoCascoId: t.tipoCascoId,
      quantidade: sucata[t.tipoCascoId],
      valorUnitario: valores[t.tipoCascoId] ?? 0,
    }));
}

/** Desconto da sucata: Σ quantidade × valor unitário (espelho de VendaCalculos.DescontoSucata). */
export function descontoSucataDe(
  tipos: readonly TipoCascoDoCarrinho[],
  sucata: QuantidadesPorTipo,
  valores: QuantidadesPorTipo,
): number {
  const centavos = sucataValida(tipos, sucata, valores).reduce(
    (soma, s) => soma + Math.round(s.quantidade * s.valorUnitario * 100),
    0,
  );
  return centavos / 100;
}

/** O backend recusa (DESCONTO_SUCATA_EXCEDE_TOTAL) desconto de sucata acima do líquido sem ela. */
export function sucataExcede(descontoSucata: number, liquidoSemSucata: number): boolean {
  return Math.round(descontoSucata * 100) > Math.round(liquidoSemSucata * 100);
}

/** Listas do pedido: só tipos do carrinho e quantidade > 0; sucata só onde o tipo a aceita, com valor (inclusive 0). */
export function cascosParaRequest(
  tipos: readonly TipoCascoDoCarrinho[],
  naHora: boolean,
  devolvidos: QuantidadesPorTipo,
  sucata: QuantidadesPorTipo,
  valoresSucata: QuantidadesPorTipo,
): { cascosDevolvidos: CascoPorTipoRequest[]; sucataEntregue: SucataEntregueRequest[] } {
  const cascosDevolvidos: CascoPorTipoRequest[] = [];
  for (const tipo of tipos) {
    const { valor } = quantidadeDevolvida(tipo, naHora, devolvidos[tipo.tipoCascoId] ?? 0);
    if (valor > 0) {
      cascosDevolvidos.push({ tipoCascoId: tipo.tipoCascoId, quantidade: valor });
    }
  }
  return { cascosDevolvidos, sucataEntregue: sucataValida(tipos, sucata, valoresSucata) };
}

/** Saldo de casco do cliente por tipo: só os com saldo ≠ 0; negativo é casco a favor do cliente. */
export function linhasCascoPorTipo(cascos: readonly CascoClientePorTipo[]): string[] {
  return cascos
    .filter((c) => c.saldo !== 0)
    .map((c) =>
      c.saldo < 0 ? `${c.nome} = ${-c.saldo} a favor do cliente` : `${c.nome} = ${c.saldo}`,
    );
}

/** Saldo de casco (total ou de um tipo) como o operador lê: negativo é crédito a favor do cliente, sem sinal de menos. */
export function rotuloSaldoCasco(saldo: number): string {
  return saldo < 0 ? `${-saldo} a favor` : `${saldo}`;
}

/** Cascos com o cliente: soma só dos saldos positivos por tipo; o crédito de um tipo não abate outro. */
export function cascosComEle(cascos: readonly CascoClientePorTipo[]): number {
  return cascos.reduce((t, c) => t + Math.max(0, c.saldo), 0);
}

/** Soma dos créditos de casco por tipo (saldos negativos), sem sinal. */
export function cascosAFavor(cascos: readonly CascoClientePorTipo[]): number {
  return cascos.reduce((t, c) => t + Math.max(0, -c.saldo), 0);
}

/**
 * Prévia do casco do tipo ao fechar, espelho do servidor: saldo atual + empréstimo (max(0, G−V))
 * − devolvidos + vasilhames abatidos do crédito. Positivo fica na rua; negativo é devolução a mais.
 */
export function previaCascoDoTipo(
  saldo: number,
  emTroca: number,
  devolvidos: number,
  abatidos: number,
): { readonly naRua: number; readonly aMais: number } {
  const final = saldo + emTroca - devolvidos + abatidos;
  return { naRua: Math.max(0, final), aMais: Math.max(0, -final) };
}
