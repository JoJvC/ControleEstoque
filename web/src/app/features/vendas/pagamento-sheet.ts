import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { FormaPagamento, VendaResponse } from '../../core/api/models/vendas';
import { ApiError } from '../../core/http/api-error';
import { Button } from '../../ui/atoms/button';
import { Select } from '../../ui/atoms/select';
import { FormField } from '../../ui/molecules/form-field';
import { MoneyInput } from '../../ui/molecules/money-input';
import { SheetShell } from '../../ui/organisms/sheet-shell';
import { FORMAS } from '../../ui/organisms/pagamento-lista';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { excedeSaldo } from './carrinho';
import { VendaStore } from './venda-store';

export interface PagamentoSheetDados {
  readonly vendaId: string;
  readonly saldo: number;
}

/** Resultado: a VendaResponse do POST, ou undefined (cancelou). */
export type PagamentoSheetResultado = VendaResponse;

@Component({
  selector: 'ce-pagamento-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SheetShell, Button, Select, FormField, MoneyInput, PrecoPipe],
  template: `
    <ce-sheet-shell titulo="Adicionar pagamento" (fechar)="ref.close()">
      <form class="form" (submit)="$event.preventDefault(); confirmar()">
        <p class="saldo">
          Saldo a pagar: <strong>{{ dados.saldo | cePreco }}</strong>
        </p>
        <ce-form-field rotulo="Forma de pagamento">
          <ce-select [opcoes]="formas" [formControl]="forma" />
        </ce-form-field>
        <ce-form-field rotulo="Valor" [obrigatorio]="true">
          <ce-money-input [formControl]="valor" />
        </ce-form-field>

        @if (excede()) {
          <p class="erro" role="alert">Valor acima do saldo a pagar.</p>
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

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class PagamentoSheet {
  protected readonly ref = inject(DialogRef<PagamentoSheetResultado>);
  protected readonly dados = inject<PagamentoSheetDados>(DIALOG_DATA);
  private readonly store = inject(VendaStore);

  protected readonly formas = FORMAS;
  protected readonly forma = new FormControl<string>('PIX', { nonNullable: true });
  protected readonly valor = new FormControl<number | null>(null);

  protected readonly erro = signal<string | null>(null);
  protected readonly enviando = signal(false);

  private readonly valorSig = toSignal(this.valor.valueChanges, { initialValue: null });
  protected readonly excede = computed(() => {
    const v = this.valorSig();
    return v !== null && excedeSaldo(this.dados.saldo, v);
  });
  protected readonly valido = computed(() => {
    const v = this.valorSig();
    return v !== null && v > 0 && !this.excede() && !this.enviando();
  });

  protected async confirmar(): Promise<void> {
    const valor = this.valor.value;
    if (!this.valido() || valor === null) {
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    try {
      const venda = await this.store.adicionarPagamento(this.dados.vendaId, {
        forma: this.forma.value as FormaPagamento,
        valor,
      });
      this.ref.close(venda);
    } catch (e) {
      // 422 PAGAMENTO_EXCEDE_SALDO, 409 CAIXA_FECHADO, 400 PAGAMENTO_INVALIDO ficam inline.
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
