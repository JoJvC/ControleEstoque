import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SelectOpcao {
  readonly value: string;
  readonly label: string;
}

@Component({
  selector: 'ce-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Select), multi: true }],
  template: `
    <select
      class="campo"
      [id]="id() ?? null"
      [disabled]="desabilitado()"
      [value]="valor() ?? ''"
      (change)="aoSelecionar($event)"
      (blur)="onTouched()"
    >
      @if (placeholder()) {
        <option value="" disabled [selected]="valor() === null">{{ placeholder() }}</option>
      }
      @for (opcao of opcoes(); track opcao.value) {
        <option [value]="opcao.value" [selected]="opcao.value === valor()">
          {{ opcao.label }}
        </option>
      }
    </select>
  `,
  styles: `
    :host {
      display: block;
    }

    .campo {
      width: 100%;
      min-height: var(--ce-touch-target);
      padding: var(--ce-space-2) var(--ce-space-3);
      border: 1px solid var(--ce-border);
      border-radius: var(--ce-radius-md);
      background: var(--ce-surface);
      font-size: var(--ce-font-md);

      &:disabled {
        background: var(--ce-surface-muted);
        color: var(--ce-text-muted);
      }
    }
  `,
})
export class Select implements ControlValueAccessor {
  readonly opcoes = input.required<readonly SelectOpcao[]>();
  readonly placeholder = input('');
  readonly id = input<string | null>(null);

  protected readonly valor = signal<string | null>(null);
  protected readonly desabilitado = signal(false);

  private onChange: (valor: string | null) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(valor: string | null): void {
    this.valor.set(valor);
  }

  registerOnChange(fn: (valor: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(desabilitado: boolean): void {
    this.desabilitado.set(desabilitado);
  }

  protected aoSelecionar(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.valor.set(valor === '' ? null : valor);
    this.onChange(this.valor());
  }
}
