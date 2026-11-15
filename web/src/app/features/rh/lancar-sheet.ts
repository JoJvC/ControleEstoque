import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ApiError } from '../../core/http/api-error';
import { Button } from '../../ui/atoms/button';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { MoneyInput } from '../../ui/molecules/money-input';
import { SheetShell } from '../../ui/organisms/sheet-shell';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { saldoPrevisto } from './conta-corrente-saldo';
import { ContaCorrenteStore } from './conta-corrente-store';

export interface LancarSheetDados {
  readonly funcionarioId: string;
  readonly nome: string;
  readonly tipo: 'VALE' | 'PAGAMENTO';
  /** Saldo a pagar no momento de abrir (base da prévia). */
  readonly saldo: number;
}

/** Resultado: o saldo a pagar depois do lançamento, ou undefined (cancelou). */
export type LancarSheetResultado = number;

@Component({
  selector: 'ce-lancar-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SheetShell, Button, FormField, MoneyInput, TextInput, PrecoPipe],
  template: `
    <ce-sheet-shell [titulo]="vale ? 'Lançar vale' : 'Lançar pagamento'" (fechar)="ref.close()">
      <form class="form" (submit)="$event.preventDefault(); confirmar()">
        <p class="resumo">{{ dados.nome }} · saldo {{ dados.saldo | cePreco }}</p>
        <ce-form-field rotulo="Valor (R$)">
          <ce-money-input [formControl]="valor" />
        </ce-form-field>
        <ce-form-field rotulo="Observação">
          <ce-input [formControl]="observacao" placeholder="Opcional" />
        </ce-form-field>

        @if (previa(); as p) {
          <p class="previa">
            Saldo passa de {{ dados.saldo | cePreco }} para {{ p.depois | cePreco }}
          </p>
        }

        @if (erro(); as mensagem) {
          <p class="erro" role="alert">{{ mensagem }}</p>
        }

        <ce-button tipo="submit" [block]="true" [disabled]="!valido()" [loading]="enviando()">
          Lançar {{ valorAtual() ?? 0 | cePreco }}
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

    .resumo {
      margin: 0;
      color: var(--ce-text-muted);
    }

    .previa {
      margin: 0;
      font-weight: 600;
      color: var(--ce-fiado);
    }

    .erro {
      margin: 0;
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class LancarSheet {
  protected readonly ref = inject(DialogRef<LancarSheetResultado>);
  protected readonly dados = inject<LancarSheetDados>(DIALOG_DATA);
  private readonly conta = inject(ContaCorrenteStore);

  protected readonly vale = this.dados.tipo === 'VALE';
  protected readonly valor = new FormControl<number | null>(null);
  protected readonly observacao = new FormControl('', { nonNullable: true });

  protected readonly erro = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected readonly valorAtual = toSignal(this.valor.valueChanges, { initialValue: null });
  protected readonly valido = computed(() => (this.valorAtual() ?? 0) > 0 && !this.enviando());
  protected readonly previa = computed(() => {
    const v = this.valorAtual() ?? 0;
    return v > 0 ? { depois: saldoPrevisto(this.dados.saldo, this.dados.tipo, v) } : null;
  });

  protected async confirmar(): Promise<void> {
    const valor = this.valorAtual();
    if (!this.valido() || valor === null) {
      return;
    }
    const req = { valor, observacao: this.observacao.value.trim() || null };
    this.enviando.set(true);
    this.erro.set(null);
    try {
      if (this.vale) {
        await this.conta.lancarVale(this.dados.funcionarioId, req);
      } else {
        await this.conta.lancarPagamento(this.dados.funcionarioId, req);
      }
      this.ref.close(this.conta.saldoAPagar());
    } catch (e) {
      // 422 PAGAMENTO_EXCEDE_SALDO e afins ficam inline; a sheet continua aberta.
      this.erro.set(
        e instanceof ApiError ? e.userMessage : 'Não foi possível lançar. Tente novamente.',
      );
    } finally {
      this.enviando.set(false);
    }
  }
}
