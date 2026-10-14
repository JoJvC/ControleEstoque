import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { BadgeCor } from '../atoms/badge';

/** Rótulo + valor com cor semântica — usado para os saldos independentes do cliente. */
@Component({
  selector: 'ce-saldo-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chip" [class]="'chip--' + cor()">
      <span class="chip__rotulo">{{ rotulo() }}</span>
      <span class="chip__valor"><ng-content /></span>
    </div>
  `,
  styles: `
    @use 'mixins';

    :host {
      display: block;
    }

    .chip {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--ce-space-3);
      border-radius: var(--ce-radius-md);
      border: 1px solid var(--ce-border);
      background: var(--ce-surface);
    }

    .chip__rotulo {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    .chip__valor {
      @include mixins.tabular-numbers;

      font-size: var(--ce-font-lg);
      font-weight: 700;
    }

    .chip--primary .chip__valor {
      color: var(--ce-primary-strong);
    }

    .chip--success .chip__valor {
      color: var(--ce-success);
    }

    .chip--warning .chip__valor {
      color: var(--ce-warning);
    }

    .chip--danger .chip__valor {
      color: var(--ce-danger);
    }

    .chip--neutral .chip__valor {
      color: var(--ce-text);
    }
  `,
})
export class SaldoChip {
  readonly rotulo = input.required<string>();
  readonly cor = input<BadgeCor>('neutral');
}
