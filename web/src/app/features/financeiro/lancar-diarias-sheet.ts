import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { FinanceiroApi } from '../../core/api/financeiro-api';
import { RhApi } from '../../core/api/rh-api';
import { ApiError } from '../../core/http/api-error';
import { ToastService } from '../../core/toast/toast-service';
import { Button } from '../../ui/atoms/button';
import { SheetShell } from '../../ui/organisms/sheet-shell';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { DiariasFuncionarios, EstadoDiarias } from './diarias-funcionarios';

export interface LancarDiariasSheetDados {
  readonly caixaId: string;
}

/** Resultado: true quando as diárias foram lançadas, ou undefined (cancelou). */
export type LancarDiariasSheetResultado = boolean;

@Component({
  selector: 'ce-lancar-diarias-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetShell, Button, DiariasFuncionarios, PrecoPipe],
  template: `
    <ce-sheet-shell titulo="Lançar diárias" (fechar)="ref.close()">
      <div class="corpo">
        <p class="texto">
          Quem trabalhou nesse dia? A diária de cada um vira crédito na conta-corrente do
          funcionário; não sai do caixa.
        </p>
        <ce-diarias-funcionarios [estado]="diarias" />

        <dl class="resumo">
          <dt>Diárias a lançar</dt>
          <dd>
            {{ diarias.totalMarcado() | cePreco }}
            <span class="cargo">({{ diarias.qtdLancamentos() }})</span>
          </dd>
        </dl>

        @if (diarias.statusLista() === 'error') {
          <p class="erro" role="alert">Não foi possível carregar os funcionários.</p>
          <ce-button variante="ghost" (click)="diarias.carregar()">Tentar de novo</ce-button>
        }
        @if (erro(); as mensagem) {
          <p class="erro" role="alert">{{ mensagem }}</p>
        }

        <ce-button
          [block]="true"
          [disabled]="diarias.statusLista() !== 'ok'"
          [loading]="enviando()"
          (click)="confirmar()"
        >
          Lançar diárias
        </ce-button>
      </div>
    </ce-sheet-shell>
  `,
  styles: `
    .corpo {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .resumo {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--ce-space-1) var(--ce-space-3);

      dd {
        text-align: right;
        font-weight: 600;
      }
    }

    .texto {
      margin: 0;
      color: var(--ce-text-muted);
    }

    .cargo {
      color: var(--ce-text-muted);
      font-size: var(--ce-font-sm);
    }

    .erro {
      margin: 0;
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class LancarDiariasSheet {
  protected readonly ref = inject(DialogRef<LancarDiariasSheetResultado>);
  private readonly dados = inject<LancarDiariasSheetDados>(DIALOG_DATA);
  private readonly api = inject(FinanceiroApi);
  private readonly toast = inject(ToastService);

  protected readonly diarias = new EstadoDiarias(inject(RhApi));
  protected readonly erro = signal<string | null>(null);
  protected readonly enviando = signal(false);

  protected async confirmar(): Promise<void> {
    if (this.diarias.statusLista() !== 'ok' || this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    try {
      // o valor que não foi editado vai nulo: o servidor usa a diária cadastrada
      const r = await firstValueFrom(
        this.api.lancarDiarias(this.dados.caixaId, { diarias: this.diarias.paraRequest(true) }),
      );
      this.toast.success(`Diárias lançadas: ${r.diariasLancadas}`);
      this.ref.close(true);
    } catch (e) {
      // 409 DIARIAS_JA_LANCADAS, 422 CAIXA_SEM_DIARIAS_PENDENTES e 400 DIARIA_INVALIDA: mensagem, sem fechar
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
