import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { ToastService } from '../toast/toast-service';
import { PermissionService } from './permission-service';

/** Sem a permissão, avisa e manda para a home (`/` cai em `home`). */
export function permissaoGuard(permissao: string): CanActivateFn {
  return () => {
    if (inject(PermissionService).has(permissao)) return true;
    inject(ToastService).error('Sem permissão para acessar esta tela');
    return inject(Router).parseUrl('/');
  };
}
