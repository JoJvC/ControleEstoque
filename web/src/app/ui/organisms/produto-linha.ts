import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TipoProduto } from '../../core/api/models/estoque';
import { Icon } from '../atoms/icon';
import { iconeDoProduto } from '../atoms/icone-do-produto';
import { QuantityStepper } from '../molecules/quantity-stepper';
import { PrecoPipe } from '../pipes/preco-pipe';

/** Linha de produto do PDV: ícone, nome, estoque, preço, contador −/+ e link de preço e desconto. */
@Component({
  selector: 'ce-produto-linha',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Icon, QuantityStepper, PrecoPipe],
  template: `
    <div class="linha">
      <ce-icon class="linha__icone" [nome]="icone()" [tamanho]="32" />
      <div class="linha__info">
        <span class="linha__nome">{{ nome() }}</span>
        <span class="linha__meta">
          @if (detalhe()) {
            {{ detalhe() }} ·
          }
          @if (estoque() !== null) {
            Estoque: {{ estoque() }} ·
          }
          <span class="linha__preco">{{ preco() | cePreco }}</span>
        </span>
        <button type="button" class="linha__link" (click)="editarPreco.emit()">
          preço e desconto
        </button>
      </div>
      <ce-quantity-stepper
        [rotulo]="'Quantidade de ' + nome()"
        [item]="nome()"
        [ngModel]="quantidade()"
        (ngModelChange)="quantidadeChange.emit($event)"
      />
    </div>
  `,
  styles: `
    @use 'mixins';

    :host {
      display: block;
    }

    .linha {
      display: flex;
      align-items: center;
      gap: var(--ce-space-3);
      padding: var(--ce-space-3);
      background: var(--ce-surface);
      border: 1px solid var(--ce-border);
      border-radius: var(--ce-radius-lg);
    }

    .linha__icone {
      color: var(--ce-text-muted);
    }

    .linha__info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
    }

    .linha__nome {
      font-weight: 600;
    }

    .linha__meta {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    .linha__preco {
      @include mixins.tabular-numbers;

      font-weight: 700;
      color: var(--ce-primary-strong);
    }

    .linha__link {
      @include mixins.touch-target;

      padding: 0;
      color: var(--ce-primary-strong);
      font-size: var(--ce-font-sm);
      font-weight: 600;
      text-decoration: underline;
    }
  `,
})
export class ProdutoLinha {
  readonly nome = input.required<string>();
  readonly detalhe = input('');
  readonly tipo = input.required<TipoProduto>();
  readonly categoria = input<string | null>(null);
  readonly preco = input.required<number>();
  /** null quando o estoque ainda não chegou. */
  readonly estoque = input<number | null>(null);
  readonly quantidade = input(0);
  readonly quantidadeChange = output<number>();
  readonly editarPreco = output<void>();

  protected readonly icone = computed(() =>
    iconeDoProduto({ tipo: this.tipo(), categoria: this.categoria() }),
  );
}
