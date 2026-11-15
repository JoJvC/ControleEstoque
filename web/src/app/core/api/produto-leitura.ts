import { semAcento } from '../util/sem-acento';
import { ProdutoResponse } from './models/estoque';

/** A marca 'Genérica' é a marca de quem não tem marca própria (gelo, carvão, copo). */
export const ehMarcaGenerica = (nome: string): boolean => semAcento(nome.trim()) === 'generica';

export const rotuloDaMarca = (nome: string): string => (ehMarcaGenerica(nome) ? 'sem marca' : nome);

type ComMarcas = Pick<ProdutoResponse, 'marcas'>;

/** Preço da primeira marca; 0 quando o produto ainda não tem marca. */
export const precoReferenciaDe = (p: ComMarcas): number => p.marcas[0]?.precoReferencia ?? 0;

export const nomesDasMarcas = (p: ComMarcas): string[] =>
  p.marcas.map((m) => rotuloDaMarca(m.marcaNome));

export const estoqueMinimoTotal = (p: ComMarcas): number =>
  p.marcas.reduce((soma, m) => soma + m.estoqueMinimo, 0);
