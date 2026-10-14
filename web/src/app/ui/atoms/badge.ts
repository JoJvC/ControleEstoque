import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeCor = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

@Component({
  selector: 'ce-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <span class="badge" [class]="'badge--' + cor()"><ng-content /></span> `,
  styles: `
    :host {
      display: inline-flex;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: var(--ce-space-1);
      padding: 2px var(--ce-space-2);
      border-radius: 999px;
      font-size: var(--ce-font-sm);
      font-weight: 600;
      white-space: nowrap;
    }

    .badge--primary {
      background: var(--ce-primary-soft);
      color: var(--ce-primary-strong);
    }

    .badge--success {
      background: var(--ce-success-soft);
      color: var(--ce-success);
    }

    .badge--warning {
      background: var(--ce-warning-soft);
      color: var(--ce-warning);
    }

    .badge--danger {
      background: var(--ce-danger-soft);
      color: var(--ce-danger);
    }

    .badge--neutral {
      background: var(--ce-surface-muted);
      color: var(--ce-text-muted);
      border: 1px solid var(--ce-border);
    }
  `,
})
export class Badge {
  readonly cor = input<BadgeCor>('neutral');
}
