import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { OperatorStore } from './operator-store';

/** Bloqueia o shell inteiro enquanto nenhum operador foi selecionado. */
export const operatorGuard: CanActivateFn = () => {
  const store = inject(OperatorStore);
  const router = inject(Router);
  return store.isSelected() ? true : router.parseUrl('/operador');
};
