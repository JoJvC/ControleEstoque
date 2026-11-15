import { TipoCascoResponse } from '../../core/api/models/estoque';
import { marcaResp, produtoResp } from '../../core/api/testing';
import { ItemCarrinho } from './carrinho';
import {
  TipoCascoDoCarrinho,
  cascosParaRequest,
  linhasCascoPorTipo,
  quantidadeDevolvida,
  tiposCascoDoCarrinho,
} from './cascos-por-tipo';
import { itemCarrinho } from './testing';

const T: TipoCascoResponse = {
  id: 't-1',
  nome: 'Casco 20L',
  marcaId: null,
  marca: null,
  precoVasilhame: 30,
  aceitaSucata: true,
};
const U: TipoCascoResponse = { ...T, id: 't-2', nome: 'Casco 10L', aceitaSucata: false };
const TIPOS = [T, U];

const linha = (
  tipo: 'RETORNAVEL' | 'DESCARTAVEL',
  casco: string | null,
  quantidade: number,
  extra: Partial<ItemCarrinho> = {},
): ItemCarrinho =>
  itemCarrinho({
    produto: produtoResp({ tipo, marcas: [marcaResp({ tipoCascoResolvidoId: casco })] }),
    quantidade,
    ...extra,
  });

describe('tiposCascoDoCarrinho', () => {
  it('3 de T em troca, 2 de T com vasilhame pago e 1 descartável: só T, com 3 vendidos em troca', () => {
    const itens = [
      linha('RETORNAVEL', 't-1', 3),
      linha('RETORNAVEL', 't-1', 2, { pagouVasilhame: true }),
      linha('DESCARTAVEL', null, 1),
    ];
    expect(tiposCascoDoCarrinho(itens, TIPOS)).toEqual([
      { tipoCascoId: 't-1', nome: 'Casco 20L', aceitaSucata: true, vendidosEmTroca: 3 },
    ]);
  });

  it('tipos distintos, na ordem do carrinho, com a soma por tipo', () => {
    const itens = [
      linha('RETORNAVEL', 't-2', 1),
      linha('RETORNAVEL', 't-1', 2),
      linha('RETORNAVEL', 't-2', 4),
    ];
    expect(
      tiposCascoDoCarrinho(itens, TIPOS).map((t) => [t.tipoCascoId, t.vendidosEmTroca]),
    ).toEqual([
      ['t-2', 5],
      ['t-1', 2],
    ]);
  });

  it('linha retornável sem tipo resolvido e descartável com tipo ficam de fora', () => {
    const itens = [linha('RETORNAVEL', null, 2), linha('DESCARTAVEL', 't-1', 1)];
    expect(tiposCascoDoCarrinho(itens, TIPOS)).toEqual([]);
  });

  it('tipo só com vasilhame pago continua listado, com 0 vendidos em troca', () => {
    const itens = [linha('RETORNAVEL', 't-1', 2, { pagouVasilhame: true })];
    expect(tiposCascoDoCarrinho(itens, TIPOS)[0].vendidosEmTroca).toBe(0);
  });

  it('carrinho vazio: nenhum tipo', () => {
    expect(tiposCascoDoCarrinho([], TIPOS)).toEqual([]);
  });
});

describe('quantidadeDevolvida', () => {
  const tipo: TipoCascoDoCarrinho = {
    tipoCascoId: 't-1',
    nome: 'Casco 20L',
    aceitaSucata: true,
    vendidosEmTroca: 3,
  };

  it('marcado: o vendido em troca, travado, ignorando o digitado', () => {
    expect(quantidadeDevolvida(tipo, true, 1)).toEqual({ valor: 3, travado: true });
  });

  it('desmarcado: o digitado, livre', () => {
    expect(quantidadeDevolvida(tipo, false, 1)).toEqual({ valor: 1, travado: false });
    expect(quantidadeDevolvida(tipo, false, 0)).toEqual({ valor: 0, travado: false });
  });
});

describe('cascosParaRequest', () => {
  const tipos = tiposCascoDoCarrinho(
    [linha('RETORNAVEL', 't-1', 5), linha('RETORNAVEL', 't-2', 2)],
    TIPOS,
  );

  it('Exemplo da F5: devolução 3 e sucata 1 do tipo T', () => {
    const r = cascosParaRequest(tipos.slice(0, 1), false, { 't-1': 3 }, { 't-1': 1 });
    expect(r).toEqual({
      cascosDevolvidos: [{ tipoCascoId: 't-1', quantidade: 3 }],
      sucataEntregue: [{ tipoCascoId: 't-1', quantidade: 1 }],
    });
  });

  it('com "na hora" vai o vendido em troca de cada tipo', () => {
    const r = cascosParaRequest(tipos, true, { 't-1': 1 }, {});
    expect(r.cascosDevolvidos).toEqual([
      { tipoCascoId: 't-1', quantidade: 5 },
      { tipoCascoId: 't-2', quantidade: 2 },
    ]);
  });

  it('quantidade 0 não entra; tipo fora do carrinho não entra', () => {
    const r = cascosParaRequest(tipos, false, { 't-1': 0, 't-2': 2, 't-9': 4 }, { 't-9': 1 });
    expect(r.cascosDevolvidos).toEqual([{ tipoCascoId: 't-2', quantidade: 2 }]);
    expect(r.sucataEntregue).toEqual([]);
  });

  it('sucata só entra para tipo que aceita sucata', () => {
    const r = cascosParaRequest(tipos, false, {}, { 't-1': 2, 't-2': 3 });
    expect(r.sucataEntregue).toEqual([{ tipoCascoId: 't-1', quantidade: 2 }]);
  });
});

describe('linhasCascoPorTipo', () => {
  it('só tipos com saldo ≠ 0; negativo aparece como "a favor do cliente"', () => {
    expect(
      linhasCascoPorTipo([
        { tipoCascoId: 't-1', nome: 'Casco 20L', saldo: 3 },
        { tipoCascoId: 't-2', nome: 'Casco 10L', saldo: 0 },
        { tipoCascoId: 't-3', nome: 'Casco 5L', saldo: -1 },
      ]),
    ).toEqual(['Casco 20L = 3', 'Casco 5L = 1 a favor do cliente']);
  });

  it('sem nenhum saldo: lista vazia', () => {
    expect(linhasCascoPorTipo([{ tipoCascoId: 't-1', nome: 'Casco 20L', saldo: 0 }])).toEqual([]);
  });
});
