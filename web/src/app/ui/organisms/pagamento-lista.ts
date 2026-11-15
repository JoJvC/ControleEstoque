import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Button } from '../atoms/button';
import { Icon } from '../atoms/icon';
import { SelectOpcao } from '../atoms/select';
import { MoneyInput } from '../molecules/money-input';
import { PrecoPipe } from '../pipes/preco-pipe';

/** Linha editável de pagamento — valor null enquanto o usuário não digitou. */
export interface PagamentoEdicao {
  readonly forma: string;
  readonly valor: number | null;
}

export const FORMAS: SelectOpcao[] = [
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
  imports: [FormsModule, Button, Icon, MoneyInput, PrecoPipe],
  template: `
    <div class="pagamentos">
      <p class="pagamentos__total">
        <span>Total</span>
        <strong>{{ total() | cePreco }}</strong>
      </p>

      @for (pagamento of pagamentos(); track $index; let indice = $index) {
        <div class="pagamentos__linha">
          <div class="formas" role="radiogroup" aria-label="Forma de pagamento">
            @for (forma of formas; track forma.value) {
              <button
                type="button"
                class="forma"
                role="radio"
                [class.forma--ativa]="pagamento.forma === forma.value"
                [attr.aria-checked]="pagamento.forma === forma.value"
                (click)="mudarForma(indice, forma.value)"
              >
                {{ forma.label }}
              </button>
            }
          </div>
          <div class="pagamentos__valor">
            <ce-money-input
              class="pagamentos__campo"
              rotulo="Valor do pagamento"
              [ngModel]="pagamento.valor"
              (ngModelChange)="mudarValor(indice, $event)"
            />
            <button type="button" class="atalho" (click)="atalho.emit({ indice, qual: 'tudo' })">
              Tudo
            </button>
            <button type="button" class="atalho" (click)="atalho.emit({ indice, qual: 'metade' })">
              Metade
            </button>
            <button
              type="button"
              class="pagamentos__remover"
              aria-label="Remover pagamento"
              (click)="remover(indice)"
            >
              <ce-icon nome="lixeira" [tamanho]="20" />
            </button>
          </div>
        </div>
      } @empty {
        @if (total() > 0) {
          <p class="pagamentos__vazio">Nenhum pagamento — o total inteiro vai para fiado.</p>
        }
      }

      <ce-button variante="ghost" (click)="adicionar()">
        <ce-icon nome="mais" [tamanho]="18" /> Adicionar forma de pagamento
      </ce-button>
      <ce-button variante="ghost" (click)="pagamentos.set([])">Tudo fiado</ce-button>

      <dl class="resumo">
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
        } @else if (total() > 0) {
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

    .pagamentos__total {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--ce-space-2);

      strong {
        @include mixins.tabular-numbers;

        font-size: var(--ce-font-xl);
      }
    }

    .pagamentos__linha {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    .formas {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ce-space-2);
    }

    .forma,
    .atalho {
      @include mixins.touch-target;

      padding-inline: var(--ce-space-3);
      border: 1px solid var(--ce-borda-campo);
      border-radius: var(--ce-radius-controle);
      background: var(--ce-surface);
      font-weight: 600;
    }

    .forma--ativa {
      border-color: var(--ce-primary);
      background: var(--ce-primary-soft);
      color: var(--ce-primary-strong);
    }

    .pagamentos__valor {
      display: flex;
      align-items: center;
      gap: var(--ce-space-2);
    }

    .pagamentos__campo {
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
      border-radius: 20px;
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
  /** Atalho de valor pedido para a linha `indice`; quem calcula o valor é a página. */
  readonly atalho = output<{ indice: number; qual: 'tudo' | 'metade' }>();

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

  protected mudarForma(indice: number, forma: string): void {
    this.pagamentos.update((atual) => atual.map((p, i) => (i === indice ? { ...p, forma } : p)));
  }

  protected mudarValor(indice: number, valor: number | null): void {
    this.pagamentos.update((atual) => atual.map((p, i) => (i === indice ? { ...p, valor } : p)));
  }
}
