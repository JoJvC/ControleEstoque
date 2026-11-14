import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { OperatorStore } from '../../core/operator/operator-store';
import { PermissionService } from '../../core/permissions/permission-service';
import { BottomNav, BottomNavItem } from '../../ui/organisms/bottom-nav';

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

  private readonly todosItens: readonly BottomNavItem[] = [
    { path: '/home', label: 'Hoje', icone: 'home' },
    { path: '/clientes', label: 'Clientes', icone: 'usuario' },
    {
      path: '/vendas/nova',
      label: 'Vender',
      icone: 'gota',
      destaque: true,
      permissao: 'vendas.registrar',
    },
    { path: '/estoque', label: 'Estoque', icone: 'caixa' },
    { path: '/mais', label: 'Mais', icone: 'menu' },
  ];

  protected readonly navItems = computed(() =>
    this.todosItens.filter((i) => !i.permissao || this.permissions.has(i.permissao)),
  );

  constructor() {
    this.permissions.recarregar();
  }
}
