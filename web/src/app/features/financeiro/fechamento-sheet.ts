import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { FechamentoResponse, ResumoCaixaResponse } from '../../core/api/models/financeiro';
import { FuncionarioResponse } from '../../core/api/models/rh';
import { RhApi } from '../../core/api/rh-api';
import { ApiError } from '../../core/http/api-error';
import { ToastService } from '../../core/toast/toast-service';
import { Button } from '../../ui/atoms/button';
import { Checkbox } from '../../ui/atoms/checkbox';
import { SheetShell } from '../../ui/organisms/sheet-shell';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { CaixaStore } from './caixa-store';

export interface FechamentoSheetDados {
  readonly caixaId: string;
  readonly resumo: ResumoCaixaResponse;
}

/** Resultado: a FechamentoResponse do POST, ou undefined (cancelou). */
export type FechamentoSheetResultado = FechamentoResponse;

const PRECO = new PrecoPipe();

@Component({
  selector: 'ce-fechamento-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SheetShell, Button, Checkbox, PrecoPipe],
  template: `
    <ce-sheet-shell titulo="Fechar o caixa" (fechar)="ref.close()">
      <div class="corpo">
        <p class="texto">
          Quem trabalhou hoje? A diária de cada um vira saída do caixa e crédito na conta-corrente.
        </p>
        @for (f of funcionarios(); track f.id) {
          <ce-checkbox
            [ngModel]="!desmarcados().has(f.id)"
            (ngModelChange)="alternar(f.id, $event)"
          >
            <b>{{ f.nome }}</b>
            @if (f.cargo) {
              <span class="cargo"> · {{ f.cargo }}</span>
            }
            · {{ f.valorDiaria | cePreco }} diária
          </ce-checkbox>
        } @empty {
          @if (statusLista() === 'ok') {
            <p class="vazio">Nenhum funcionário ativo com diária.</p>
          }
        }

        <dl class="resumo">
          <dt>Saldo do caixa agora (servidor)</dt>
          <dd>{{ dados.resumo.saldoParcial | cePreco }}</dd>
          <dt>Diárias marcadas</dt>
          <dd class="saida">
            − {{ totalMarcado() | cePreco }} <span class="cargo">({{ marcados().length }})</span>
          </dd>
        </dl>
        <p class="vazio">O resumo final vem do servidor ao confirmar.</p>

        @if (statusLista() === 'error') {
          <p class="erro" role="alert">Não foi possível carregar os funcionários.</p>
          <ce-button variante="ghost" (click)="carregarFuncionarios()">Tentar de novo</ce-button>
        }

        @if (caixaFechado(); as mensagem) {
          <div class="alerta" role="alert">
            <p class="alerta__titulo">Caixa fechado</p>
            <p>{{ mensagem }}</p>
            <ce-button variante="ghost" (click)="ref.close()">Voltar ao caixa</ce-button>
          </div>
        }
        @if (erro(); as mensagem) {
          <p class="erro" role="alert">{{ mensagem }}</p>
          <ce-button variante="ghost" (click)="confirmar()">Tentar de novo</ce-button>
          <ce-button variante="ghost" (click)="ref.close()">Voltar ao caixa</ce-button>
        }

        <ce-button
          [block]="true"
          [disabled]="statusLista() !== 'ok'"
          [loading]="enviando()"
          (click)="confirmar()"
        >
          Fechar caixa
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

    .saida {
      color: var(--ce-fiado);
    }

    .cargo {
      color: var(--ce-text-muted);
      font-size: var(--ce-font-sm);
    }

    .vazio {
      color: var(--ce-text-muted);
      font-size: var(--ce-font-sm);
    }

    .alerta {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--ce-space-2);
      padding: var(--ce-space-3);
      border-radius: 20px;
      background: var(--ce-warning-soft);
      color: var(--ce-text);
    }

    .alerta p {
      margin: 0;
    }

    .alerta__titulo {
      font-family: var(--ce-font-family-titulo);
      font-weight: 700;
      color: var(--ce-warning);
    }

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class FechamentoSheet {
  protected readonly ref = inject(DialogRef<FechamentoSheetResultado>);
  protected readonly dados = inject<FechamentoSheetDados>(DIALOG_DATA);
  private readonly store = inject(CaixaStore);
  private readonly toast = inject(ToastService);
  private readonly rhApi = inject(RhApi);

  protected readonly statusLista = signal<'loading' | 'ok' | 'error'>('loading');
  protected readonly funcionarios = signal<FuncionarioResponse[]>([]);
  /** Todos começam marcados: desmarcar é a ausência da diária. */
  protected readonly desmarcados = signal<ReadonlySet<string>>(new Set());
  protected readonly marcados = computed(() =>
    this.funcionarios().filter((f) => !this.desmarcados().has(f.id)),
  );
  protected readonly totalMarcado = computed(() =>
    this.marcados().reduce((soma, f) => soma + f.valorDiaria, 0),
  );
  protected readonly erro = signal<string | null>(null);
  protected readonly caixaFechado = signal<string | null>(null);
  protected readonly enviando = signal(false);

  constructor() {
    this.carregarFuncionarios();
  }

  /** Sem a lista o fechamento iria sem diárias e não tem volta (409 depois): o botão espera 'ok'. */
  protected async carregarFuncionarios(): Promise<void> {
    this.statusLista.set('loading');
    try {
      const lista = await firstValueFrom(this.rhApi.listarFuncionarios());
      this.funcionarios.set(lista.filter((f) => f.ativo && f.valorDiaria > 0));
      this.statusLista.set('ok');
    } catch {
      // 0/5xx já viram toast no interceptor
      this.statusLista.set('error');
    }
  }

  protected alternar(id: string, marcado: boolean): void {
    this.desmarcados.update((atual) => {
      const novo = new Set(atual);
      if (marcado) {
        novo.delete(id);
      } else {
        novo.add(id);
      }
      return novo;
    });
  }

  protected async confirmar(): Promise<void> {
    if (this.statusLista() !== 'ok') {
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    this.caixaFechado.set(null);
    try {
      const resposta = await this.store.fechar(
        this.dados.caixaId,
        this.marcados().map((f) => f.id),
      );
      this.toast.success(`Caixa fechado. Saldo final ${PRECO.transform(resposta.saldoFinal)}`);
      this.ref.close(resposta);
    } catch (e) {
      // 409 CAIXA_JA_FECHADO vira bloco de alerta; 400 FUNCIONARIO_DUPLICADO fica inline.
      if (!(e instanceof ApiError)) {
        throw e;
      }
      if (e.code === 'CAIXA_JA_FECHADO') {
        this.caixaFechado.set(e.userMessage);
      } else if (e.status >= 400 && e.status < 500) {
        this.erro.set(e.userMessage);
      }
    } finally {
      this.enviando.set(false);
    }
  }
}
