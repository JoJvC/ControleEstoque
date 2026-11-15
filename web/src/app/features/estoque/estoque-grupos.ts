import { EstoqueItemResponse, TipoProduto } from '../../core/api/models/estoque';

export interface GrupoCategoria {
  categoria: string;
  itens: EstoqueItemResponse[];
}

export interface EstoqueAgrupado {
  agua: EstoqueItemResponse[];
  vasilhames: EstoqueItemResponse[];
  descartaveis: GrupoCategoria[];
}

const SEM_CATEGORIA = 'Sem categoria';
const ORDEM_VASILHAME: TipoProduto[] = ['CASCO', 'SUCATA', 'GALAO_COMPLETO'];

/** Casco, sucata e galão completo ficam em itens separados: nunca se somam (DESIGN.md §1). */
export function agruparEstoque(itens: readonly EstoqueItemResponse[]): EstoqueAgrupado {
  const porCategoria = new Map<string, EstoqueItemResponse[]>();
  for (const item of itens.filter((i) => i.tipo === 'DESCARTAVEL')) {
    const categoria = item.categoria?.trim() || SEM_CATEGORIA;
    porCategoria.set(categoria, [...(porCategoria.get(categoria) ?? []), item]);
  }
  return {
    agua: itens.filter((i) => i.tipo === 'AGUA'),
    vasilhames: ORDEM_VASILHAME.flatMap((tipo) => itens.filter((i) => i.tipo === tipo)),
    descartaveis: Array.from(porCategoria, ([categoria, grupo]) => ({ categoria, itens: grupo })),
  };
}

function fracao(valor: number, maior: number): number {
  return maior > 0 ? Math.min(1, Math.max(0, valor / maior)) : 0;
}

/** A barra cheia é o maior estoque do grupo, só para exibição. */
export function proporcao(quantidade: number, maiorDoGrupo: number): number {
  return fracao(quantidade, maiorDoGrupo);
}

export function marcaMinimo(estoqueMinimo: number, maiorDoGrupo: number): number {
  return fracao(estoqueMinimo, maiorDoGrupo);
}

export function maiorEstoque(itens: readonly EstoqueItemResponse[]): number {
  return itens.reduce((m, i) => Math.max(m, i.quantidade), 0);
}
