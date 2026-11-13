import { Injectable, inject } from '@angular/core';

import { RhApi } from '../api/rh-api';
import { OperatorStore } from '../operator/operator-store';
import { PERMISSAO_TODAS } from './permissoes';
import { permissoesDoCargo } from './permissoes-do-cargo';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly operatorStore = inject(OperatorStore);
  private readonly rhApi = inject(RhApi);

  /** Lê o signal do operador: template e `effect` reagem a mudanças. */
  has(permissao: string): boolean {
    const permissoes = this.operatorStore.operator()?.permissoes;
    return !!permissoes && (permissoes.includes(PERMISSAO_TODAS) || permissoes.includes(permissao));
  }

  /** Relê os cargos e atualiza as permissões do operador. Em erro de HTTP, mantém as salvas. */
  recarregar(): void {
    const operador = this.operatorStore.operator();
    if (!operador) return;
    this.rhApi.listarCargos().subscribe({
      next: (cargos) => {
        // operador trocado durante a requisição: a resposta é do cargo antigo
        if (this.operatorStore.operator()?.id !== operador.id) return;
        this.operatorStore.atualizarPermissoes(permissoesDoCargo(cargos, operador.cargoId));
      },
      error: () => undefined,
    });
  }
}
