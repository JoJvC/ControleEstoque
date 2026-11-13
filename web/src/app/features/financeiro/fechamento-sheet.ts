import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { FechamentoResponse, ResumoCaixaResponse } from '../../core/api/models/financeiro';
import { FuncionarioResponse } from '../../core/api/models/rh';
import { RhApi } from '../../core/api/rh-api';
import { ApiError } from '../../core/http/api-error';
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

@Component({
  selector: 'ce-fechamento-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SheetShell, Button, Checkbox, PrecoPipe],
  template: `
    <ce-sheet-shell titulo="Fechar caixa" (fechar)="ref.close()">
      <div class="corpo">
        <dl class="resumo">
          <dt>Entradas</dt>
          <dd>{{ dados.resumo.entradas | cePreco }}</dd>
          <dt>Despesas</dt>
          <dd>{{ dados.resumo.totalDespesas | cePreco }}</dd>
          <dt>Saldo parcial</dt>
          <dd>{{ dados.resumo.saldoParcial | cePreco }}</dd>
        </dl>

        <h3 class="titulo">Diárias do dia</h3>
        @for (f of funcionarios(); track f.id) {
          <ce-checkbox
            [ngModel]="!desmarcados().has(f.id)"
            (ngModelChange)="alternar(f.id, $event)"
          >
            {{ f.nome }} —
            @if (f.valorDiaria > 0) {
              {{ f.valorDiaria | cePreco }}
            } @else {
              <span class="sem-diaria">sem diária</span>
            }
          </ce-checkbox>
        } @empty {
          <p class="vazio">Nenhum funcionário ativo.</p>
        }
        <p class="contagem">Diárias marcadas: {{ marcados().length }}</p>

        @if (statusLista() === 'error') {
          <p class="erro" role="alert">Não foi possível carregar os funcionários.</p>
          <ce-button variante="ghost" (click)="carregarFuncionarios()">Tentar de novo</ce-button>
        }

        @if (erro(); as mensagem) {
          <p class="erro" role="alert">{{ mensagem }}</p>
        }

        <ce-button
          [block]="true"
          [disabled]="statusLista() !== 'ok'"
          [loading]="enviando()"
          (click)="confirmar()"
        >
          Confirmar fechamento
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

    .titulo {
      font-size: var(--ce-font-md);
    }

    .vazio,
    .contagem {
      color: var(--ce-text-muted);
      font-size: var(--ce-font-sm);
    }

    .sem-diaria {
      color: var(--ce-text-muted);
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
  private readonly rhApi = inject(RhApi);

  protected readonly statusLista = signal<'loading' | 'ok' | 'error'>('loading');
  protected readonly funcionarios = signal<FuncionarioResponse[]>([]);
  /** Todos começam marcados: desmarcar é a ausência da diária. */
  protected readonly desmarcados = signal<ReadonlySet<string>>(new Set());
  protected readonly marcados = computed(() =>
    this.funcionarios().filter((f) => !this.desmarcados().has(f.id)),
  );
  protected readonly erro = signal<string | null>(null);
  protected readonly enviando = signal(false);

  constructor() {
    this.carregarFuncionarios();
  }

  /** Sem a lista o fechamento iria sem diárias e não tem volta (409 depois): o botão espera 'ok'. */
  protected async carregarFuncionarios(): Promise<void> {
    this.statusLista.set('loading');
    try {
      const lista = await firstValueFrom(this.rhApi.listarFuncionarios());
      this.funcionarios.set(lista.filter((f) => f.ativo));
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
    try {
      const resposta = await this.store.fechar(
        this.dados.caixaId,
        this.marcados().map((f) => f.id),
      );
      this.ref.close(resposta);
    } catch (e) {
      // 409 CAIXA_JA_FECHADO, 400 FUNCIONARIO_DUPLICADO ficam inline.
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
