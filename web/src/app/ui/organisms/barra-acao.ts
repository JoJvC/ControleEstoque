import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Barra de ação fixa (DESIGN.md §1): ação principal ao alcance do polegar.
 * No celular fica acima da bottom-nav; em ≥960px encosta no menu lateral.
 */
@Component({
  selector: 'ce-barra-acao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="barra"
      [class.barra--direita]="alinharDireita()"
      role="region"
      [attr.aria-label]="rotulo()"
    >
      <ng-content />
    </div>
  `,
  styles: `
    @use 'mixins';

    :host {
      position: fixed;
      inset-inline: 0;
      bottom: calc(var(--ce-nav-height) + env(safe-area-inset-bottom, 0px));
      z-index: var(--ce-z-nav);
    }

    .barra {
      display: flex;
      align-items: center;
      gap: var(--ce-space-3);
      min-height: var(--ce-barra-acao-height);
      padding: var(--ce-space-2) var(--ce-space-4);
      background: var(--ce-surface);
      border-top: 1px solid var(--ce-border);
    }

    .barra > * {
      min-height: var(--ce-touch-target);
    }

    @include mixins.from-desktop {
      :host {
        inset-inline-start: 220px; // largura do menu lateral (shell-layout.scss)
        // quem embute no mestre-detalhe encurta a barra com --ce-barra-acao-fim
        inset-inline-end: var(--ce-barra-acao-fim, 0px);
        bottom: 0;
      }

      .barra--direita {
        justify-content: flex-end;
      }
    }
  `,
})
export class BarraAcao {
  readonly rotulo = input.required<string>();
  /** Em ≥960px os botões ficam à direita (protótipo: Caixa do dia). */
  readonly alinharDireita = input(false);
}
