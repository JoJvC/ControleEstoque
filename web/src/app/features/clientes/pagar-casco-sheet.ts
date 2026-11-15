import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ConversaoCascosResponse, DevolucaoCascosResponse } from '../../core/api/models/clientes';
import { ApiError } from '../../core/http/api-error';
import { Button } from '../../ui/atoms/button';
import { FormField } from '../../ui/molecules/form-field';
import { MoneyInput } from '../../ui/molecules/money-input';
import { QuantityStepper } from '../../ui/molecules/quantity-stepper';
import { SheetShell } from '../../ui/organisms/sheet-shell';
import { ClientesStore } from './clientes-store';

export interface PagarCascoSheetDados {
  readonly clienteId: string;
}

export type PagarCascoModo = 'devolucao' | 'conversao';

/** Resultado: a resposta do POST do modo escolhido, ou undefined (cancelou). */
export type PagarCascoSheetResultado = DevolucaoCascosResponse | ConversaoCascosResponse;

@Component({
  selector: 'ce-pagar-casco-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SheetShell, Button, FormField, MoneyInput, QuantityStepper],
  template: `
    <ce-sheet-shell titulo="Pagar casco" (fechar)="ref.close()">
      <form class="form" (submit)="$event.preventDefault(); confirmar()">
        <div class="modos">
          <button
            type="button"
            class="modo"
            [attr.aria-pressed]="modo() === 'devolucao'"
            (click)="modo.set('devolucao')"
          >
            Devolução física
          </button>
          <button
            type="button"
            class="modo"
            [attr.aria-pressed]="modo() === 'conversao'"
            (click)="modo.set('conversao')"
          >
            Conversão em valor
          </button>
        </div>

        <ce-form-field rotulo="Quantidade" [obrigatorio]="true">
          <ce-quantity-stepper [formControl]="quantidade" [min]="1" />
        </ce-form-field>

        @if (modo() === 'conversao') {
          <ce-form-field rotulo="Valor unitário" [obrigatorio]="true">
            <ce-money-input [formControl]="valorUnitario" />
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

    .modos {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--ce-space-2);
    }

    .modo {
      min-height: var(--ce-touch-target);
      padding: var(--ce-space-2) var(--ce-space-3);
      border: 1px solid var(--ce-border);
      border-radius: var(--ce-radius-controle);
      background: var(--ce-surface);
      font-size: var(--ce-font-md);
      font-weight: 600;
      cursor: pointer;

      &[aria-pressed='true'] {
        border-color: var(--ce-primary);
        background: var(--ce-primary-soft);
        color: var(--ce-primary-strong);
      }
    }

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class PagarCascoSheet {
  protected readonly ref = inject(DialogRef<PagarCascoSheetResultado>);
  private readonly dados = inject<PagarCascoSheetDados>(DIALOG_DATA);
  private readonly store = inject(ClientesStore);

  protected readonly modo = signal<PagarCascoModo>('devolucao');
  protected readonly quantidade = new FormControl(1, { nonNullable: true });
  protected readonly valorUnitario = new FormControl<number | null>(null);

  protected readonly erro = signal<string | null>(null);
  protected readonly enviando = signal(false);

  private readonly quantidadeSig = toSignal(this.quantidade.valueChanges, { initialValue: 1 });
  private readonly valorSig = toSignal(this.valorUnitario.valueChanges, { initialValue: null });
  protected readonly valido = computed(() => {
    if (this.enviando() || this.quantidadeSig() < 1) {
      return false;
    }
    if (this.modo() === 'devolucao') {
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
      const id = this.dados.clienteId;
      const resposta =
        this.modo() === 'devolucao'
          ? await this.store.devolverCascos(id, this.quantidade.value)
          : await this.store.converterCascos(id, this.quantidade.value, this.valorUnitario.value!);
      this.ref.close(resposta);
    } catch (e) {
      // 422 CONVERSAO_MAIOR_QUE_SALDO e demais 4xx ficam inline; rede/5xx já viraram toast.
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
