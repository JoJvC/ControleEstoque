import { routes } from './app.routes';
import { TiposCascoPage } from './features/produtos/tipos-casco-page';

describe('routes', () => {
  it('/tipos-casco resolve para TiposCascoPage, sem guard de permissão', async () => {
    const shell = routes.find((r) => r.path === '' && r.children)!;
    const rota = shell.children!.find((r) => r.path === 'tipos-casco')!;
    expect(await (rota.loadComponent as () => Promise<unknown>)()).toBe(TiposCascoPage);
    expect(rota.canActivate).toBeUndefined();
  });
});
