import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';

import { StatusPedido } from '../../core/api/models/pedidos';
import { CePermissao } from '../../core/permissions/ce-permissao';
import { Button } from '../../ui/atoms/button';
import { ListItem } from '../../ui/molecules/list-item';
import { AppHeader } from '../../ui/organisms/app-header';
import { DataList } from '../../ui/organisms/data-list';
import { rotuloStatus } from './pedido-form';
import { PedidosStore } from './pedidos-store';

@Component({
  selector: 'ce-pedidos-lista-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, CePermissao, AppHeader, Button, DataList, ListItem],
  template: `
    <ce-app-header titulo="Pedidos">
      <ce-button *cePermissao="'vendas.registrar'" rotulo="Novo pedido" (click)="novo()">
        + Novo pedido
      </ce-button>
    </ce-app-header>

    <div class="filtros">
      <div class="pilulas" role="group" aria-label="Filtro por status">
        @for (op of opcoes; track op.rotulo) {
          <button
            type="button"
            class="pilula"
            [attr.aria-pressed]="store.filtro() === op.valor"
            (click)="store.filtrar(op.valor)"
          >
            {{ op.rotulo }}
          </button>
        }
      </div>
    </div>

    <div class="conteudo">
      <ce-data-list
        [itens]="store.linhas()"
        [status]="store.statusLista()"
        vazioTitulo="Nenhum pedido"
        vazioDescricao="Nenhum pedido neste filtro."
        (recarregar)="store.carregarLista()"
      >
        <ng-template let-linha>
          <ce-list-item (click)="abrir(linha.id)">
            <span class="nome">{{ linha.clienteNome ?? 'Carregando cliente…' }}</span>
            <span class="secundario">
              {{ linha.createdAt | date: 'dd/MM/yyyy HH:mm' }}
              @if (linha.observacao) {
                · {{ linha.observacao }}
              }
            </span>
            <span ce-trailing class="status">{{ rotuloStatus(linha.status) }}</span>
          </ce-list-item>
        </ng-template>
      </ce-data-list>
    </div>
  `,
  styles: `
    @use 'mixins';

    .filtros {
      padding-inline: var(--ce-space-4);
    }

    .pilulas {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ce-space-2);
    }

    .pilula {
      @include mixins.touch-target;

      padding-inline: var(--ce-space-4);
      border: 1px solid var(--ce-border);
      border-radius: 999px;
      background: var(--ce-surface);
      font-weight: 600;

      &[aria-pressed='true'] {
        border-color: var(--ce-primary);
        background: var(--ce-primary-soft);
        color: var(--ce-primary-strong);
      }
    }

    .conteudo {
      padding: var(--ce-space-4);
    }

    :host ::ng-deep .item {
      border-radius: 20px;
    }

    .nome {
      font-weight: 600;
    }

    .secundario {
      display: block;
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .status {
      font-size: var(--ce-font-sm);
      font-weight: 600;
    }
  `,
})
export class PedidosListaPage implements OnInit {
  protected readonly store = inject(PedidosStore);
  private readonly router = inject(Router);

  protected readonly rotuloStatus = rotuloStatus;
  protected readonly opcoes: { valor: StatusPedido | null; rotulo: string }[] = [
    { valor: null, rotulo: 'Todos' },
    { valor: 'PENDENTE', rotulo: 'Pendentes' },
    { valor: 'EM_ANDAMENTO', rotulo: 'Em andamento' },
    { valor: 'CONCLUIDO', rotulo: 'Concluídos' },
    { valor: 'CANCELADO', rotulo: 'Cancelados' },
  ];

  ngOnInit(): void {
    this.store.carregarLista();
  }

  protected novo(): void {
    this.router.navigateByUrl('/pedidos/novo');
  }

  protected abrir(id: string): void {
    this.router.navigateByUrl('/pedidos/' + id);
  }
}
