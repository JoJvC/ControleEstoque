import { marcaResp, produtoResp } from '../../core/api/testing';
import {
  LinhaProduto,
  filtrarPorSugestao,
  filtrarPorTexto,
  linhasDoCatalogo,
  sugestoesDaBusca,
} from './busca-produto';

const AGUA = produtoResp({
  id: 'p-agua',
  nome: 'Água 20L',
  categoria: 'Água',
  marcas: [
    marcaResp({ marcaId: 'm-ind', marcaNome: 'Indaiá' }),
    marcaResp({ marcaId: 'm-cri', marcaNome: 'Cristal' }),
  ],
});
const GELO = produtoResp({
  id: 'p-gelo',
  tipo: 'DESCARTAVEL',
  nome: 'Gelo 5kg',
  categoria: 'Gelo',
  marcas: [marcaResp({ marcaId: 'm-ind', marcaNome: 'Indaiá' })],
});
const COPO = produtoResp({
  id: 'p-copo',
  tipo: 'DESCARTAVEL',
  nome: 'Copo 200ml',
  categoria: null,
  marcas: [marcaResp({ marcaId: 'm-ger', marcaNome: 'Genérica' })],
});
const LINHAS = linhasDoCatalogo([AGUA, GELO, COPO]);
const ids = (l: readonly LinhaProduto[]) => l.map((x) => `${x.produto.id}/${x.marca.marcaId}`);

describe('linhasDoCatalogo', () => {
  it('uma linha por produto+marca, na ordem do catálogo', () => {
    expect(ids(LINHAS)).toEqual(['p-agua/m-ind', 'p-agua/m-cri', 'p-gelo/m-ind', 'p-copo/m-ger']);
  });
});

describe('sugestoesDaBusca', () => {
  it('"inda" sugere a marca Indaiá, uma vez só, com o marcaId', () => {
    expect(sugestoesDaBusca(LINHAS, 'inda')).toEqual([
      { tipo: 'marca', valor: 'Indaiá', marcaId: 'm-ind' },
    ]);
  });

  it('sem acento e sem diferenciar caixa; nome, marca e categoria', () => {
    const r = sugestoesDaBusca(LINHAS, 'AGUA');
    expect(r).toEqual([
      { tipo: 'nome', valor: 'Água 20L' },
      { tipo: 'categoria', valor: 'Água' },
    ]);
  });

  it('termo vazio ou só espaços não gera sugestão', () => {
    expect(sugestoesDaBusca(LINHAS, '')).toEqual([]);
    expect(sugestoesDaBusca(LINHAS, '  ')).toEqual([]);
  });

  it('sem resultado: lista vazia', () => {
    expect(sugestoesDaBusca(LINHAS, 'zzz')).toEqual([]);
  });

  it('no máximo 8, sem repetição', () => {
    const muitos = linhasDoCatalogo(
      Array.from({ length: 12 }, (_, i) =>
        produtoResp({
          id: `p-${i}`,
          nome: `Item ${i}`,
          marcas: [marcaResp({ marcaId: `m-${i}` })],
        }),
      ),
    );
    expect(sugestoesDaBusca(muitos, 'item')).toHaveLength(8);
    expect(sugestoesDaBusca([...LINHAS, ...LINHAS], 'indaia')).toHaveLength(1);
  });
});

describe('filtrarPorTexto', () => {
  it('entra a linha cujo nome, marca ou categoria contém o termo', () => {
    expect(ids(filtrarPorTexto(LINHAS, 'cristal'))).toEqual(['p-agua/m-cri']);
    expect(ids(filtrarPorTexto(LINHAS, 'gelo'))).toEqual(['p-gelo/m-ind']);
    expect(ids(filtrarPorTexto(LINHAS, 'copo'))).toEqual(['p-copo/m-ger']);
    expect(ids(filtrarPorTexto(LINHAS, 'inda'))).toEqual(['p-agua/m-ind', 'p-gelo/m-ind']);
  });

  it('termo vazio devolve tudo, inclusive linha sem categoria', () => {
    expect(filtrarPorTexto(LINHAS, '')).toHaveLength(4);
  });
});

describe('filtrarPorSugestao', () => {
  it('nome: todas as marcas do produto', () => {
    expect(ids(filtrarPorSugestao(LINHAS, { tipo: 'nome', valor: 'Água 20L' }))).toEqual([
      'p-agua/m-ind',
      'p-agua/m-cri',
    ]);
  });

  it('marca: só a marcaId escolhida, em qualquer produto', () => {
    expect(
      ids(filtrarPorSugestao(LINHAS, { tipo: 'marca', valor: 'Indaiá', marcaId: 'm-ind' })),
    ).toEqual(['p-agua/m-ind', 'p-gelo/m-ind']);
  });

  it('categoria: só linhas daquela categoria', () => {
    expect(ids(filtrarPorSugestao(LINHAS, { tipo: 'categoria', valor: 'Gelo' }))).toEqual([
      'p-gelo/m-ind',
    ]);
  });
});
