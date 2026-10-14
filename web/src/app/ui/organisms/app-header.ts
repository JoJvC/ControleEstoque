import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Icon } from '../atoms/icon';

/** Cabeçalho de página: voltar (opcional) + título + slot de ações à direita. */
@Component({
  selector: 'ce-app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <header class="cabecalho">
      @if (mostrarVoltar()) {
        <button type="button" class="cabecalho__voltar" aria-label="Voltar" (click)="voltar.emit()">
          <ce-icon nome="seta-esquerda" />
        </button>
      }
      <h1 class="cabecalho__titulo">{{ titulo() }}</h1>
      <span class="cabecalho__acoes"><ng-content /></span>
    </header>
  `,
  styles: `
    @use 'mixins';

    :host {
      display: block;
    }

    .cabecalho {
      display: flex;
      align-items: center;
      gap: var(--ce-space-2);
      padding: var(--ce-space-4);
    }

    .cabecalho__voltar {
      @include mixins.touch-target;

      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: calc(-1 * var(--ce-space-2));
      color: var(--ce-text);
    }

    .cabecalho__titulo {
      flex: 1;
      min-width: 0;
      font-size: var(--ce-font-xl);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cabecalho__acoes {
      display: inline-flex;
      align-items: center;
      gap: var(--ce-space-2);
    }
  `,
})
export class AppHeader {
  readonly titulo = input.required<string>();
  readonly mostrarVoltar = input(false);
  readonly voltar = output<void>();
}
