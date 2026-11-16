import {
  ProdutoMarcaResponse,
  ProdutoResponse,
  TipoCascoResponse,
} from '../../core/api/models/estoque';
import { semAcento } from '../../core/util/sem-acento';

/** Uma linha do catálogo do PDV: produto + marca. */
export interface LinhaProduto {
  readonly produto: ProdutoResponse;
  readonly marca: ProdutoMarcaResponse;
}

/** Vasilhame vendido como linha da lista do PDV, por tipo de casco: 'Vasilhame <nome do tipo>'. */
export interface LinhaVasilhame {
  readonly vasilhame: TipoCascoResponse;
}

export type LinhaLista = LinhaProduto | LinhaVasilhame;

export const ehVasilhame = (linha: LinhaLista): linha is LinhaVasilhame => 'vasilhame' in linha;

export interface SugestaoBusca {
  readonly tipo: 'nome' | 'marca' | 'categoria';
  readonly valor: string;
  /** Só nas sugestões de marca. */
  readonly marcaId?: string;
}

const MAX_SUGESTOES = 8;
const ORDEM: readonly SugestaoBusca['tipo'][] = ['nome', 'marca', 'categoria'];

/** Uma linha por produto+marca, na ordem do catálogo. */
export function linhasDoCatalogo(produtos: readonly ProdutoResponse[]): LinhaProduto[] {
  return produtos.flatMap((produto) => produto.marcas.map((marca) => ({ produto, marca })));
}

const contem = (texto: string | null, termo: string): boolean =>
  texto !== null && semAcento(texto).includes(termo);

/** Sugestões de nome, marca e categoria que contêm o termo; sem repetição, no máximo 8. */
export function sugestoesDaBusca(linhas: readonly LinhaProduto[], termo: string): SugestaoBusca[] {
  const t = semAcento(termo.trim());
  if (t === '') {
    return [];
  }
  const achadas = new Map<string, SugestaoBusca>();
  const juntar = (sugestao: SugestaoBusca, chave: string): void => {
    achadas.set(`${sugestao.tipo}:${chave}`, achadas.get(`${sugestao.tipo}:${chave}`) ?? sugestao);
  };
  for (const { produto, marca } of linhas) {
    if (contem(produto.nome, t)) {
      juntar({ tipo: 'nome', valor: produto.nome }, semAcento(produto.nome));
    }
    if (contem(marca.marcaNome, t)) {
      juntar({ tipo: 'marca', valor: marca.marcaNome, marcaId: marca.marcaId }, marca.marcaId);
    }
    if (produto.categoria && contem(produto.categoria, t)) {
      juntar({ tipo: 'categoria', valor: produto.categoria }, semAcento(produto.categoria));
    }
  }
  return [...achadas.values()]
    .sort((a, b) => ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo))
    .slice(0, MAX_SUGESTOES);
}

/** Texto livre: a linha entra se nome, marca ou categoria contém o termo. */
export function filtrarPorTexto<L extends LinhaProduto>(linhas: readonly L[], termo: string): L[] {
  const t = semAcento(termo.trim());
  return linhas.filter(
    ({ produto, marca }) =>
      contem(produto.nome, t) || contem(marca.marcaNome, t) || contem(produto.categoria, t),
  );
}

export function filtrarPorSugestao<L extends LinhaProduto>(
  linhas: readonly L[],
  sugestao: SugestaoBusca,
): L[] {
  switch (sugestao.tipo) {
    case 'nome':
      return linhas.filter((l) => l.produto.nome === sugestao.valor);
    case 'marca':
      return linhas.filter((l) => l.marca.marcaId === sugestao.marcaId);
    case 'categoria':
      return linhas.filter((l) => l.produto.categoria === sugestao.valor);
  }
}

/**
 * Linhas de vasilhame da lista: uma por tipo de casco, filtradas por `vasilhame <nome>`.
 * `escondidas` (filtro de categoria ou sugestão de produto/marca ativo) esvazia a lista.
 */
export function linhasDeVasilhame(
  tiposCasco: readonly TipoCascoResponse[],
  termo: string,
  escondidas: boolean,
): LinhaVasilhame[] {
  if (escondidas) {
    return [];
  }
  const t = semAcento(termo.trim());
  return tiposCasco
    .filter((tipo) => semAcento(`vasilhame ${tipo.nome}`).includes(t))
    .map((vasilhame) => ({ vasilhame }));
}
