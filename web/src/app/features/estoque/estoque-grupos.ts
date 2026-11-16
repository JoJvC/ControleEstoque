import { EstoqueCascoResponse, ProdutoResponse } from '../../core/api/models/estoque';

export interface GrupoCategoria {
  categoria: string;
  produtos: ProdutoResponse[];
}

export interface EstoqueAgrupado {
  retornaveis: GrupoCategoria[];
  descartaveis: GrupoCategoria[];
}

const SEM_CATEGORIA = 'Outros';

function porCategoria(produtos: readonly ProdutoResponse[]): GrupoCategoria[] {
  const mapa = new Map<string, ProdutoResponse[]>();
  for (const produto of produtos) {
    const categoria = produto.categoria?.trim() || SEM_CATEGORIA;
    mapa.set(categoria, [...(mapa.get(categoria) ?? []), produto]);
  }
  return Array.from(mapa, ([categoria, grupo]) => ({ categoria, produtos: grupo }));
}

/** O total do produto é o `estoqueGeral` do servidor; aqui só se separa por tipo e categoria. */
export function agruparEstoque(produtos: readonly ProdutoResponse[]): EstoqueAgrupado {
  return {
    retornaveis: porCategoria(produtos.filter((p) => p.tipo === 'RETORNAVEL')),
    descartaveis: porCategoria(produtos.filter((p) => p.tipo === 'DESCARTAVEL')),
  };
}

function normaliza(texto: string): string {
  return texto.replace(/\s+/g, '').toLowerCase();
}

/** Anexa o tamanho ao nome só quando o nome ainda não o contém (sem caixa/espaço). */
export function nomeComTamanho(nome: string, tamanho: string | null | undefined): string {
  const t = tamanho?.trim();
  if (!t || normaliza(nome).includes(normaliza(t))) return nome;
  return `${nome} ${t}`;
}

/** O servidor não filtra os saldos zerados; negativo fica, é divergência a mostrar. */
export function cascosComSaldo(cascos: readonly EstoqueCascoResponse[]): EstoqueCascoResponse[] {
  return cascos.filter((c) => c.vazios !== 0 || c.sucata !== 0);
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

export function maiorEstoque(produtos: readonly ProdutoResponse[]): number {
  return produtos.reduce((m, p) => Math.max(m, p.estoqueGeral), 0);
}
