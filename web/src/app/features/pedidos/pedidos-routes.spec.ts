import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';

import { routes } from '../../app.routes';
import { rodarGuardDaRota } from '../../core/permissions/testing';
import { PedidoConclusaoPage } from './pedido-conclusao-page';
import { PedidoDetalhePage } from './pedido-detalhe-page';
import { PedidoNovoPage } from './pedido-novo-page';
import { PedidosListaPage } from './pedidos-lista-page';
import { PEDIDOS_ROUTES } from './pedidos-routes';

describe('PEDIDOS_ROUTES', () => {
  it('app.routes carrega /pedidos de PEDIDOS_ROUTES dentro do shell', async () => {
    const shell = routes.find((r) => r.children)!;
    const rota = shell.children!.find((r) => r.path === 'pedidos')!;
    expect(await (rota.loadChildren as () => Promise<unknown>)()).toBe(PEDIDOS_ROUTES);
  });

  it.each([
    ['', PedidosListaPage],
    ['novo', PedidoNovoPage],
    [':id/conclusao', PedidoConclusaoPage],
    [':id', PedidoDetalhePage],
  ])('rota "%s" resolve o componente', async (path, componente) => {
    const rota = PEDIDOS_ROUTES.find((r) => r.path === path)!;
    expect(await (rota.loadComponent as () => Promise<unknown>)()).toBe(componente);
  });

  it.each(['novo', ':id/conclusao'])(
    '%s exige vendas.registrar; lista e detalhe seguem sem guard',
    (path) => {
      const rota = PEDIDOS_ROUTES.find((r) => r.path === path)!;
      expect(rota.canActivate).toHaveLength(1);
      const negado = rodarGuardDaRota(rota, []);
      expect(negado).toBeInstanceOf(UrlTree);
      expect(TestBed.inject(Router).serializeUrl(negado as UrlTree)).toBe('/');
      expect(rodarGuardDaRota(rota, ['vendas.registrar'])).toBe(true);
      for (const r of PEDIDOS_ROUTES.filter((r) => r.path === '' || r.path === ':id')) {
        expect(r.canActivate).toBeUndefined();
      }
    },
  );
});
