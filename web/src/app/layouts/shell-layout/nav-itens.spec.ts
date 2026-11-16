import { NAV_ITENS } from './nav-itens';

describe('NAV_ITENS', () => {
  it('Pedidos entra pelo Mais (celular) e no menu do desktop', () => {
    expect(NAV_ITENS.find((i) => i.path === '/pedidos')).toMatchObject({
      label: 'Pedidos',
      onde: 'desktop',
      naMais: true,
    });
  });
});
