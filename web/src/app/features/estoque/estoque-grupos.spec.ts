import { EstoqueCascoResponse, ProdutoResponse } from '../../core/api/models/estoque';
import { produtoResp } from '../../core/api/testing';
import {
  agruparEstoque,
  cascosComSaldo,
  marcaMinimo,
  maiorEstoque,
  nomeComTamanho,
  proporcao,
} from './estoque-grupos';

function produto(p: Partial<ProdutoResponse>): ProdutoResponse {
  return produtoResp({ id: p.nome ?? 'x', tipo: 'DESCARTAVEL', nome: 'x', ...p });
}

function casco(p: Partial<EstoqueCascoResponse>): EstoqueCascoResponse {
  return {
    tipoCascoId: 't',
    nome: 'Casco',
    marcaId: null,
    marca: null,
    aceitaSucata: true,
    vazios: 0,
    sucata: 0,
    ...p,
  };
}

describe('agruparEstoque', () => {
  it('separa Retornáveis de Descartáveis, cada um por categoria do produto', () => {
    const g = agruparEstoque([
      produto({ tipo: 'RETORNAVEL', nome: 'galao', categoria: 'Água' }),
      produto({ tipo: 'RETORNAVEL', nome: 'cerveja', categoria: 'Bebidas' }),
      produto({ tipo: 'DESCARTAVEL', nome: 'copo', categoria: 'Copos' }),
    ]);
    expect(g.retornaveis.map((d) => [d.categoria, d.produtos.map((p) => p.nome)])).toEqual([
      ['Água', ['galao']],
      ['Bebidas', ['cerveja']],
    ]);
    expect(g.descartaveis.map((d) => d.categoria)).toEqual(['Copos']);
  });

  it('categoria nula ou vazia vira "Outros", nos dois tipos', () => {
    const g = agruparEstoque([
      produto({ nome: 'a', categoria: null }),
      produto({ nome: 'b', categoria: '  ' }),
      produto({ nome: 'c', categoria: 'Gelo' }),
      produto({ tipo: 'RETORNAVEL', nome: 'd', categoria: null }),
    ]);
    expect(g.descartaveis.map((d) => [d.categoria, d.produtos.length])).toEqual([
      ['Outros', 2],
      ['Gelo', 1],
    ]);
    expect(g.retornaveis.map((d) => d.categoria)).toEqual(['Outros']);
  });
});

describe('nomeComTamanho', () => {
  it('anexa o tamanho só quando o nome não o contém (sem caixa/espaço)', () => {
    expect(nomeComTamanho('Cerveja', '300ml')).toBe('Cerveja 300ml');
    expect(nomeComTamanho('Cerveja 300ml', '300ml')).toBe('Cerveja 300ml');
    expect(nomeComTamanho('Galão 20 l', '20L')).toBe('Galão 20 l');
    expect(nomeComTamanho('Gelo 5KG', '5 kg')).toBe('Gelo 5KG');
  });

  it('sem tamanho devolve o nome', () => {
    expect(nomeComTamanho('Gelo', null)).toBe('Gelo');
    expect(nomeComTamanho('Gelo', ' ')).toBe('Gelo');
  });
});

describe('cascosComSaldo', () => {
  it('zero/zero sai; negativo e só sucata ficam', () => {
    const t1 = casco({ tipoCascoId: 't1', vazios: 0, sucata: 0 });
    const t2 = casco({ tipoCascoId: 't2', vazios: 3, sucata: 0 });
    const t3 = casco({ tipoCascoId: 't3', vazios: -1, sucata: 2 });
    const t4 = casco({ tipoCascoId: 't4', vazios: 0, sucata: 5 });
    expect(cascosComSaldo([t1, t2, t3, t4])).toEqual([t2, t3, t4]);
  });

  it('todos zerados dá lista vazia', () => {
    expect(cascosComSaldo([casco({}), casco({ tipoCascoId: 'u' })])).toEqual([]);
  });
});

describe('proporção e marca do mínimo', () => {
  it('maiorEstoque usa o estoque geral do servidor, não soma marcas', () => {
    expect(maiorEstoque([produto({ estoqueGeral: 99 }), produto({ estoqueGeral: 5 })])).toBe(99);
  });

  it('exemplo Copos: 10 e 5, mínimo 4', () => {
    const maior = maiorEstoque([produto({ estoqueGeral: 10 }), produto({ estoqueGeral: 5 })]);
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
