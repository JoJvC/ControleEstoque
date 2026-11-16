import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { FinanceiroApi } from '../../core/api/financeiro-api';
import { ItemListaCaixa } from '../../core/api/models/financeiro';
import { hojeLocal } from '../../core/util/data-local';
import { Badge } from '../../ui/atoms/badge';
import { Button } from '../../ui/atoms/button';
import { Skeleton } from '../../ui/atoms/skeleton';
import { EmptyState } from '../../ui/molecules/empty-state';
import { ListItem } from '../../ui/molecules/list-item';
import { AppHeader } from '../../ui/organisms/app-header';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { FiltroPeriodo } from '../relatorios/filtro-periodo';
import { MSG_PERIODO_INVERTIDO, periodoInvertido } from '../relatorios/periodo';

/** Últimos 30 dias até hoje, em yyyy-MM-dd. */
function periodoInicial(agora: Date = new Date()): { inicio: string; fim: string } {
  const inicio = new Date(agora);
  inicio.setDate(inicio.getDate() - 30);
  return { inicio: hojeLocal(inicio), fim: hojeLocal(agora) };
}

/** yyyy-MM-dd → dd/MM/yyyy. */
function dataBr(data: string): string {
  const [a, m, d] = data.split('-');
  return `${d}/${m}/${a}`;
}

@Component({
  selector: 'ce-caixas-lista-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeader, Badge, Button, EmptyState, FiltroPeriodo, ListItem, PrecoPipe, Skeleton],
  template: `
    <ce-app-header titulo="Caixas anteriores" [mostrarVoltar]="true" (voltar)="voltar()" />

    <ce-filtro-periodo
      [inicio]="inicio()"
      [fim]="fim()"
      [erro]="erroPeriodo()"
      [carregando]="status() === 'loading'"
      (inicioChange)="inicio.set($event)"
      (fimChange)="fim.set($event)"
      (buscar)="buscar()"
    />

    <div class="conteudo">
      @switch (status()) {
        @case ('error') {
          <ce-empty-state icone="alerta" titulo="Não foi possível carregar os caixas">
            <ce-button variante="ghost" (click)="buscar()">Tentar de novo</ce-button>
          </ce-empty-state>
        }
        @case ('ok') {
          @for (c of linhas(); track c.id) {
            <ce-list-item (click)="abrir(c.id)">
              <b>{{ dataBr(c.data) }}</b>
              <span class="selos">
                <ce-badge [cor]="c.status === 'ABERTO' ? 'primary' : 'neutral'">{{
                  c.status === 'ABERTO' ? 'Aberto' : 'Fechado'
                }}</ce-badge>
                @if (c.fechadoPeloSistema) {
                  <ce-badge cor="warning">Fechado pelo sistema</ce-badge>
                }
                @if (c.diariasPendentes) {
                  <ce-badge cor="danger">Diárias pendentes</ce-badge>
                }
              </span>
              <span ce-trailing class="valor">{{ c.saldoFinal | cePreco }}</span>
            </ce-list-item>
          } @empty {
            <ce-empty-state icone="alerta" titulo="Nenhum caixa no período" />
          }
        }
        @default {
          <div class="carregando" aria-busy="true">
            <ce-skeleton altura="64px" />
            <ce-skeleton altura="64px" />
          </div>
        }
      }
    </div>
  `,
  styles: `
    @use 'mixins';

    .conteudo,
    .carregando {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    .conteudo {
      @include mixins.safe-area-bottom(var(--ce-space-6));

      padding: var(--ce-space-4);

      @include mixins.from-desktop {
        padding: 24px 32px 32px;
        max-width: 720px;
      }
    }

    .selos {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ce-space-1);
    }

    .valor {
      font-weight: 700;
      @include mixins.tabular-numbers;
    }
  `,
})
export class CaixasListaPage {
  private readonly api = inject(FinanceiroApi);
  private readonly router = inject(Router);

  protected readonly inicio = signal(periodoInicial().inicio);
  protected readonly fim = signal(periodoInicial().fim);
  protected readonly status = signal<'loading' | 'ok' | 'error'>('loading');
  private readonly caixas = signal<readonly ItemListaCaixa[]>([]);
  /** Da data mais recente para a mais antiga (yyyy-MM-dd compara como texto). */
  protected readonly linhas = computed(() =>
    [...this.caixas()].sort((a, b) => b.data.localeCompare(a.data)),
  );
  protected readonly erroPeriodo = computed(() =>
    periodoInvertido(this.inicio(), this.fim()) ? MSG_PERIODO_INVERTIDO : null,
  );
  protected readonly dataBr = dataBr;

  constructor() {
    void this.buscar();
  }

  protected async buscar(): Promise<void> {
    if (this.erroPeriodo() || !this.inicio() || !this.fim()) {
      return;
    }
    this.status.set('loading');
    try {
      this.caixas.set(await firstValueFrom(this.api.listarCaixas(this.inicio(), this.fim())));
      this.status.set('ok');
    } catch {
      // 0/5xx já viram toast no interceptor
      this.status.set('error');
    }
  }

  protected abrir(id: string): void {
    void this.router.navigateByUrl(`/financeiro/caixas/${id}`);
  }

  protected voltar(): void {
    void this.router.navigateByUrl('/financeiro/caixa');
  }
}
