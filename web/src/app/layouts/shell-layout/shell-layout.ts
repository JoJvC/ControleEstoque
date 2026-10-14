import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { OperatorStore } from '../../core/operator/operator-store';
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

  protected readonly navItems: readonly BottomNavItem[] = [
    { path: '/home', label: 'Início', icone: 'home' },
    { path: '/vendas/nova', label: 'Vender', icone: 'gota', destaque: true },
    { path: '/clientes', label: 'Clientes', icone: 'usuario' },
    { path: '/financeiro/caixa', label: 'Caixa', icone: 'dinheiro' },
    { path: '/mais', label: 'Mais', icone: 'menu' },
  ];
}
