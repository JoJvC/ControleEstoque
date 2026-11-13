import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { FechamentoResponse } from '../../core/api/models/financeiro';
import { ApiError } from '../../core/http/api-error';
import { SheetService } from '../../core/overlay/sheet-service';
import { CePermissao } from '../../core/permissions/ce-permissao';
import { ToastService } from '../../core/toast/toast-service';
import { hojeLocal } from '../../core/util/data-local';
import { Badge } from '../../ui/atoms/badge';
import { Button } from '../../ui/atoms/button';
import { Skeleton } from '../../ui/atoms/skeleton';
import { EmptyState } from '../../ui/molecules/empty-state';
import { FormField } from '../../ui/molecules/form-field';
import { ListItem } from '../../ui/molecules/list-item';
import { MoneyInput } from '../../ui/molecules/money-input';
import { AppHeader } from '../../ui/organisms/app-header';
import { DataList } from '../../ui/organisms/data-list';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { CaixaStore } from './caixa-store';
import { DespesaSheet, DespesaSheetDados } from './despesa-sheet';
import { FechamentoSheet, FechamentoSheetDados } from './fechamento-sheet';

@Component({
  selector: 'ce-caixa-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CePermissao,
    ReactiveFormsModule,
    AppHeader,
    Badge,
    Button,
    DataList,
    EmptyState,
    FormField,
    ListItem,
    MoneyInput,
    Skeleton,
    PrecoPipe,
  ],
  template: `
    <ce-app-header titulo="Caixa do dia" />

    <div class="conteudo">
      @switch (store.status()) {
        @case ('nao-aberto') {
          <form class="abrir" (submit)="$event.preventDefault(); abrir()">
            <p>O caixa de hoje ainda não foi aberto.</p>
            <ce-form-field rotulo="Saldo inicial" [obrigatorio]="true" [erro]="erroAbrir()">
              <ce-money-input [formControl]="saldoInicial" />
            </ce-form-field>
            <ce-button tipo="submit" [block]="true" [loading]="abrindo()">Abrir caixa</ce-button>
          </form>
        }
        @case ('error') {
          <ce-empty-state icone="alerta" titulo="Não foi possível carregar o caixa">
            <ce-button variante="ghost" (click)="carregar()">Tentar de novo</ce-button>
          </ce-empty-state>
        }
        @case ('ok') {
          @if (store.resumo(); as resumo) {
            <div class="situacao">
              @if (fechado()) {
                <ce-badge cor="neutral">Fechado</ce-badge>
              } @else {
                <ce-badge cor="success">Aberto</ce-badge>
              }
            </div>

            @if (fechado()) {
              <p class="aviso" role="status">O caixa do dia já está fechado.</p>
              <dl class="totais">
                <dt>Entradas</dt>
                <dd>{{ resumo.caixa.totalEntradas | cePreco }}</dd>
                <dt>Saídas</dt>
                <dd>{{ resumo.caixa.totalSaidas | cePreco }}</dd>
                <dt>Saldo final</dt>
                <dd>{{ resumo.caixa.saldoFinal | cePreco }}</dd>
              </dl>
            } @else {
              <dl class="totais">
                <dt>Saldo inicial</dt>
                <dd>{{ resumo.caixa.saldoInicial | cePreco }}</dd>
                <dt>Entradas</dt>
                <dd>{{ resumo.entradas | cePreco }}</dd>
                <dt>Despesas</dt>
                <dd>{{ resumo.totalDespesas | cePreco }}</dd>
                <dt>Saldo parcial</dt>
                <dd>{{ resumo.saldoParcial | cePreco }}</dd>
              </dl>
              <div class="acoes">
                <ce-button variante="ghost" (click)="lancarDespesa()">Lançar despesa</ce-button>
                <ce-button *cePermissao="'caixa.fechar'" (click)="fechar()">Fechar caixa</ce-button>
              </div>
            }

            <h2 class="titulo">Despesas</h2>
            <ce-data-list [itens]="resumo.despesas" vazioTitulo="Nenhuma despesa lançada">
              <ng-template let-d>
                <ce-list-item [desabilitado]="true">
                  {{ d.tipoDespesa }}{{ d.descricao ? ' — ' + d.descricao : '' }}
                  <span ce-trailing>{{ d.valor | cePreco }}</span>
                </ce-list-item>
              </ng-template>
            </ce-data-list>
          }
        }
        @default {
          <div class="carregando" aria-busy="true">
            <ce-skeleton altura="32px" />
            <ce-skeleton altura="96px" />
            <ce-skeleton altura="56px" />
          </div>
        }
      }
    </div>
  `,
  styles: `
    .conteudo,
    .abrir,
    .carregando {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .conteudo {
      padding: var(--ce-space-4);
    }

    .aviso {
      padding: var(--ce-space-3);
      border-radius: var(--ce-radius-md);
      background: var(--ce-warning-soft);
      color: var(--ce-warning);
      font-weight: 600;
    }

    .totais {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--ce-space-1) var(--ce-space-3);

      dd {
        text-align: right;
        font-weight: 600;
      }
    }

    .acoes {
      display: flex;
      gap: var(--ce-space-2);
    }

    .titulo {
      font-size: var(--ce-font-lg);
    }
  `,
})
export class CaixaPage {
  protected readonly store = inject(CaixaStore);
  private readonly sheet = inject(SheetService);
  private readonly toast = inject(ToastService);

  protected readonly saldoInicial = new FormControl<number | null>(null);
  protected readonly erroAbrir = signal<string | null>(null);
  protected readonly abrindo = signal(false);
  protected readonly fechado = computed(() => this.store.resumo()?.caixa.status === 'FECHADO');

  constructor() {
    this.carregar();
  }

  protected carregar(): Promise<void> {
    return this.store.carregar(hojeLocal());
  }

  protected async abrir(): Promise<void> {
    const saldo = this.saldoInicial.value;
    if (saldo === null) {
      this.erroAbrir.set('Informe o saldo inicial.');
      return;
    }
    this.abrindo.set(true);
    this.erroAbrir.set(null);
    try {
      await this.store.abrir(saldo);
    } catch (e) {
      if (!(e instanceof ApiError)) {
        throw e;
      }
      if (e.status >= 400 && e.status < 500) {
        this.erroAbrir.set(e.userMessage);
      }
    } finally {
      this.abrindo.set(false);
    }
  }

  protected async lancarDespesa(): Promise<void> {
    const caixaId = this.store.resumo()?.caixa.id;
    if (!caixaId) {
      return;
    }
    const ref = this.sheet.abrir<boolean, DespesaSheetDados>(DespesaSheet, { caixaId });
    const lancada = await firstValueFrom(ref.closed);
    if (lancada) {
      this.toast.success('Despesa lançada.');
    }
    // com ou sem resultado: um CAIXA_FECHADO do servidor leva a tela ao estado FECHADO
    await this.carregar();
  }

  protected async fechar(): Promise<void> {
    const resumo = this.store.resumo();
    if (!resumo) {
      return;
    }
    const ref = this.sheet.abrir<FechamentoResponse, FechamentoSheetDados>(FechamentoSheet, {
      caixaId: resumo.caixa.id,
      resumo,
    });
    const resposta = await firstValueFrom(ref.closed);
    if (resposta) {
      this.toast.success(`Caixa fechado: ${resposta.diariasLancadas} diárias lançadas.`);
    }
    await this.carregar();
  }
}
