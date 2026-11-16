import {
  Ocorrencia,
  ocorrenciaCompleta,
  ocorrenciaNova,
  paraOcorrenciaRequest,
  perdasProntas,
} from './perdas-form';

const cheia: Ocorrencia = {
  galao: 'CHEIO',
  produtoId: 'pr-1',
  marcaId: 'm-1',
  tipoCascoId: null,
  quantidade: 2,
  motivo: 'QUEBRADO',
};
const vazia: Ocorrencia = {
  galao: 'VAZIO',
  produtoId: null,
  marcaId: null,
  tipoCascoId: 'tc-1',
  quantidade: 1,
  motivo: 'PERDIDO',
};

describe('ocorrenciaNova', () => {
  it('começa CHEIO, quantidade 1, QUEBRADO e sem produto', () => {
    expect(ocorrenciaNova()).toEqual({
      galao: 'CHEIO',
      produtoId: null,
      marcaId: null,
      tipoCascoId: null,
      quantidade: 1,
      motivo: 'QUEBRADO',
    });
    expect(ocorrenciaCompleta(ocorrenciaNova())).toBe(false);
  });
});

describe('ocorrenciaCompleta', () => {
  it('CHEIO pede produto e marca; VAZIO pede o tipo de casco', () => {
    expect(ocorrenciaCompleta(cheia)).toBe(true);
    expect(ocorrenciaCompleta({ ...cheia, produtoId: null })).toBe(false);
    expect(ocorrenciaCompleta({ ...cheia, marcaId: null })).toBe(false);
    expect(ocorrenciaCompleta({ ...cheia, tipoCascoId: 'tc-1' })).toBe(true);
    expect(ocorrenciaCompleta(vazia)).toBe(true);
    expect(ocorrenciaCompleta({ ...vazia, tipoCascoId: null })).toBe(false);
    expect(ocorrenciaCompleta({ ...vazia, produtoId: 'pr-1', marcaId: 'm-1' })).toBe(true);
  });

  it('quantidade precisa ser inteira e pelo menos 1', () => {
    expect(ocorrenciaCompleta({ ...cheia, quantidade: 0 })).toBe(false);
    expect(ocorrenciaCompleta({ ...vazia, quantidade: 0 })).toBe(false);
    expect(ocorrenciaCompleta({ ...cheia, quantidade: -1 })).toBe(false);
    expect(ocorrenciaCompleta({ ...cheia, quantidade: 1.5 })).toBe(false);
    expect(ocorrenciaCompleta({ ...cheia, quantidade: NaN })).toBe(false);
  });
});

describe('perdasProntas', () => {
  it('lista vazia avança, com ou sem funcionário', () => {
    expect(perdasProntas([], 0)).toBe(true);
    expect(perdasProntas([], 2)).toBe(true);
  });

  it('com ocorrência: todas completas e ao menos um funcionário no pedido', () => {
    expect(perdasProntas([cheia, vazia], 1)).toBe(true);
    expect(perdasProntas([cheia, { ...vazia, tipoCascoId: null }], 1)).toBe(false);
    expect(perdasProntas([cheia], 0)).toBe(false);
  });
});

describe('paraOcorrenciaRequest', () => {
  it('CHEIO manda tipoCascoId null', () => {
    expect(paraOcorrenciaRequest({ ...cheia, tipoCascoId: 'tc-9' })).toEqual({
      galao: 'CHEIO',
      produtoId: 'pr-1',
      marcaId: 'm-1',
      tipoCascoId: null,
      quantidade: 2,
      motivo: 'QUEBRADO',
    });
  });

  it('VAZIO manda produtoId e marcaId null', () => {
    expect(paraOcorrenciaRequest({ ...vazia, produtoId: 'pr-9', marcaId: 'm-9' })).toEqual({
      galao: 'VAZIO',
      produtoId: null,
      marcaId: null,
      tipoCascoId: 'tc-1',
      quantidade: 1,
      motivo: 'PERDIDO',
    });
  });
});
