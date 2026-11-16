import { corpoDaCarga, corpoDosCustos } from './abastecimento-linhas';

describe('corpoDaCarga', () => {
  it('quantidade 0 fica fora e vasilhame vai em cascos pelo tipoCascoId', () => {
    expect(
      corpoDaCarga([
        { tipo: 'item', id: 'pmA', quantidade: 10 },
        { tipo: 'item', id: 'pmB', quantidade: 0 },
        { tipo: 'item', id: 'pmG', quantidade: 5 },
        { tipo: 'casco', id: 'T20', quantidade: 3 },
        { tipo: 'casco', id: 'T10', quantidade: 0 },
      ]),
    ).toEqual({
      itens: [
        { produtoMarcaId: 'pmA', quantidade: 10 },
        { produtoMarcaId: 'pmG', quantidade: 5 },
      ],
      cascos: [{ tipoCascoId: 'T20', quantidade: 3 }],
    });
  });

  it('sem nada digitado devolve listas vazias', () => {
    expect(corpoDaCarga([])).toEqual({ itens: [], cascos: [] });
  });
});

describe('corpoDosCustos', () => {
  it('manda o id da linha, deixa de fora o custo vazio e mantém o frete', () => {
    expect(
      corpoDosCustos(
        [
          { id: 'l1', custo: 8 },
          { id: 'l2', custo: 90 },
          { id: 'l3', custo: null },
        ],
        [{ id: 'c1', custo: null }],
        18,
      ),
    ).toEqual({
      frete: 18,
      itens: [
        { id: 'l1', custoUnitario: 8 },
        { id: 'l2', custoUnitario: 90 },
      ],
      cascos: [],
    });
  });

  it('custo zero é válido e frete vazio vira null', () => {
    expect(corpoDosCustos([{ id: 'l1', custo: 0 }], [], null)).toEqual({
      frete: null,
      itens: [{ id: 'l1', custoUnitario: 0 }],
      cascos: [],
    });
  });
});
