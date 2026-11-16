import { Injectable, inject, isDevMode } from '@angular/core';
import { Router } from '@angular/router';

import { RhApi } from '../../core/api/rh-api';
import { ApiError } from '../../core/http/api-error';
import { OperatorStore } from '../../core/operator/operator-store';
import { ToastService } from '../../core/toast/toast-service';

/** Ações da página Mais, compartilhadas com o fim do menu lateral (desktop). */
@Injectable({ providedIn: 'root' })
export class AcoesMais {
  private readonly operatorStore = inject(OperatorStore);
  private readonly router = inject(Router);
  private readonly rhApi = inject(RhApi);
  private readonly toast = inject(ToastService);

  readonly dev = isDevMode();

  trocarOperador(): void {
    this.operatorStore.clear();
    this.router.navigateByUrl('/operador');
  }

  /** Dev only: dispara uma falha real na API p/ demonstrar o fluxo de erro + toast. */
  simularErroApi(): void {
    this.rhApi.criarCargo({ nome: '' }).subscribe({
      next: () => this.toast.info('A API aceitou o request — nenhum erro para exibir.'),
      error: (error: unknown) => {
        if (error instanceof ApiError) {
          this.toast.error(
            error.userMessage,
            error.traceId ? `Código de suporte: ${error.traceId}` : undefined,
          );
        }
      },
    });
  }
}
