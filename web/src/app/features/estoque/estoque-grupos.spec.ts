import { EstoqueItemResponse } from '../../core/api/models/estoque';
import { agruparEstoque, marcaMinimo, maiorEstoque, proporcao } from './estoque-grupos';

function item(p: Partial<EstoqueItemResponse>): EstoqueItemResponse {
  return {
    produtoId: p.nome ?? 'x',
    tipo: 'DESCARTAVEL',
    nome: 'x',
    marca: null,
    categoria: null,
    tamanho: null,
    quantidade: 1,
    estoqueMinimo: 0,
    abaixoMinimo: false,
    ...p,
  };
}

describe('agruparEstoque', () => {
  it('separa por tipo e mantém casco, sucata e galão completo em itens próprios', () => {
    const g = agruparEstoque([
      item({ tipo: 'GALAO_COMPLETO', nome: 'gc', quantidade: 3 }),
      item({ tipo: 'AGUA', nome: 'agua' }),
      item({ tipo: 'SUCATA', nome: 'su', quantidade: 4 }),
      item({ tipo: 'CASCO', nome: 'ca', quantidade: 5 }),
      item({ tipo: 'DESCARTAVEL', nome: 'copo', categoria: 'Copos' }),
    ]);
    expect(g.agua.map((i) => i.nome)).toEqual(['agua']);
    expect(g.vasilhames.map((i) => [i.nome, i.quantidade])).toEqual([
      ['ca', 5],
      ['su', 4],
      ['gc', 3],
    ]);
    expect(g.descartaveis).toHaveLength(1);
  });

  it('categoria nula ou vazia vira "Sem categoria"', () => {
    const g = agruparEstoque([
      item({ nome: 'a', categoria: null }),
      item({ nome: 'b', categoria: '  ' }),
      item({ nome: 'c', categoria: 'Gelo' }),
    ]);
    expect(g.descartaveis.map((d) => [d.categoria, d.itens.length])).toEqual([
      ['Sem categoria', 2],
      ['Gelo', 1],
    ]);
  });
});

describe('proporção e marca do mínimo', () => {
  it('exemplo Copos: 10 e 5, mínimo 4', () => {
    const maior = maiorEstoque([item({ quantidade: 10 }), item({ quantidade: 5 })]);
    expect(proporcao(10, maior)).toBe(1);
    expect(proporcao(5, maior)).toBe(0.5);
    expect(marcaMinimo(4, maior)).toBe(0.4);
  });

  it('limita em 1 e maior 0 não dá NaN', () => {
    expect(marcaMinimo(20, 10)).toBe(1);
    expect(proporcao(5, 0)).toBe(0);
    expect(marcaMinimo(5, 0)).toBe(0);
    expect(proporcao(-3, 10)).toBe(0);
  });
});
