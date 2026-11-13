import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';

import { PERMISSOES } from '../../core/permissions/permissoes';
import { rodarGuardDaRota } from '../../core/permissions/testing';
import { CLIENTES_ROUTES } from './clientes-routes';

const GUARDADAS: Record<string, string> = {
  novo: 'clientes.cadastrar',
  ':id/editar': 'clientes.cadastrar',
};

describe('CLIENTES_ROUTES', () => {
  it.each(Object.entries(GUARDADAS))('rota "%s" exige %s', (path, chave) => {
    const rota = CLIENTES_ROUTES.find((r) => r.path === path)!;
    expect(rota.canActivate).toHaveLength(1);
    const negado = rodarGuardDaRota(rota, []);
    expect(negado).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(negado as UrlTree)).toBe('/');
    expect(rodarGuardDaRota(rota, ['*'])).toBe(true);
    expect(rodarGuardDaRota(rota, [chave])).toBe(true);
    expect(PERMISSOES.map((p) => p.chave)).toContain(chave);
  });

  it('rotas de consulta continuam sem guard', () => {
    for (const r of CLIENTES_ROUTES.filter(
      (r) => !((r.path ?? '') in GUARDADAS) && !r.redirectTo,
    )) {
      expect(r.canActivate).toBeUndefined();
    }
  });
});
