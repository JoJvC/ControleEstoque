import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

import { Icon } from '../atoms/icon';

/**
 * Ações secundárias do cabeçalho de página (DESIGN.md §5): no desktop, os botões ghost projetados
 * ficam em linha; no celular, caem num menu "⋯" (alvo ≥ 44 px). Some sozinho sem nenhuma ação
 * projetada (ex.: sem permissão). Usar dentro do `ce-app-header`, antes da ação principal.
 */
@Component({
  selector: 'ce-acoes-secundarias',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: {
    '(document:click)': 'fora($event)',
    '(keydown.escape)': 'aberto.set(false)',
  },
  template: `
    @if (!desktop()) {
      <button
        type="button"
        class="gatilho"
        aria-label="Mais ações"
        aria-haspopup="true"
        [attr.aria-expanded]="aberto()"
        (click)="aberto.set(!aberto())"
      >
        <ce-icon nome="mais-opcoes" />
      </button>
    }
    <div class="acoes" [class.acoes--menu]="!desktop()" [class.acoes--aberto]="aberto()">
      <ng-content />
    </div>
  `,
  styles: `
    @use 'mixins';

    :host {
      position: relative;
      display: inline-flex;
    }

    // sem ação projetada (só os comentários do *cePermissao), nem o gatilho aparece
    :host:has(.acoes:empty) {
      display: none;
    }

    .gatilho {
      @include mixins.touch-target;

      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: inherit;
    }

    .acoes {
      display: inline-flex;
      align-items: center;
      gap: var(--ce-space-2);
    }

    .acoes--menu {
      display: none;
      position: absolute;
      top: 100%;
      right: 0;
      flex-direction: column;
      align-items: stretch;
      min-width: 12rem;
      padding: var(--ce-space-2);
      border: 1px solid var(--ce-texto-sobre-topo);
      border-radius: var(--ce-radius-controle);
      background: var(--ce-topo);
      box-shadow: 0 6px 16px rgb(0 0 0 / 0.25);
    }

    .acoes--aberto {
      display: flex;
    }

    // botões projetados ocupam a largura do menu
    .acoes--menu ::ng-deep ce-button {
      display: block;
    }

    .acoes--menu ::ng-deep .botao {
      width: 100%;
    }
  `,
})
export class AcoesSecundarias {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly aberto = signal(false);
  protected readonly desktop = toSignal(
    inject(BreakpointObserver)
      .observe('(min-width: 960px)')
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  /** Qualquer clique fecha o menu (item escolhido ou fora), menos o do próprio gatilho, que alterna. */
  protected fora(e: Event): void {
    const alvo = e.target as Element;
    if (!(this.el.nativeElement.contains(alvo) && alvo.closest('.gatilho'))) this.aberto.set(false);
  }
}
