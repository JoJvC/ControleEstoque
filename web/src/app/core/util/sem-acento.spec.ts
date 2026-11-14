import { semAcento } from './sem-acento';

describe('semAcento', () => {
  it('remove acentos e cedilha', () => {
    expect(semAcento('Água')).toBe('agua');
    expect(semAcento('Açaí')).toBe('acai');
  });

  it('passa para minúsculas', () => {
    expect(semAcento('CARVÃO')).toBe('carvao');
  });

  it('mantém texto já limpo', () => {
    expect(semAcento('gelo 5kg')).toBe('gelo 5kg');
  });
});
