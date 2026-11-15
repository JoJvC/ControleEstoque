import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { StatusPagamento, VendaDetalheResponse } from '../../core/api/models/vendas';
import { CePermissao } from '../../core/permissions/ce-permissao';
import { Badge, BadgeCor } from '../../ui/atoms/badge';
import { EmptyState } from '../../ui/molecules/empty-state';
import { Skeleton } from '../../ui/atoms/skeleton';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { rotuloStatusPagamento } from '../vendas/venda-rotulos';
import { HojeStatus } from './hoje-status';

export interface UltimaVenda {
  id: string;
  data: string;
  cliente: string;
  total: number;
  status: StatusPagamento;
}

const COR: Record<StatusPagamento, BadgeCor> = {
  PAGA: 'success',
  PARCIAL: 'warning',
  PENDENTE: 'danger',
};

export function rotaVenda(id: string): string {
  return `/vendas/detalhe/${id}`;
}

export function corStatus(s: StatusPagamento): BadgeCor {
  return COR[s] ?? 'neutral';
}

/** Valores vêm do servidor; nome do cliente ausente cai em 'Cliente'. */
export function modeloUltimas(
  vendas: VendaDetalheResponse[],
  nomes: Map<string, string>,
): UltimaVenda[] {
  return vendas.map((v) => ({
    id: v.id,
    data: v.data,
    cliente: nomes.get(v.clienteId) ?? 'Cliente',
    total: v.totalLiquido,
    status: v.statusPagamento,
  }));
}

@Component({
  selector: 'ce-hoje-ultimas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Badge, CePermissao, DatePipe, EmptyState, PrecoPipe, Skeleton],
  template: `
    <section class="ultimas" aria-label="Últimas vendas">
      <header class="ultimas__topo">
        <h2 class="ultimas__titulo">Últimas vendas</h2>
        <button type="button" class="ultimas__todas" (click)="verTodas.emit()">Ver todas</button>
      </header>
      @switch (status()) {
        @case ('ok') {
          @if (itens().length === 0) {
            <ce-empty-state
              titulo="Dia tranquilo por enquanto"
              descricao="A primeira venda do dia aparece aqui, com a hora e o status de pagamento."
            >
              <button
                *cePermissao="'vendas.registrar'"
                type="button"
                class="ultimas__todas"
                (click)="primeira.emit()"
              >
                Fazer a primeira venda
              </button>
            </ce-empty-state>
          } @else {
            <ul class="ultimas__lista">
              @for (v of itens(); track v.id) {
                <li>
                  <button type="button" class="ultimas__item" (click)="abrir.emit(v.id)">
                    <span class="ultimas__hora">{{ v.data | date: 'HH:mm' }}</span>
                    <span class="ultimas__cliente">{{ v.cliente }}</span>
                    <span class="ultimas__valor">{{ v.total | cePreco }}</span>
                    <ce-badge [cor]="cor(v.status)">{{ rotulo(v.status) }}</ce-badge>
                  </button>
                </li>
              }
            </ul>
          }
        }
        @case ('error') {
          <p>Não foi possível carregar as vendas.</p>
        }
        @default {
          <ce-skeleton largura="100%" altura="3rem" />
        }
      }
    </section>
  `,
  styles: `
    .ultimas {
      background: var(--ce-surface);
      border-radius: calc(var(--ce-radius-lg) + 4px);
      padding: var(--ce-space-4);
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    .ultimas__topo {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .ultimas__todas {
      background: none;
      border: 0;
      color: var(--ce-primary);
      font-weight: 600;
      min-height: 44px;
    }

    .ultimas__lista {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .ultimas__item {
      display: flex;
      align-items: center;
      gap: var(--ce-space-3);
      width: 100%;
      min-height: 44px;
      background: none;
      border: 0;
      color: inherit;
      font: inherit;
      text-align: left;
    }

    .ultimas__hora {
      color: var(--ce-text-muted);
      font-variant-numeric: tabular-nums;
    }

    .ultimas__cliente {
      flex: 1;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ultimas__valor {
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class HojeUltimas {
  readonly itens = input<UltimaVenda[]>([]);
  readonly status = input<HojeStatus>('ok');
  readonly abrir = output<string>();
  readonly verTodas = output<void>();
  readonly primeira = output<void>();
  protected readonly cor = corStatus;
  protected readonly rotulo = rotuloStatusPagamento;
}
