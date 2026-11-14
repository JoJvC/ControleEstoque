import { TipoProduto } from '../../core/api/models/estoque';
import { semAcento } from '../../core/util/sem-acento';
import { IconeNome } from './icon';

// Chaves já normalizadas (sem acento, minúsculas). Nova categoria = uma chave a mais.
const POR_CATEGORIA: Readonly<Record<string, IconeNome>> = {
  agua: 'galao',
  gelo: 'gelo',
  carvao: 'carvao',
  copo: 'copo',
  copos: 'copo',
  descartavel: 'copo',
  descartaveis: 'copo',
};

export function iconeDaCategoria(categoria: string | null): IconeNome {
  const chave = semAcento(categoria ?? '').trim();
  return Object.hasOwn(POR_CATEGORIA, chave) ? POR_CATEGORIA[chave] : 'caixa';
}

/** O tipo define o ícone; só DESCARTAVEL depende da categoria (DESIGN.md §1, §4). */
export function iconeDoProduto(p: { tipo: TipoProduto; categoria: string | null }): IconeNome {
  switch (p.tipo) {
    case 'GALAO_COMPLETO':
      return 'galao-completo';
    case 'CASCO':
      return 'casco';
    case 'SUCATA':
      return 'sucata';
    case 'AGUA':
      return 'galao';
    case 'DESCARTAVEL':
      return iconeDaCategoria(p.categoria);
  }
}
