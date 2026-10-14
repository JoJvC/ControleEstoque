import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ToastService } from './toast-service';

/** Renderiza os toasts globais. Único lugar do app: fica no componente raiz. */
@Component({
  selector: 'ce-toast-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts" role="status" aria-live="polite">
      @for (toast of toastService.toasts(); track toast.id) {
        <button
          type="button"
          class="toast"
          [class]="'toast--' + toast.kind"
          (click)="toastService.dismiss(toast.id)"
        >
          <span class="toast__message">{{ toast.message }}</span>
          @if (toast.detail) {
            <span class="toast__detail">{{ toast.detail }}</span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    @use 'mixins';

    .toasts {
      position: fixed;
      inset-inline: var(--ce-space-4);
      bottom: calc(72px + env(safe-area-inset-bottom, 0px));
      z-index: var(--ce-z-toast);
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
      pointer-events: none;

      @include mixins.from-desktop {
        inset-inline: auto;
        right: var(--ce-space-6);
        bottom: var(--ce-space-6);
        width: 360px;
      }
    }

    .toast {
      @include mixins.touch-target;

      pointer-events: auto;
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-1);
      padding: var(--ce-space-3) var(--ce-space-4);
      border-radius: var(--ce-radius-md);
      background: var(--ce-text);
      color: var(--ce-surface);
      box-shadow: var(--ce-shadow-2);
      text-align: left;
      font-size: var(--ce-font-md);
    }

    .toast--error {
      background: var(--ce-danger);
      color: var(--ce-text-on-primary);
    }

    .toast--success {
      background: var(--ce-success);
      color: var(--ce-text-on-primary);
    }

    .toast__detail {
      font-size: var(--ce-font-sm);
      opacity: 0.85;
    }
  `,
})
export class ToastOutlet {
  protected readonly toastService = inject(ToastService);
}
