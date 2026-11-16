import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { Icon, IconeNome } from '../atoms/icon';

export interface BottomNavItem {
  readonly path: string;
  readonly label: string;
  readonly icone: IconeNome;
  readonly destaque?: boolean;
  /** Em que modo o item aparece (celular = barra de baixo, desktop = menu lateral). */
  readonly onde: 'ambos' | 'celular' | 'desktop';
  /** routerLinkActive exato: não acende junto com um item de rota filha (ex.: /vendas × /vendas/nova). */
  readonly exato?: boolean;
  /** Chave de permissão exigida; o filtro é de quem monta a lista. */
  readonly permissao?: string;
}

export interface BottomNavAcao {
  readonly label: string;
  readonly icone: IconeNome;
  readonly acionar: () => void;
}

/**
 * Navegação principal: bottom-nav no mobile, sidebar em ≥960px (mesmo componente).
 * O contêiner (shell) posiciona; aqui só a lista de itens.
 */
@Component({
  selector: 'ce-bottom-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Icon],
  template: `
    <nav class="nav" aria-label="Navegação principal">
      @for (item of itens(); track item.path) {
        <a
          class="nav__item"
          [class.nav__item--destaque]="item.destaque"
          [class.nav__item--so-celular]="item.onde === 'celular'"
          [class.nav__item--so-desktop]="item.onde === 'desktop'"
          [routerLink]="item.path"
          routerLinkActive="is-active"
          [routerLinkActiveOptions]="{ exact: !!item.exato }"
          ariaCurrentWhenActive="page"
        >
          <span class="nav__icone"><ce-icon [nome]="item.icone" [tamanho]="22" /></span>
          <span class="nav__rotulo">{{ item.label }}</span>
        </a>
      }
      @for (acao of acoes(); track acao.label) {
        <button type="button" class="nav__item nav__acao" (click)="acao.acionar()">
          <span class="nav__icone"><ce-icon [nome]="acao.icone" [tamanho]="22" /></span>
          <span class="nav__rotulo">{{ acao.label }}</span>
        </button>
      }
    </nav>
  `,
  styles: `
    @use 'mixins';

    :host {
      display: block;
    }

    .nav {
      display: flex;
    }

    .nav__item {
      @include mixins.touch-target;

      background: none;
      border: 0;
      font: inherit;
      cursor: pointer;

      flex: 1;
      height: 64px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      color: var(--ce-text-muted);

      &.is-active {
        color: var(--ce-primary);
        font-weight: 600;
      }
    }

    .nav__item--destaque .nav__icone {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      margin-top: -14px;
      border-radius: 50%;
      background: var(--ce-primary);
      color: var(--ce-text-on-primary);
      box-shadow: var(--ce-shadow-2);
    }

    .nav__rotulo {
      font-size: var(--ce-font-sm);
    }

    .nav__item--so-desktop,
    .nav__acao {
      display: none;
    }

    @include mixins.from-desktop {
      // menu lateral sobre o fundo topo do tema (DESIGN.md §5 Shell)
      .nav {
        flex-direction: column;
        padding-top: var(--ce-space-4);
        color: var(--ce-texto-sobre-topo);
      }

      .nav__item {
        flex: none;
        flex-direction: row;
        justify-content: flex-start;
        gap: var(--ce-space-3);
        width: 100%;
        height: var(--ce-touch-target);
        padding-inline: var(--ce-space-5);
        color: var(--ce-texto-sobre-topo);

        &.is-active {
          color: var(--ce-texto-sobre-topo);
        }
      }

      .nav__item--so-desktop,
      .nav__acao {
        display: flex;
      }

      .nav__item--so-celular {
        display: none;
      }

      // o círculo marca o item selecionado (Vender não tem destaque próprio no desktop)
      .nav__item.is-active .nav__icone {
        display: grid;
        place-items: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--ce-destaque);
        color: var(--ce-topo);
      }

      // sem efeito do destaque no desktop: desfaz o círculo do celular
      .nav__item--destaque .nav__icone {
        display: inline-flex;
        width: auto;
        height: auto;
        margin-top: 0;
        border-radius: 0;
        background: none;
        color: inherit;
        box-shadow: none;
      }

      .nav__rotulo {
        font-size: var(--ce-font-md);
      }
    }
  `,
})
export class BottomNav {
  readonly itens = input.required<readonly BottomNavItem[]>();
  /** Botões no fim do menu lateral (só desktop). */
  readonly acoes = input<readonly BottomNavAcao[]>([]);
}
