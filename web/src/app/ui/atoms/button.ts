import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Spinner } from './spinner';

export type BotaoVariante = 'primary' | 'ghost' | 'danger';

@Component({
  selector: 'ce-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Spinner],
  template: `
    <button
      class="botao"
      [class]="'botao--' + variante()"
      [class.botao--block]="block()"
      [type]="tipo()"
      [disabled]="disabled() || loading()"
    >
      @if (loading()) {
        <ce-spinner [tamanho]="18" />
      }
      <ng-content />
    </button>
  `,
  styles: `
    @use 'mixins';

    :host {
      display: inline-block;
    }

    .botao {
      @include mixins.touch-target;

      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--ce-space-2);
      padding-inline: var(--ce-space-5);
      border-radius: var(--ce-radius-md);
      font-weight: 600;
      font-size: var(--ce-font-md);
      transition: filter 0.15s ease;

      &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      &:not(:disabled):active {
        filter: brightness(0.92);
      }
    }

    .botao--primary {
      background: var(--ce-primary);
      color: var(--ce-text-on-primary);
    }

    .botao--ghost {
      background: transparent;
      color: var(--ce-primary);
      border: 1px solid var(--ce-border);
    }

    .botao--danger {
      background: var(--ce-danger);
      color: var(--ce-text-on-primary);
    }

    .botao--block {
      width: 100%;
    }

    :host(.block),
    :host([block]) {
      display: block;
    }
  `,
})
export class Button {
  readonly variante = input<BotaoVariante>('primary');
  readonly tipo = input<'button' | 'submit'>('button');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly block = input(false);
}
