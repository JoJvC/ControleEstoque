import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Button } from '../../ui/atoms/button';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';

/** Período (De/Até) + botão Buscar; filtros extras entram por projeção. Não busca por conta própria. */
@Component({
  selector: 'ce-filtro-periodo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Button, FormField, TextInput],
  template: `
    <div class="filtro">
      <div class="periodo">
        <ce-form-field rotulo="De">
          <ce-input tipo="date" [ngModel]="inicio()" (ngModelChange)="inicioChange.emit($event)" />
        </ce-form-field>
        <ce-form-field rotulo="Até">
          <ce-input tipo="date" [ngModel]="fim()" (ngModelChange)="fimChange.emit($event)" />
        </ce-form-field>
      </div>
      <ng-content />
      @if (erro()) {
        <p class="erro" role="alert">{{ erro() }}</p>
      }
      <ce-button [loading]="carregando()" (click)="buscar.emit()">Buscar</ce-button>
    </div>
  `,
  styles: `
    @use 'mixins';

    .filtro {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
      padding: var(--ce-space-4) var(--ce-space-4) 0;

      @include mixins.from-tablet {
        max-inline-size: 480px;
      }
    }

    .periodo {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--ce-space-2);
    }

    .erro {
      margin: 0;
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class FiltroPeriodo {
  readonly inicio = input.required<string>();
  readonly fim = input.required<string>();
  readonly erro = input<string | null>(null);
  readonly carregando = input(false);

  readonly inicioChange = output<string>();
  readonly fimChange = output<string>();
  readonly buscar = output<void>();
}
