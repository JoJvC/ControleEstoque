import { classificarSaldo, rotuloSaldo } from './saldo-cliente';

const rotulo = (saldo: number) => rotuloSaldo(classificarSaldo(saldo)).replace(/\s/g, ' ');

describe('classificarSaldo', () => {
  it('−40 é fiado de 40, no tom fiado', () => {
    expect(classificarSaldo(-40)).toEqual({ tipo: 'fiado', valor: 40, tom: 'fiado' });
    expect(rotulo(-40)).toBe('Fiado R$ 40,00');
  });

  it('25 é crédito de 25, no tom pago', () => {
    expect(classificarSaldo(25)).toEqual({ tipo: 'credito', valor: 25, tom: 'pago' });
    expect(rotulo(25)).toBe('Crédito R$ 25,00');
  });

  it('0 é zerado, no tom pago, "Em dia"', () => {
    expect(classificarSaldo(0)).toEqual({ tipo: 'zerado', valor: 0, tom: 'pago' });
    expect(rotulo(0)).toBe('Em dia');
  });
});
