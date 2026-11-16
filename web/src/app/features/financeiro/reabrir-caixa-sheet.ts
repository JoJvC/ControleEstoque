import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { FinanceiroApi } from '../../core/api/financeiro-api';
import { ApiError } from '../../core/http/api-error';
import { OperatorStore } from '../../core/operator/operator-store';
import { ToastService } from '../../core/toast/toast-service';
import { Button } from '../../ui/atoms/button';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { SheetShell } from '../../ui/organisms/sheet-shell';

export interface ReabrirCaixaSheetDados {
  readonly caixaId: string;
}

/** Resultado: true quando o caixa foi reaberto, ou undefined (cancelou). */
export type ReabrirCaixaSheetResultado = boolean;

@Component({
  selector: 'ce-reabrir-caixa-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SheetShell, Button, TextInput, FormField],
  template: `
    <ce-sheet-shell titulo="Reabrir caixa" (fechar)="ref.close()">
      <form class="form" (submit)="$event.preventDefault(); confirmar()">
        <p class="texto">
          O caixa volta a ficar aberto. As diárias já lançadas são desfeitas: quem veio e o valor de
          cada um são escolhidos de novo ao fechar.
        </p>
        <ce-form-field rotulo="Motivo" [obrigatorio]="true">
          <ce-input placeholder="Por que o caixa será reaberto?" [formControl]="motivo" />
        </ce-form-field>
        @if (erro(); as mensagem) {
          <p class="erro" role="alert">{{ mensagem }}</p>
        }
        <ce-button tipo="submit" [block]="true" [loading]="enviando()">Reabrir caixa</ce-button>
      </form>
    </ce-sheet-shell>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .texto {
      margin: 0;
      color: var(--ce-text-muted);
    }

    .erro {
      margin: 0;
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class ReabrirCaixaSheet {
  protected readonly ref = inject(DialogRef<ReabrirCaixaSheetResultado>);
  private readonly dados = inject<ReabrirCaixaSheetDados>(DIALOG_DATA);
  private readonly api = inject(FinanceiroApi);
  private readonly operador = inject(OperatorStore);
  private readonly toast = inject(ToastService);

  protected readonly motivo = new FormControl('', { nonNullable: true });
  protected readonly erro = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected async confirmar(): Promise<void> {
    const motivo = this.motivo.value.trim();
    const funcionarioId = this.operador.operator()?.id;
    if (this.enviando()) {
      return;
    }
    if (!motivo) {
      this.erro.set('Informe o motivo da reabertura.');
      return;
    }
    if (!funcionarioId) {
      this.erro.set('Selecione o operador para reabrir o caixa.');
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    try {
      await firstValueFrom(this.api.reabrirCaixa(this.dados.caixaId, { funcionarioId, motivo }));
      this.toast.success('Caixa reaberto.');
      this.ref.close(true);
    } catch (e) {
      // 0/5xx já viram toast no interceptor; 403 e 4xx de negócio ficam inline
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
