import { iniciais } from './iniciais';

describe('iniciais', () => {
  it.each([
    ['Marina Souza', 'MS'],
    ['Paulo', 'P'],
    ['  ana   maria   lima  ', 'AL'],
    ['João (ADM)', 'JA'],
    ['Maria (Vendedora)', 'MV'],
    ['', ''],
  ])('"%s" → "%s"', (nome, esperado) => {
    expect(iniciais(nome)).toBe(esperado);
  });
});
