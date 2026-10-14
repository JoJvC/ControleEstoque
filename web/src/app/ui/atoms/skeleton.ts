import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ce-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="skeleton"
      [style.width]="largura()"
      [style.height]="altura()"
      aria-hidden="true"
    ></span>
  `,
  styles: `
    :host {
      display: block;
    }

    .skeleton {
      display: block;
      border-radius: var(--ce-radius-sm);
      background: linear-gradient(
        90deg,
        var(--ce-border) 25%,
        var(--ce-surface-muted) 50%,
        var(--ce-border) 75%
      );
      background-size: 200% 100%;
      animation: brilho 1.2s ease-in-out infinite;
    }

    @keyframes brilho {
      from {
        background-position: 200% 0;
      }
      to {
        background-position: -200% 0;
      }
    }
  `,
})
export class Skeleton {
  readonly largura = input('100%');
  readonly altura = input('16px');
}
