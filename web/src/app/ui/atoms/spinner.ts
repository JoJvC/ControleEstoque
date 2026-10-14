import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'ce-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="spinner"
      role="status"
      aria-label="Carregando"
      [style.width.px]="tamanho()"
      [style.height.px]="tamanho()"
    ></span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .spinner {
      border-radius: 50%;
      border: 2.5px solid currentColor;
      border-top-color: transparent;
      animation: girar 0.7s linear infinite;
    }

    @keyframes girar {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class Spinner {
  readonly tamanho = input(24);
}
