import { galoesVisiveis } from './galoes-visiveis';

describe('galoesVisiveis', () => {
  it.each([
    [0, 10, { desenhados: 0, excedente: 0 }],
    [10, 10, { desenhados: 10, excedente: 0 }],
    [13, 10, { desenhados: 10, excedente: 3 }],
    [-2, 10, { desenhados: 0, excedente: 0 }],
  ])('saldo %i, max %i', (saldo, max, esperado) => {
    expect(galoesVisiveis(saldo, max)).toEqual(esperado);
  });
});
