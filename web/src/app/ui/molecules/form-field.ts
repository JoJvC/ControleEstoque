import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Rótulo + controle projetado + dica/erro. O controle vem por ng-content. */
@Component({
  selector: 'ce-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- o controle é projetado DENTRO do label via ng-content: a associação
         por aninhamento funciona em runtime, o lint só não enxerga -->
    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
    <label class="campo">
      <span class="campo__rotulo">
        {{ rotulo() }}
        @if (obrigatorio()) {
          <span class="campo__asterisco" aria-hidden="true">*</span>
        }
      </span>
      <ng-content />
      @if (erro()) {
        <span class="campo__erro" role="alert">{{ erro() }}</span>
      } @else if (dica()) {
        <span class="campo__dica">{{ dica() }}</span>
      }
    </label>
  `,
  styles: `
    :host {
      display: block;
    }

    .campo {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-1);
    }

    .campo__rotulo {
      font-size: var(--ce-font-sm);
      font-weight: 600;
      color: var(--ce-text);
    }

    .campo__asterisco {
      color: var(--ce-danger);
    }

    .campo__erro {
      font-size: var(--ce-font-sm);
      color: var(--ce-danger);
    }

    .campo__dica {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }
  `,
})
export class FormField {
  readonly rotulo = input.required<string>();
  readonly erro = input<string | null>(null);
  readonly dica = input('');
  readonly obrigatorio = input(false);
}
