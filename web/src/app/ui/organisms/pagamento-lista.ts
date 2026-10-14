import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Button } from '../atoms/button';
import { Icon } from '../atoms/icon';
import { Select, SelectOpcao } from '../atoms/select';
import { MoneyInput } from '../molecules/money-input';
import { PrecoPipe } from '../pipes/preco-pipe';

/** Linha editável de pagamento — valor null enquanto o usuário não digitou. */
export interface PagamentoEdicao {
  readonly forma: string;
  readonly valor: number | null;
}

const FORMAS: SelectOpcao[] = [
  { value: 'PIX', label: 'PIX' },
  { value: 'CARTAO_CREDITO', label: 'Cartão de crédito' },
  { value: 'CARTAO_DEBITO', label: 'Cartão de débito' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'OUTRO', label: 'Outro' },
];

/**
 * N formas de pagamento + Total | Pago | "Vai para fiado" ao vivo (Regra 8.5).
 * Presentational: o total vem por input, as linhas via model() — quem valida/submete é a página.
 */
@Component({
  selector: 'ce-pagamento-lista',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Button, Icon, Select, MoneyInput, PrecoPipe],
  template: `
    <div class="pagamentos">
      @for (pagamento of pagamentos(); track $index; let indice = $index) {
        <div class="pagamentos__linha">
          <ce-select
            class="pagamentos__forma"
            [opcoes]="formas"
            [ngModel]="pagamento.forma"
            (ngModelChange)="mudarForma(indice, $event)"
          />
          <ce-money-input
            class="pagamentos__valor"
            [ngModel]="pagamento.valor"
            (ngModelChange)="mudarValor(indice, $event)"
          />
          <button
            type="button"
            class="pagamentos__remover"
            aria-label="Remover pagamento"
            (click)="remover(indice)"
          >
            <ce-icon nome="lixeira" [tamanho]="20" />
          </button>
        </div>
      } @empty {
        <p class="pagamentos__vazio">Nenhum pagamento — o total inteiro vai para fiado.</p>
      }

      <ce-button variante="ghost" (click)="adicionar()">
        <ce-icon nome="mais" [tamanho]="18" /> Adicionar forma de pagamento
      </ce-button>

      <dl class="resumo">
        <div class="resumo__linha">
          <dt>Total</dt>
          <dd>{{ total() | cePreco }}</dd>
        </div>
        <div class="resumo__linha">
          <dt>Pago</dt>
          <dd>{{ totalPago() | cePreco }}</dd>
        </div>
        @if (excede()) {
          <div class="resumo__linha resumo__linha--erro" role="alert">
            <dt>Pagamentos excedem o total</dt>
            <dd>− {{ totalPago() - total() | cePreco }}</dd>
          </div>
        } @else if (faltante() > 0) {
          <div class="resumo__linha resumo__linha--fiado">
            <dt>Vai para fiado</dt>
            <dd>{{ faltante() | cePreco }}</dd>
          </div>
        } @else {
          <div class="resumo__linha resumo__linha--pago">
            <dt>Venda paga por completo</dt>
            <dd></dd>
          </div>
        }
      </dl>
    </div>
  `,
  styles: `
    @use 'mixins';

    .pagamentos {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .pagamentos__linha {
      display: flex;
      align-items: center;
      gap: var(--ce-space-2);
    }

    .pagamentos__forma {
      flex: 1.2;
      min-width: 0;
    }

    .pagamentos__valor {
      flex: 1;
      min-width: 0;
    }

    .pagamentos__remover {
      @include mixins.touch-target;

      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--ce-danger);
    }

    .pagamentos__vazio {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    .resumo {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-1);
      padding: var(--ce-space-3);
      border-radius: var(--ce-radius-md);
      background: var(--ce-surface-muted);
      border: 1px solid var(--ce-border);
    }

    .resumo__linha {
      display: flex;
      justify-content: space-between;
      gap: var(--ce-space-2);

      dd {
        @include mixins.tabular-numbers;

        font-weight: 700;
      }
    }

    .resumo__linha--fiado {
      color: var(--ce-warning);
      font-weight: 600;
    }

    .resumo__linha--erro {
      color: var(--ce-danger);
      font-weight: 600;
    }

    .resumo__linha--pago {
      color: var(--ce-success);
      font-weight: 600;
    }
  `,
})
export class PagamentoLista {
  readonly total = input.required<number>();
  readonly pagamentos = model<readonly PagamentoEdicao[]>([]);

  protected readonly formas = FORMAS;

  readonly totalPago = computed(() =>
    this.pagamentos().reduce((soma, p) => soma + (p.valor ?? 0), 0),
  );

  readonly faltante = computed(() => Math.max(0, this.total() - this.totalPago()));

  readonly excede = computed(() => this.totalPago() > this.total());

  protected adicionar(): void {
    this.pagamentos.update((atual) => [...atual, { forma: 'PIX', valor: null }]);
  }

  protected remover(indice: number): void {
    this.pagamentos.update((atual) => atual.filter((_, i) => i !== indice));
  }

  protected mudarForma(indice: number, forma: string | null): void {
    this.pagamentos.update((atual) =>
      atual.map((p, i) => (i === indice ? { ...p, forma: forma ?? 'PIX' } : p)),
    );
  }

  protected mudarValor(indice: number, valor: number | null): void {
    this.pagamentos.update((atual) => atual.map((p, i) => (i === indice ? { ...p, valor } : p)));
  }
}
