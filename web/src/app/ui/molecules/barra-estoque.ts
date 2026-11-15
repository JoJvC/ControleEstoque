import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { EstoqueItemResponse } from '../../core/api/models/estoque';
import { marcaMinimo, proporcao } from '../../features/estoque/estoque-grupos';
import { Icon } from '../atoms/icon';
import { iconeDoProduto } from '../atoms/icone-do-produto';

/** Barra de descartável: cheia = maior estoque do grupo (só exibição). Destaque vem do servidor. */
@Component({
  selector: 'ce-barra-estoque',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <span class="barra" [attr.data-abaixo-minimo]="item().abaixoMinimo ? '' : null">
      <ce-icon class="barra__icone" [nome]="icone()" [tamanho]="22" />
      <span class="barra__corpo">
        <span class="barra__linha">
          <span class="barra__nome">{{ item().nome }}</span>
          <span class="barra__qtd">{{ item().quantidade }}</span>
        </span>
        <span class="barra__trilho">
          <span class="barra__preenchimento" [style.width.%]="largura()"></span>
          <span class="barra__minimo" [style.left.%]="minimo()"></span>
        </span>
        @if (item().abaixoMinimo) {
          <span class="barra__alerta">abaixo do mínimo ({{ item().estoqueMinimo }})</span>
        }
      </span>
    </span>
  `,
  styles: `
    @use 'mixins';

    :host,
    .barra__corpo,
    .barra__trilho,
    .barra__preenchimento {
      display: block;
    }

    .barra {
      display: flex;
      align-items: center;
      gap: var(--ce-space-3);
      padding: var(--ce-space-3);
      border: 1px solid var(--ce-border);
      border-radius: 18px;
      background: var(--ce-surface);
    }

    .barra[data-abaixo-minimo] {
      border-color: var(--ce-warning);
    }

    .barra__icone {
      color: var(--ce-text-muted);
    }

    .barra__corpo {
      flex: 1;
      min-width: 0;
      text-align: left;
    }

    .barra__linha {
      display: flex;
      justify-content: space-between;
      gap: var(--ce-space-2);
      font-weight: 600;
    }

    .barra__qtd {
      @include mixins.tabular-numbers;
    }

    .barra__trilho {
      position: relative;
      height: 10px;
      margin-top: var(--ce-space-2);
      border-radius: 999px;
      background: var(--ce-agua-soft);
    }

    .barra__preenchimento {
      height: 100%;
      border-radius: 999px;
      background: var(--ce-agua);
    }

    [data-abaixo-minimo] .barra__preenchimento {
      background: var(--ce-warning);
    }

    .barra__minimo {
      position: absolute;
      top: -3px;
      bottom: -3px;
      width: 2px;
      background: var(--ce-text);
    }

    .barra__alerta {
      font-size: var(--ce-font-sm);
      color: var(--ce-text);
    }
  `,
})
export class BarraEstoque {
  readonly item = input.required<EstoqueItemResponse>();
  readonly maiorDoGrupo = input.required<number>();

  protected readonly icone = computed(() => iconeDoProduto(this.item()));
  protected readonly largura = computed(
    () => proporcao(this.item().quantidade, this.maiorDoGrupo()) * 100,
  );
  protected readonly minimo = computed(
    () => marcaMinimo(this.item().estoqueMinimo, this.maiorDoGrupo()) * 100,
  );
}
