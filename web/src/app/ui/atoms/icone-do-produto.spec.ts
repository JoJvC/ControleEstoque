import { iconeDaCategoria, iconeDoProduto } from './icone-do-produto';

describe('iconeDaCategoria', () => {
  it('ignora acento, caixa e espaços', () => {
    expect(iconeDaCategoria('Água')).toBe('galao');
    expect(iconeDaCategoria('AGUA')).toBe('galao');
    expect(iconeDaCategoria('agua')).toBe('galao');
    expect(iconeDaCategoria(' Gelo ')).toBe('gelo');
    expect(iconeDaCategoria('Carvão')).toBe('carvao');
    expect(iconeDaCategoria('Descartáveis')).toBe('copo');
  });

  it('cai em caixa sem mapa, vazia ou null', () => {
    expect(iconeDaCategoria('Bebidas')).toBe('caixa');
    expect(iconeDaCategoria('')).toBe('caixa');
    expect(iconeDaCategoria(null)).toBe('caixa');
    expect(iconeDaCategoria('toString')).toBe('caixa');
  });
});

describe('iconeDoProduto', () => {
  it('tipos de galão têm ícone próprio', () => {
    expect(iconeDoProduto({ tipo: 'GALAO_COMPLETO', categoria: null })).toBe('galao-completo');
    expect(iconeDoProduto({ tipo: 'CASCO', categoria: 'Água' })).toBe('casco');
    expect(iconeDoProduto({ tipo: 'SUCATA', categoria: null })).toBe('sucata');
  });

  it('AGUA ignora a categoria', () => {
    expect(iconeDoProduto({ tipo: 'AGUA', categoria: null })).toBe('galao');
    expect(iconeDoProduto({ tipo: 'AGUA', categoria: 'Bebidas' })).toBe('galao');
    expect(iconeDoProduto({ tipo: 'AGUA', categoria: 'Gelo' })).toBe('galao');
  });

  it('DESCARTAVEL segue a categoria', () => {
    expect(iconeDoProduto({ tipo: 'DESCARTAVEL', categoria: 'Copos' })).toBe('copo');
    expect(iconeDoProduto({ tipo: 'DESCARTAVEL', categoria: 'Gelo' })).toBe('gelo');
    expect(iconeDoProduto({ tipo: 'DESCARTAVEL', categoria: null })).toBe('caixa');
  });
});
