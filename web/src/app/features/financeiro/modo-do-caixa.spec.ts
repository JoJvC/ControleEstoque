import { modoDoCaixa } from './modo-do-caixa';

describe('modoDoCaixa', () => {
  it('FECHADO é fechado, qualquer que seja a data', () => {
    expect(modoDoCaixa('FECHADO', '2026-11-15', '2026-11-16')).toBe('fechado');
    expect(modoDoCaixa('FECHADO', '2026-11-16', '2026-11-16')).toBe('fechado');
  });

  it('ABERTO de ontem é reaberto', () => {
    expect(modoDoCaixa('ABERTO', '2026-11-15', '2026-11-16')).toBe('reaberto');
  });

  it('ABERTO de hoje é hoje', () => {
    expect(modoDoCaixa('ABERTO', '2026-11-16', '2026-11-16')).toBe('hoje');
  });
});
