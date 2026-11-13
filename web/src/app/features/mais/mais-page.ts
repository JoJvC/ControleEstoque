import { ChangeDetectionStrategy, Component, computed, inject, isDevMode } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { RhApi } from '../../core/api/rh-api';
import { ApiError } from '../../core/http/api-error';
import { OperatorStore } from '../../core/operator/operator-store';
import { PermissionService } from '../../core/permissions/permission-service';
import { ToastService } from '../../core/toast/toast-service';

interface MaisLink {
  readonly path: string;
  readonly label: string;
  readonly icon: string;
  readonly permissao?: string;
}

@Component({
  selector: 'ce-mais-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './mais-page.html',
  styleUrl: './mais-page.scss',
})
export class MaisPage {
  private readonly operatorStore = inject(OperatorStore);
  private readonly router = inject(Router);
  private readonly rhApi = inject(RhApi);
  private readonly toast = inject(ToastService);
  private readonly permissions = inject(PermissionService);

  protected readonly dev = isDevMode();

  private readonly todosLinks: readonly MaisLink[] = [
    { path: '/vendas', label: 'Histórico de vendas', icon: '🧾' },
    { path: '/estoque', label: 'Estoque', icon: '📦' },
    { path: '/produtos', label: 'Produtos', icon: '🫙' },
    { path: '/marcas', label: 'Marcas', icon: '🏷️' },
    { path: '/rh', label: 'Funcionários e cargos', icon: '🪪' },
    { path: '/relatorios', label: 'Relatórios', icon: '📊', permissao: 'relatorios.ver' },
  ];

  protected readonly links = computed(() =>
    this.todosLinks.filter((l) => !l.permissao || this.permissions.has(l.permissao)),
  );

  protected trocarOperador(): void {
    this.operatorStore.clear();
    this.router.navigateByUrl('/operador');
  }

  /** Dev only: dispara uma falha real na API p/ demonstrar o fluxo de erro + toast. */
  protected simularErroApi(): void {
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
