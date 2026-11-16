import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { OperatorStore } from '../../core/operator/operator-store';
import { PermissionService } from '../../core/permissions/permission-service';
import { AcoesMais } from './acoes-mais';
import { NAV_ITENS } from './nav-itens';
import { BottomNav, BottomNavAcao } from '../../ui/organisms/bottom-nav';

/**
 * Template (Atomic Design) do app autenticado: header + conteúdo + navegação.
 * Mobile: bottom-nav fixa. ≥960px: o MESMO nav vira sidebar via CSS (plano §4.3).
 */
@Component({
  selector: 'ce-shell-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, BottomNav],
  templateUrl: './shell-layout.html',
  styleUrl: './shell-layout.scss',
})
export class ShellLayout {
  private readonly operatorStore = inject(OperatorStore);

  protected readonly operator = this.operatorStore.operator;

  private readonly permissions = inject(PermissionService);

  private readonly acoesMais = inject(AcoesMais);

  protected readonly navItems = computed(() =>
    NAV_ITENS.filter((i) => !i.permissao || this.permissions.has(i.permissao)),
  );

  protected readonly navAcoes: readonly BottomNavAcao[] = [
    {
      label: 'Trocar operador',
      icone: 'atualizar',
      acionar: () => this.acoesMais.trocarOperador(),
    },
    ...(this.acoesMais.dev
      ? [
          {
            label: 'Simular erro de API (dev)',
            icone: 'frasco' as const,
            acionar: () => this.acoesMais.simularErroApi(),
          },
        ]
      : []),
  ];

  constructor() {
    this.permissions.recarregar();
  }
}
