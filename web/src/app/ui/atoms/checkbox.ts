import { ChangeDetectionStrategy, Component, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'ce-checkbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => Checkbox), multi: true }],
  template: `
    <label class="caixa">
      <input
        type="checkbox"
        class="caixa__controle"
        [checked]="marcado()"
        [disabled]="desabilitado()"
        (change)="aoAlternar($event)"
        (blur)="onTouched()"
      />
      <span class="caixa__rotulo"><ng-content /></span>
    </label>
  `,
  styles: `
    @use 'mixins';

    :host {
      display: block;
    }

    .caixa {
      @include mixins.touch-target;

      display: flex;
      align-items: center;
      gap: var(--ce-space-3);
      cursor: pointer;
    }

    .caixa__controle {
      width: 22px;
      height: 22px;
      accent-color: var(--ce-primary);
      flex-shrink: 0;
    }

    .caixa__rotulo {
      font-size: var(--ce-font-md);
    }
  `,
})
export class Checkbox implements ControlValueAccessor {
  protected readonly marcado = signal(false);
  protected readonly desabilitado = signal(false);

  private onChange: (valor: boolean) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(valor: boolean | null): void {
    this.marcado.set(valor ?? false);
  }

  registerOnChange(fn: (valor: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(desabilitado: boolean): void {
    this.desabilitado.set(desabilitado);
  }

  protected aoAlternar(evento: Event): void {
    const marcado = (evento.target as HTMLInputElement).checked;
    this.marcado.set(marcado);
    this.onChange(marcado);
  }
}
