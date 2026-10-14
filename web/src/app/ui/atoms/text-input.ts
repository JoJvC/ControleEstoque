import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'ce-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TextInput), multi: true },
  ],
  template: `
    <input
      class="campo"
      [id]="id() ?? null"
      [type]="tipo()"
      [placeholder]="placeholder()"
      [attr.inputmode]="inputmode()"
      [attr.autocomplete]="autocomplete()"
      [disabled]="desabilitado()"
      [value]="valor()"
      (input)="aoDigitar($event)"
      (blur)="onTouched()"
    />
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

      &::placeholder {
        color: var(--ce-text-muted);
      }
    }
  `,
})
export class TextInput implements ControlValueAccessor {
  readonly tipo = input<'text' | 'tel' | 'email' | 'password' | 'date'>('text');
  readonly placeholder = input('');
  readonly inputmode = input<'text' | 'numeric' | 'decimal' | 'tel' | 'email' | null>(null);
  readonly autocomplete = input<string | null>(null);
  readonly id = input<string | null>(null);

  protected readonly valor = signal('');
  protected readonly desabilitado = signal(false);

  private onChange: (valor: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(valor: string | null): void {
    this.valor.set(valor ?? '');
  }

  registerOnChange(fn: (valor: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(desabilitado: boolean): void {
    this.desabilitado.set(desabilitado);
  }

  protected aoDigitar(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.valor.set(valor);
    this.onChange(valor);
  }
}
