import { ChangeDetectionStrategy, Component, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const FORMATADOR = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Entrada de dinheiro estilo PDV: o usuário digita dígitos e eles preenchem
 * os centavos da direita para a esquerda ("1" → 0,01; "1234" → 12,34).
 * Valor do CVA em REAIS (number | null) — null quando vazio.
 */
@Component({
  selector: 'ce-money-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MoneyInput), multi: true },
  ],
  template: `
    <span class="dinheiro" [class.dinheiro--desabilitado]="desabilitado()">
      <span class="dinheiro__prefixo" aria-hidden="true">R$</span>
      <input
        class="dinheiro__campo"
        type="text"
        inputmode="numeric"
        autocomplete="off"
        [placeholder]="placeholder()"
        [disabled]="desabilitado()"
        [value]="exibicao()"
        (input)="aoDigitar($event)"
        (blur)="onTouched()"
      />
    </span>
  `,
  styles: `
    @use 'mixins';

    :host {
      display: block;
    }

    .dinheiro {
      display: flex;
      align-items: center;
      gap: var(--ce-space-2);
      min-height: var(--ce-touch-target);
      padding-inline: var(--ce-space-3);
      border: 1px solid var(--ce-border);
      border-radius: var(--ce-radius-md);
      background: var(--ce-surface);

      &:focus-within {
        outline: 2px solid var(--ce-focus-ring);
        outline-offset: 1px;
      }
    }

    .dinheiro--desabilitado {
      background: var(--ce-surface-muted);
      color: var(--ce-text-muted);
    }

    .dinheiro__prefixo {
      color: var(--ce-text-muted);
      font-weight: 600;
    }

    .dinheiro__campo {
      @include mixins.tabular-numbers;

      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      background: transparent;
      font-size: var(--ce-font-lg);
      text-align: right;
    }
  `,
})
export class MoneyInput implements ControlValueAccessor {
  protected readonly exibicao = signal('');
  protected readonly desabilitado = signal(false);
  protected readonly placeholder = signal('0,00');

  private onChange: (valor: number | null) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(valor: number | null): void {
    this.exibicao.set(valor === null || Number.isNaN(valor) ? '' : FORMATADOR.format(valor));
  }

  registerOnChange(fn: (valor: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(desabilitado: boolean): void {
    this.desabilitado.set(desabilitado);
  }

  protected aoDigitar(evento: Event): void {
    const alvo = evento.target as HTMLInputElement;
    const digitos = alvo.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');

    if (digitos === '' || digitos === '0') {
      this.exibicao.set('');
      alvo.value = '';
      this.onChange(null);
      return;
    }

    const reais = Number(digitos) / 100;
    const formatado = FORMATADOR.format(reais);
    this.exibicao.set(formatado);
    alvo.value = formatado;
    this.onChange(reais);
  }
}
