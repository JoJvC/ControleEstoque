import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { filter } from 'rxjs';

import { PagamentoFiadoResponse } from '../../core/api/models/financeiro';
import { ApiError } from '../../core/http/api-error';
import { Button } from '../../ui/atoms/button';
import { Select } from '../../ui/atoms/select';
import { FormField } from '../../ui/molecules/form-field';
import { MoneyInput } from '../../ui/molecules/money-input';
import { FORMAS } from '../../ui/organisms/pagamento-lista';
import { SheetShell } from '../../ui/organisms/sheet-shell';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { resumoPagamentoFiado } from './cascos-cliente';
import { ClientesStore } from './clientes-store';

export interface ReceberFiadoSheetDados {
  readonly clienteId: string;
}

/** Resultado: a PagamentoFiadoResponse do POST, ou undefined (cancelou). */
export type ReceberFiadoSheetResultado = PagamentoFiadoResponse;

@Component({
  selector: 'ce-receber-fiado-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SheetShell, Button, Select, FormField, MoneyInput, PrecoPipe],
  template: `
    <ce-sheet-shell titulo="Receber fiado" (fechar)="fechar()">
      @if (resultado(); as r) {
        <div class="form">
          <ul class="resumo" aria-label="Vendas abatidas">
            @for (linha of linhasResultado(); track linha) {
              <li>{{ linha }}</li>
            }
          </ul>
          <p class="saldo">
            Fiado agora: <strong>{{ r.novoSaldoFiado | cePreco }}</strong>
          </p>
          <ce-button [block]="true" (click)="fechar()">Fechar</ce-button>
        </div>
      } @else {
        <form class="form" (submit)="$event.preventDefault(); confirmar()">
          <ce-form-field rotulo="Valor" [obrigatorio]="true">
            <ce-money-input [formControl]="valor" />
          </ce-form-field>
          <ce-form-field rotulo="Forma de pagamento">
            <ce-select [opcoes]="formas" [formControl]="forma" />
          </ce-form-field>

          @if (erro(); as mensagem) {
            <p class="erro" role="alert">{{ mensagem }}</p>
          }

          <ce-button tipo="submit" [block]="true" [disabled]="!valido()" [loading]="enviando()">
            Confirmar
          </ce-button>
        </form>
      }
    </ce-sheet-shell>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .resumo {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-1);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class ReceberFiadoSheet {
  protected readonly ref = inject(DialogRef<ReceberFiadoSheetResultado>);
  private readonly dados = inject<ReceberFiadoSheetDados>(DIALOG_DATA);
  private readonly store = inject(ClientesStore);

  protected readonly formas = FORMAS;
  protected readonly forma = new FormControl<string>('DINHEIRO', { nonNullable: true });
  protected readonly valor = new FormControl<number | null>(null);

  protected readonly erro = signal<string | null>(null);
  protected readonly enviando = signal(false);
  /** Depois do POST a sheet mostra o resultado em vez de fechar. */
  protected readonly resultado = signal<PagamentoFiadoResponse | null>(null);
  protected readonly linhasResultado = computed(() => {
    const r = this.resultado();
    return r ? resumoPagamentoFiado(r) : [];
  });

  private readonly valorSig = toSignal(this.valor.valueChanges, { initialValue: null });
  protected readonly valido = computed(() => {
    const v = this.valorSig();
    return v !== null && v > 0 && !this.enviando();
  });

  protected fechar(): void {
    this.ref.close(this.resultado() ?? undefined);
  }

  protected async confirmar(): Promise<void> {
    const valor = this.valor.value;
    if (!this.valido() || valor === null) {
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    try {
      const resposta = await this.store.pagarFiado(this.dados.clienteId, valor, this.forma.value);
      this.resultado.set(resposta);
      // Já pagou: Esc e clique fora também devolvem a resposta, para a página recarregar.
      this.ref.disableClose = true;
      this.ref.backdropClick.subscribe(() => this.fechar());
      this.ref.keydownEvents.pipe(filter((e) => e.key === 'Escape')).subscribe(() => this.fechar());
    } catch (e) {
      // 422 PAGAMENTO_EXCEDE_SALDO, 409 CAIXA_FECHADO, 400 VALOR_INVALIDO ficam inline.
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
