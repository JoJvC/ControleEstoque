import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { EstoqueItemResponse } from '../../core/api/models/estoque';
import { marcaMinimo, proporcao } from '../../features/estoque/estoque-grupos';

const ALTURA = 60; // corpo do galão no viewBox (y de 20 a 80)
const BASE = 80;

/** Galão em SVG: nível proporcional ao maior do grupo e linha tracejada no mínimo. */
@Component({
  selector: 'ce-galao-nivel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="galao" [attr.data-abaixo-minimo]="item().abaixoMinimo ? '' : null">
      <svg viewBox="0 0 60 90" width="72" height="108" aria-hidden="true">
        <defs>
          <clipPath [id]="clipId()"><rect x="8" y="20" width="44" height="60" rx="10" /></clipPath>
        </defs>
        <rect class="galao__corpo" x="8" y="20" width="44" height="60" rx="10" />
        <rect class="galao__gargalo" x="22" y="8" width="16" height="14" rx="3" />
        <rect
          class="galao__nivel"
          [attr.clip-path]="'url(#' + clipId() + ')'"
          x="8"
          [attr.y]="nivelY()"
          width="44"
          [attr.height]="nivelAltura()"
        />
        <line class="galao__minimo" x1="4" x2="56" [attr.y1]="minimoY()" [attr.y2]="minimoY()" />
      </svg>
      <span class="galao__nome">{{ item().nome }}</span>
      @if (item().marca) {
        <span class="galao__marca">{{ item().marca }}</span>
      }
      <span class="galao__qtd">{{ item().quantidade }}</span>
      @if (item().abaixoMinimo) {
        <span class="galao__alerta">abaixo do mínimo ({{ item().estoqueMinimo }})</span>
      }
    </span>
  `,
  styles: `
    @use 'mixins';

    :host {
      display: block;
    }

    .galao {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--ce-space-1);
      padding: var(--ce-space-3);
      border: 1px solid var(--ce-border);
      border-radius: 20px;
      background: var(--ce-surface);
    }

    .galao[data-abaixo-minimo] {
      border-color: var(--ce-warning);
    }

    .galao__corpo {
      fill: var(--ce-agua-soft);
      stroke: var(--ce-agua);
      stroke-width: 2;
    }

    .galao__gargalo {
      fill: var(--ce-agua);
    }

    .galao__nivel {
      fill: var(--ce-agua-nivel);
    }

    [data-abaixo-minimo] .galao__nivel {
      fill: var(--ce-warning);
    }

    .galao__minimo {
      stroke: var(--ce-text);
      stroke-width: 1.5;
      stroke-dasharray: 4 3;
    }

    .galao__nome {
      font-weight: 600;
    }

    .galao__marca,
    .galao__alerta {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    .galao__alerta {
      color: var(--ce-text);
    }

    .galao__qtd {
      @include mixins.tabular-numbers;

      font-size: var(--ce-font-xl);
      font-weight: 700;
    }
  `,
})
export class GalaoNivel {
  readonly item = input.required<EstoqueItemResponse>();
  readonly maiorDoGrupo = input.required<number>();

  protected readonly clipId = computed(() => `galao-clip-${this.item().produtoId}`);
  protected readonly nivelAltura = computed(
    () => proporcao(this.item().quantidade, this.maiorDoGrupo()) * ALTURA,
  );
  protected readonly nivelY = computed(() => BASE - this.nivelAltura());
  protected readonly minimoY = computed(
    () => BASE - marcaMinimo(this.item().estoqueMinimo, this.maiorDoGrupo()) * ALTURA,
  );
}
