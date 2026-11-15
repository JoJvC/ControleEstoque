import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { EntregaSucataResponse } from '../../core/api/models/clientes';
import { ApiError } from '../../core/http/api-error';
import { Button } from '../../ui/atoms/button';
import { Checkbox } from '../../ui/atoms/checkbox';
import { FormField } from '../../ui/molecules/form-field';
import { MoneyInput } from '../../ui/molecules/money-input';
import { QuantityStepper } from '../../ui/molecules/quantity-stepper';
import { SheetShell } from '../../ui/organisms/sheet-shell';
import { ClientesStore } from './clientes-store';

export interface EntregarSucataSheetDados {
  readonly clienteId: string;
}

/** Resultado: a EntregaSucataResponse do POST, ou undefined (cancelou). */
export type EntregarSucataSheetResultado = EntregaSucataResponse;

@Component({
  selector: 'ce-entregar-sucata-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    SheetShell,
    Button,
    Checkbox,
    FormField,
    MoneyInput,
    QuantityStepper,
  ],
  template: `
    <ce-sheet-shell titulo="Entregar sucata" (fechar)="ref.close()">
      <form class="form" (submit)="$event.preventDefault(); confirmar()">
        <p class="aviso">Sucata não abate débito de casco.</p>

        <ce-form-field rotulo="Quantidade" [obrigatorio]="true">
          <ce-quantity-stepper [formControl]="quantidade" [min]="1" />
        </ce-form-field>

        <ce-checkbox [formControl]="converter">Converter em crédito</ce-checkbox>

        @if (converterSig()) {
          <ce-form-field rotulo="Valor da conversão" [obrigatorio]="true">
            <ce-money-input [formControl]="valorConversao" />
          </ce-form-field>
        }

        @if (erro(); as mensagem) {
          <p class="erro" role="alert">{{ mensagem }}</p>
        }

        <ce-button tipo="submit" [block]="true" [disabled]="!valido()" [loading]="enviando()">
          Confirmar
        </ce-button>
      </form>
    </ce-sheet-shell>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .aviso {
      padding: var(--ce-space-2) var(--ce-space-3);
      border-radius: 20px;
      background: var(--ce-primary-soft);
      color: var(--ce-primary-strong);
      font-size: var(--ce-font-sm);
    }

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class EntregarSucataSheet {
  protected readonly ref = inject(DialogRef<EntregarSucataSheetResultado>);
  private readonly dados = inject<EntregarSucataSheetDados>(DIALOG_DATA);
  private readonly store = inject(ClientesStore);

  protected readonly quantidade = new FormControl(1, { nonNullable: true });
  protected readonly converter = new FormControl(false, { nonNullable: true });
  protected readonly valorConversao = new FormControl<number | null>(null);

  protected readonly erro = signal<string | null>(null);
  protected readonly enviando = signal(false);

  private readonly quantidadeSig = toSignal(this.quantidade.valueChanges, { initialValue: 1 });
  protected readonly converterSig = toSignal(this.converter.valueChanges, { initialValue: false });
  private readonly valorSig = toSignal(this.valorConversao.valueChanges, { initialValue: null });
  protected readonly valido = computed(() => {
    if (this.enviando() || this.quantidadeSig() < 1) {
      return false;
    }
    if (!this.converterSig()) {
      return true;
    }
    const valor = this.valorSig();
    return valor !== null && valor > 0;
  });

  protected async confirmar(): Promise<void> {
    if (!this.valido()) {
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    try {
      const resposta = await this.store.entregarSucata(
        this.dados.clienteId,
        this.quantidade.value,
        this.converter.value ? this.valorConversao.value : null,
      );
      this.ref.close(resposta);
    } catch (e) {
      if (!(e instanceof ApiError)) {
        throw e;
      }
      if (e.status >= 400 && e.status < 500) {
        this.erro.set(e.userMessage);
      }
    } finally {
      this.enviando.set(false);
    }
  }
}
