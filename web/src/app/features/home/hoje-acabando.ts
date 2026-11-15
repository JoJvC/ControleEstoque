import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { EstoqueItemResponse } from '../../core/api/models/estoque';
import { rotuloDaMarca } from '../../core/api/produto-leitura';
import { PermissionService } from '../../core/permissions/permission-service';
import { Icon, IconeNome } from '../../ui/atoms/icon';
import { iconeDoProduto } from '../../ui/atoms/icone-do-produto';
import { Skeleton } from '../../ui/atoms/skeleton';
import { EmptyState } from '../../ui/molecules/empty-state';
import { HojeStatus } from './hoje-status';

export interface AcabandoLinha {
  /** Produto + marca: duas marcas do mesmo produto são duas linhas. */
  chave: string;
  /** produtoId: o Repor segue por produto. */
  id: string;
  nome: string;
  quantidade: number;
  minimo: number;
  icone: IconeNome;
}

/** Destino do Repor; a reposição guiada (fatia 5) troca só esta função. */
export function rotaRepor(produtoId: string): string {
  return `/estoque/abastecimento?produtoId=${encodeURIComponent(produtoId)}`;
}

/** O servidor já filtrou (abaixo do mínimo); aqui só se mapeia para exibição. */
export function modeloAcabando(itens: EstoqueItemResponse[]): AcabandoLinha[] {
  return itens.map((i) => ({
    chave: `${i.produtoId}:${i.marca ?? ''}`,
    id: i.produtoId,
    nome: i.marca ? `${i.nome} — ${rotuloDaMarca(i.marca)}` : i.nome,
    quantidade: i.quantidade,
    minimo: i.estoqueMinimo,
    icone: iconeDoProduto({ tipo: i.tipo, categoria: i.categoria }),
  }));
}

@Component({
  selector: 'ce-hoje-acabando',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, Icon, Skeleton],
  template: `
    <section class="acabando" aria-label="Acabando">
      <h2 class="acabando__titulo">Acabando</h2>
      @switch (status()) {
        @case ('ok') {
          @if (itens().length === 0) {
            <ce-empty-state titulo="Nenhum produto abaixo do mínimo" />
          } @else {
            <ul class="acabando__lista">
              @for (l of itens(); track l.chave) {
                <li class="acabando__item">
                  <ce-icon [nome]="l.icone" [tamanho]="24" />
                  <span class="acabando__nome">{{ l.nome }}</span>
                  <span class="acabando__qtd">{{ l.quantidade }} / {{ l.minimo }}</span>
                  @if (podeRepor()) {
                    <button
                      type="button"
                      class="acabando__repor"
                      [attr.aria-label]="'Repor ' + l.nome"
                      (click)="repor.emit(l.id)"
                    >
                      Repor
                    </button>
                  }
                </li>
              }
            </ul>
          }
        }
        @case ('error') {
          <p>Não foi possível carregar o estoque.</p>
        }
        @default {
          <ce-skeleton largura="100%" altura="3rem" />
        }
      }
    </section>
  `,
  styles: `
    .acabando {
      background: var(--ce-surface);
      border-radius: calc(var(--ce-radius-lg) + 4px);
      padding: var(--ce-space-4);
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    .acabando__titulo {
      font-size: var(--ce-font-lg);
    }

    .acabando__lista {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .acabando__item {
      display: flex;
      align-items: center;
      gap: var(--ce-space-3);
      min-height: 44px;
    }

    .acabando__nome {
      flex: 1;
    }

    .acabando__repor {
      min-height: 44px;
      padding: 0 var(--ce-space-3);
      border-radius: var(--ce-radius-controle);
      border: 1px solid var(--ce-border);
      background: var(--ce-surface);
      color: var(--ce-text);
      font-weight: 600;
    }

    .acabando__qtd {
      color: var(--ce-fiado);
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
  `,
})
export class HojeAcabando {
  readonly itens = input<AcabandoLinha[]>([]);
  readonly status = input<HojeStatus>('ok');
  readonly repor = output<string>();
  private readonly permissions = inject(PermissionService);
  protected readonly podeRepor = () => this.permissions.has('estoque.editar');
}
