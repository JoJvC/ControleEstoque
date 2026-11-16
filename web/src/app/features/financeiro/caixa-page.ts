import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { FechamentoResponse } from '../../core/api/models/financeiro';
import { ApiError } from '../../core/http/api-error';
import { SheetService } from '../../core/overlay/sheet-service';
import { CePermissao } from '../../core/permissions/ce-permissao';
import { hojeLocal } from '../../core/util/data-local';
import { Button } from '../../ui/atoms/button';
import { Icon } from '../../ui/atoms/icon';
import { Skeleton } from '../../ui/atoms/skeleton';
import { EmptyState } from '../../ui/molecules/empty-state';
import { FormField } from '../../ui/molecules/form-field';
import { ListItem } from '../../ui/molecules/list-item';
import { MoneyInput } from '../../ui/molecules/money-input';
import { AppHeader } from '../../ui/organisms/app-header';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { dataExtenso } from '../home/hoje-hero';
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
    Button,
    EmptyState,
    FormField,
    Icon,
    ListItem,
    MoneyInput,
    Skeleton,
    PrecoPipe,
  ],
  template: `
    <ce-app-header
      titulo="Caixa do dia"
      [rotulo]="hoje"
      [folgado]="true"
      [mostrarVoltar]="true"
      (voltar)="voltar()"
    >
      @if (store.status() === 'ok' && !fechado()) {
        <ce-button *cePermissao="'caixa.fechar'" (click)="fechar()">Fechar caixa</ce-button>
      }
      <div ce-destaque>
        @if (store.status() === 'ok' && store.resumo(); as resumo) {
          <p class="destaque__status">
            <span class="chip-topo">
              @if (!fechado()) {
                <span class="chip-topo__ponto" aria-hidden="true"></span>
              }
              {{ fechado() ? 'Fechado' : 'Aberto' }}
            </span>
          </p>
          <p class="destaque__rotulo">
            {{ fechado() ? 'Saldo no fechamento' : 'Saldo do caixa agora' }}
          </p>
          <p class="destaque__saldo">
            {{ (fechado() ? resumo.caixa.saldoFinal : resumo.saldoParcial) | cePreco }}
          </p>
          <p class="destaque__chips">
            <span class="chip-topo">Abertura {{ resumo.caixa.saldoInicial | cePreco }}</span>
            <span class="chip-topo">Entradas {{ totalEntradas() | cePreco }}</span>
            <span class="chip-topo">Saídas {{ totalSaidas() | cePreco }}</span>
          </p>
          @if (!fechado()) {
            <ce-button class="destaque__acao" variante="ghost" (click)="lancarDespesa()">
              <ce-icon nome="vale" [tamanho]="18" /> Lançar despesa
            </ce-button>
          }
        } @else if (store.status() === 'nao-aberto') {
          <p class="destaque__rotulo">O caixa de hoje ainda não foi aberto.</p>
        } @else if (store.status() !== 'error') {
          <ce-skeleton altura="56px" />
        }
      </div>
    </ce-app-header>

    <div class="conteudo">
      @switch (store.status()) {
        @case ('nao-aberto') {
          <form class="abrir" (submit)="$event.preventDefault(); abrir()">
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
            @if (fechado()) {
              <div class="alerta" role="status">
                <p class="alerta__titulo">Caixa fechado</p>
                <p>
                  Entradas {{ resumo.caixa.totalEntradas | cePreco }} · saídas
                  {{ resumo.caixa.totalSaidas | cePreco }} · saldo
                  <b>{{ resumo.caixa.saldoFinal | cePreco }}</b
                  >.
                </p>
              </div>
            }
            <div class="secoes">
              <section>
                <h2 class="titulo">Entradas</h2>
                <div class="cartao">
                  <!-- ponytail: a API só traz o total de entradas, sem quebra por forma de pagamento -->
                  @if (totalEntradas() > 0) {
                    <ce-list-item [desabilitado]="true">
                      <ce-icon ce-leading nome="dinheiro" />
                      <b>Vendas e recebimentos</b>
                      <span ce-trailing class="valor valor--entrada"
                        >+ {{ totalEntradas() | cePreco }}</span
                      >
                    </ce-list-item>
                  } @else {
                    <p class="vazio">Nenhuma entrada hoje.</p>
                  }
                </div>
              </section>
              <section>
                <h2 class="titulo">Saídas</h2>
                <div class="cartao">
                  @for (d of resumo.despesas; track d.id) {
                    <ce-list-item [desabilitado]="true">
                      <ce-icon ce-leading nome="vale" />
                      <b>{{ d.tipoDespesa }}</b>
                      @if (d.descricao) {
                        <span class="secundario">{{ d.descricao }}</span>
                      }
                      <span ce-trailing class="valor valor--saida">− {{ d.valor | cePreco }}</span>
                    </ce-list-item>
                  } @empty {
                    <p class="vazio">Nenhuma saída hoje.</p>
                  }
                </div>
              </section>
            </div>
          }
        }
        @default {
          <div class="carregando" aria-busy="true">
            <ce-skeleton altura="96px" />
            <ce-skeleton altura="96px" />
          </div>
        }
      }
    </div>
  `,
  styles: `
    @use 'mixins';

    .conteudo,
    .abrir,
    .carregando {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .conteudo {
      @include mixins.safe-area-bottom(var(--ce-space-6));

      padding: var(--ce-space-4);

      @include mixins.from-desktop {
        padding: 24px 32px 32px;
        max-width: 1180px;
      }
    }

    .destaque__status,
    .destaque__rotulo,
    .destaque__saldo,
    .destaque__chips {
      margin: 0;
    }

    .destaque__rotulo {
      font-size: var(--ce-font-sm);
      opacity: 0.85;
    }

    .destaque__saldo {
      font-family: var(--ce-font-family-titulo);
      font-size: 38px;
      font-weight: 700;
      @include mixins.tabular-numbers;

      @include mixins.from-desktop {
        font-size: 56px;
      }
    }

    .destaque__chips,
    .destaque__status {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ce-space-2);
      margin-block: var(--ce-space-2);
    }

    // botão no destaque lê as cores do topo, como os do cabeçalho
    .destaque__acao {
      --ce-primary: var(--ce-texto-sobre-topo);
      --ce-text-on-primary: var(--ce-topo);
      --ce-border: var(--ce-texto-sobre-topo);

      display: block;
      margin-top: var(--ce-space-2);
    }

    .chip-topo__ponto {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-right: var(--ce-space-1);
      border-radius: 50%;
      background: currentColor;
    }

    .chip-topo {
      padding: var(--ce-space-1) var(--ce-space-3);
      border-radius: 999px;
      background: var(--ce-topo-cartao);
      color: var(--ce-texto-sobre-topo);
      font-size: var(--ce-font-sm);
      font-weight: 600;
      @include mixins.tabular-numbers;
    }

    .secoes {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);

      @include mixins.from-desktop {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 28px;
        align-items: start;
      }
    }

    .cartao {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    .vazio {
      margin: 0;
      padding: var(--ce-space-3) var(--ce-space-4);
      border-radius: 20px;
      background: var(--ce-surface);
      color: var(--ce-text-muted);
    }

    .secundario {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    .valor {
      font-weight: 700;
      @include mixins.tabular-numbers;
    }

    .valor--entrada {
      color: var(--ce-pago);
    }

    .valor--saida {
      color: var(--ce-fiado);
    }

    .alerta {
      padding: var(--ce-space-3) var(--ce-space-4);
      border-radius: 20px;
      background: var(--ce-pago-soft);
      color: var(--ce-text);

      p {
        margin: 0;
      }
    }

    .alerta__titulo {
      font-family: var(--ce-font-family-titulo);
      font-weight: 700;
    }

    .titulo {
      font-size: var(--ce-font-lg);
      margin-bottom: var(--ce-space-2);
    }
  `,
})
export class CaixaPage {
  protected readonly store = inject(CaixaStore);
  private readonly sheet = inject(SheetService);

  protected readonly saldoInicial = new FormControl<number | null>(null);
  protected readonly erroAbrir = signal<string | null>(null);
  protected readonly abrindo = signal(false);
  protected readonly fechado = computed(() => this.store.resumo()?.caixa.status === 'FECHADO');
  protected readonly totalEntradas = computed(() => {
    const r = this.store.resumo();
    return (this.fechado() ? r?.caixa.totalEntradas : r?.entradas) ?? 0;
  });
  protected readonly totalSaidas = computed(() => {
    const r = this.store.resumo();
    return (this.fechado() ? r?.caixa.totalSaidas : r?.totalDespesas) ?? 0;
  });
  protected readonly hoje = dataExtenso(new Date());
  private readonly router = inject(Router);

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

  protected voltar(): void {
    this.router.navigateByUrl('/mais');
  }

  protected async lancarDespesa(): Promise<void> {
    const caixaId = this.store.resumo()?.caixa.id;
    if (!caixaId) {
      return;
    }
    const ref = this.sheet.abrir<boolean, DespesaSheetDados>(DespesaSheet, { caixaId });
    await firstValueFrom(ref.closed);
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
    await firstValueFrom(ref.closed);
    await this.carregar();
  }
}
