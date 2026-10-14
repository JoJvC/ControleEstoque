import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { Icon } from '../atoms/icon';

/** Stepper de quantidade com alvos de toque grandes (− n +). Valor CVA: number. */
@Component({
  selector: 'ce-quantity-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => QuantityStepper), multi: true },
  ],
  imports: [Icon],
  template: `
    <span class="stepper" [class.stepper--desabilitado]="desabilitado()">
      <button
        type="button"
        class="stepper__botao"
        aria-label="Diminuir"
        [disabled]="desabilitado() || valor() <= min()"
        (click)="incrementar(-1)"
      >
        <ce-icon nome="menos" [tamanho]="20" />
      </button>
      <input
        class="stepper__campo"
        type="text"
        inputmode="numeric"
        [disabled]="desabilitado()"
        [value]="valor()"
        (input)="aoDigitar($event)"
        (blur)="aoSairDoCampo($event)"
      />
      <button
        type="button"
        class="stepper__botao"
        aria-label="Aumentar"
        [disabled]="desabilitado() || (max() !== null && valor() >= max()!)"
        (click)="incrementar(1)"
      >
        <ce-icon nome="mais" [tamanho]="20" />
      </button>
    </span>
  `,
  styles: `
    @use 'mixins';

    :host {
      display: inline-block;
    }

    .stepper {
      display: inline-flex;
      align-items: stretch;
      border: 1px solid var(--ce-border);
      border-radius: var(--ce-radius-md);
      background: var(--ce-surface);
      overflow: hidden;
    }

    .stepper--desabilitado {
      background: var(--ce-surface-muted);
      color: var(--ce-text-muted);
    }

    .stepper__botao {
      @include mixins.touch-target;

      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--ce-primary);

      &:disabled {
        color: var(--ce-text-muted);
        opacity: 0.5;
      }

      &:not(:disabled):active {
        background: var(--ce-primary-soft);
      }
    }

    .stepper__campo {
      @include mixins.tabular-numbers;

      width: 56px;
      border: none;
      outline: none;
      background: transparent;
      text-align: center;
      font-size: var(--ce-font-lg);
      font-weight: 600;
    }
  `,
})
export class QuantityStepper implements ControlValueAccessor {
  readonly min = input(0);
  readonly max = input<number | null>(null);

  protected readonly valor = signal(0);
  protected readonly desabilitado = signal(false);

  private onChange: (valor: number) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(valor: number | null): void {
    this.valor.set(this.limitar(valor ?? this.min()));
  }

  registerOnChange(fn: (valor: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(desabilitado: boolean): void {
    this.desabilitado.set(desabilitado);
  }

  protected incrementar(delta: number): void {
    this.definir(this.valor() + delta);
  }

  protected aoDigitar(evento: Event): void {
    const texto = (evento.target as HTMLInputElement).value.replace(/\D/g, '');
    if (texto !== '') {
      this.definir(Number(texto));
    }
  }

  protected aoSairDoCampo(evento: Event): void {
    (evento.target as HTMLInputElement).value = String(this.valor());
    this.onTouched();
  }

  private definir(valor: number): void {
    const limitado = this.limitar(valor);
    this.valor.set(limitado);
    this.onChange(limitado);
  }

  private limitar(valor: number): number {
    const teto = this.max();
    let resultado = Math.max(this.min(), Math.trunc(valor));
    if (teto !== null) {
      resultado = Math.min(teto, resultado);
    }
    return resultado;
  }
}
