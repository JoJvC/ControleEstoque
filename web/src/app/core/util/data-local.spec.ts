import { hojeLocal } from './data-local';

describe('hojeLocal', () => {
  it('usa os componentes locais, sem deslocamento UTC', () => {
    expect(hojeLocal(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('completa mês e dia com zero à esquerda', () => {
    expect(hojeLocal(new Date(2026, 2, 9))).toBe('2026-03-09');
  });

  it('sem argumento devolve yyyy-MM-dd', () => {
    expect(hojeLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
