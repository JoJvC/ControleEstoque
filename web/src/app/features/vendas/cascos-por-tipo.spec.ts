import { TipoCascoResponse } from '../../core/api/models/estoque';
import { marcaResp, produtoResp } from '../../core/api/testing';
import { ItemCarrinho } from './carrinho';
import {
  TipoCascoDoCarrinho,
  cascosParaRequest,
  descontoSucataDe,
  linhasCascoPorTipo,
  previaCascoDoTipo,
  rotuloSaldoCasco,
  quantidadeDevolvida,
  sucataExcede,
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
  it('3 e 2 galões de T e 1 descartável: só T, com 5 vendidos em troca', () => {
    const itens = [
      linha('RETORNAVEL', 't-1', 3),
      linha('RETORNAVEL', 't-1', 2),
      linha('DESCARTAVEL', null, 1),
    ];
    expect(tiposCascoDoCarrinho(itens, TIPOS)).toEqual([
      { tipoCascoId: 't-1', nome: 'Casco 20L', aceitaSucata: true, vendidosEmTroca: 5 },
    ]);
  });

  it('vasilhames vendidos do tipo abatem o empréstimo: max(0, G − V)', () => {
    const itens = [linha('RETORNAVEL', 't-1', 3)];
    expect(tiposCascoDoCarrinho(itens, TIPOS, { 't-1': 1 })[0].vendidosEmTroca).toBe(2);
    expect(tiposCascoDoCarrinho(itens, TIPOS, { 't-1': 5 })[0].vendidosEmTroca).toBe(0);
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
    const r = cascosParaRequest(tipos.slice(0, 1), false, { 't-1': 3 }, { 't-1': 1 }, { 't-1': 5 });
    expect(r).toEqual({
      cascosDevolvidos: [{ tipoCascoId: 't-1', quantidade: 3 }],
      sucataEntregue: [{ tipoCascoId: 't-1', quantidade: 1, valorUnitario: 5 }],
    });
  });

  it('com "na hora" vai o vendido em troca de cada tipo', () => {
    const r = cascosParaRequest(tipos, true, { 't-1': 1 }, {}, {});
    expect(r.cascosDevolvidos).toEqual([
      { tipoCascoId: 't-1', quantidade: 5 },
      { tipoCascoId: 't-2', quantidade: 2 },
    ]);
  });

  it('quantidade 0 não entra; tipo fora do carrinho não entra', () => {
    const r = cascosParaRequest(tipos, false, { 't-1': 0, 't-2': 2, 't-9': 4 }, { 't-9': 1 }, {});
    expect(r.cascosDevolvidos).toEqual([{ tipoCascoId: 't-2', quantidade: 2 }]);
    expect(r.sucataEntregue).toEqual([]);
  });

  it('sucata só entra para tipo que aceita sucata', () => {
    const r = cascosParaRequest(tipos, false, {}, { 't-1': 2, 't-2': 3 }, { 't-1': 5, 't-2': 5 });
    expect(r.sucataEntregue).toEqual([{ tipoCascoId: 't-1', quantidade: 2, valorUnitario: 5 }]);
  });

  it('sucata sem valor digitado vai com valorUnitario 0', () => {
    const r = cascosParaRequest(tipos, false, {}, { 't-1': 1 }, {});
    expect(r.sucataEntregue).toEqual([{ tipoCascoId: 't-1', quantidade: 1, valorUnitario: 0 }]);
  });
});

describe('desconto da sucata', () => {
  const tipos = tiposCascoDoCarrinho(
    [linha('RETORNAVEL', 't-1', 5), linha('RETORNAVEL', 't-2', 2)],
    TIPOS,
  );

  it('2 unidades a R$ 5,00 dão R$ 10,00; tipo que não aceita sucata não conta', () => {
    expect(descontoSucataDe(tipos, { 't-1': 2 }, { 't-1': 5 })).toBe(10);
    expect(descontoSucataDe(tipos, { 't-1': 2, 't-2': 3 }, { 't-1': 5, 't-2': 9 })).toBe(10);
  });

  it('sem valor digitado o desconto é 0; centavos não acumulam erro', () => {
    expect(descontoSucataDe(tipos, { 't-1': 2 }, {})).toBe(0);
    expect(descontoSucataDe(tipos, { 't-1': 3 }, { 't-1': 0.1 })).toBe(0.3);
  });

  it('passa do total da venda só quando o desconto é maior que o líquido sem a sucata', () => {
    expect(sucataExcede(10, 8)).toBe(true);
    expect(sucataExcede(8, 8)).toBe(false);
    expect(sucataExcede(0, 0)).toBe(false);
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

describe('previaCascoDoTipo', () => {
  it('crédito 2 coberto por 2 vasilhames abatidos (1 galão em troca, nada devolvido) fica em 0', () => {
    expect(previaCascoDoTipo(-2, 0, 0, 2)).toEqual({ naRua: 0, aMais: 0 });
  });

  it('em Comprar (nada abatido) o crédito 2 continua: devolveu 2 a mais', () => {
    expect(previaCascoDoTipo(-2, 0, 0, 0)).toEqual({ naRua: 0, aMais: 2 });
  });

  it('sem vasilhame: saldo + empréstimo − devolvidos', () => {
    expect(previaCascoDoTipo(3, 2, 0, 0)).toEqual({ naRua: 5, aMais: 0 });
    expect(previaCascoDoTipo(3, 2, 8, 0)).toEqual({ naRua: 0, aMais: 3 });
  });
});

describe('rotuloSaldoCasco', () => {
  it('negativo vira "N a favor", nunca com sinal de menos', () => {
    expect(rotuloSaldoCasco(-2)).toBe('2 a favor');
    expect(rotuloSaldoCasco(3)).toBe('3');
    expect(rotuloSaldoCasco(0)).toBe('0');
  });
});
