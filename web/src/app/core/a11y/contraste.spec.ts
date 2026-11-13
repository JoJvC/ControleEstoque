import { razaoContraste } from './contraste';

describe('razaoContraste', () => {
  it('preto sobre branco = 21', () => {
    expect(razaoContraste('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('cor igual = 1', () => {
    expect(razaoContraste('#0369a1', '#0369a1')).toBeCloseTo(1, 5);
  });

  it('é simétrica', () => {
    expect(razaoContraste('#0369a1', '#ffffff')).toBeCloseTo(razaoContraste('#ffffff', '#0369a1'));
  });
});
