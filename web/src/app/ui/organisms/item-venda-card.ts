import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Icon } from '../atoms/icon';
import { PrecoPipe } from '../pipes/preco-pipe';

/**
 * Item do carrinho no PDV: quantidade × preço, desconto destacado e total líquido.
 * Presentational — dados via input(), intenções via output() (Regra 8.8).
 */
@Component({
  selector: 'ce-item-venda-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, PrecoPipe],
  template: `
    <div class="item">
      <button type="button" class="item__corpo" (click)="editar.emit()">
        <span class="item__nome">{{ nome() }}</span>
        <span class="item__calculo">
          {{ quantidade() }} × {{ precoUnitario() | cePreco }}
          @if (valorDesconto() > 0) {
            <span class="item__desconto">− {{ valorDesconto() | cePreco }}</span>
          }
        </span>
        @if (motivoDesconto(); as motivo) {
          <span class="item__motivo">Desconto: {{ motivo }}</span>
        }
      </button>
      <span class="item__total">{{ totalItem() | cePreco }}</span>
      <button type="button" class="item__remover" aria-label="Remover item" (click)="remover.emit()">
        <ce-icon nome="lixeira" [tamanho]="20" />
      </button>
    </div>
  `,
  styles: `
    @use 'mixins';

    :host {
      display: block;
    }

    .item {
      display: flex;
      align-items: center;
      gap: var(--ce-space-2);
      padding: var(--ce-space-2) var(--ce-space-2) var(--ce-space-2) var(--ce-space-3);
      background: var(--ce-surface);
      border: 1px solid var(--ce-border);
      border-radius: var(--ce-radius-md);
    }

    .item__corpo {
      @include mixins.touch-target;

      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
      text-align: left;
    }

    .item__nome {
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .item__calculo {
      @include mixins.tabular-numbers;

      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    .item__desconto {
      color: var(--ce-warning);
      font-weight: 600;
    }

    .item__motivo {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
      font-style: italic;
    }

    .item__total {
      @include mixins.tabular-numbers;

      font-weight: 700;
    }

    .item__remover {
      @include mixins.touch-target;

      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--ce-danger);
    }
  `,
})
export class ItemVendaCard {
  readonly nome = input.required<string>();
  readonly quantidade = input.required<number>();
  readonly precoUnitario = input.required<number>();
  readonly valorDesconto = input(0);
  readonly motivoDesconto = input<string | null>(null);
  readonly totalItem = input.required<number>();

  readonly editar = output<void>();
  readonly remover = output<void>();
}
