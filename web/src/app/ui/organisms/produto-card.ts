import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

import { Icon } from '../atoms/icon';
import { PrecoPipe } from '../pipes/preco-pipe';

/** Card de produto (foto + nome + marca/tamanho + preço de referência). Presentational. */
@Component({
  selector: 'ce-produto-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, PrecoPipe],
  template: `
    <button type="button" class="card">
      <span class="card__foto">
        @if (fotoSrc() && !fotoFalhou()) {
          <img [src]="fotoSrc()" [alt]="'Foto de ' + nome()" (error)="fotoFalhou.set(true)" />
        } @else {
          <ce-icon nome="galao" [tamanho]="32" />
        }
      </span>
      <span class="card__info">
        <span class="card__nome">{{ nome() }}</span>
        @if (detalhe()) {
          <span class="card__detalhe">{{ detalhe() }}</span>
        }
        <span class="card__preco">{{ precoReferencia() | cePreco }}</span>
      </span>
    </button>
  `,
  styles: `
    @use 'mixins';

    :host {
      display: block;
    }

    .card {
      @include mixins.touch-target;

      width: 100%;
      display: flex;
      align-items: center;
      gap: var(--ce-space-3);
      padding: var(--ce-space-3);
      background: var(--ce-surface);
      border: 1px solid var(--ce-border);
      border-radius: var(--ce-radius-md);
      text-align: left;

      &:active {
        background: var(--ce-primary-soft);
      }
    }

    .card__foto {
      display: grid;
      place-items: center;
      width: 56px;
      height: 56px;
      border-radius: var(--ce-radius-sm);
      background: var(--ce-surface-muted);
      color: var(--ce-text-muted);
      overflow: hidden;
      flex-shrink: 0;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .card__info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .card__nome {
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card__detalhe {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    .card__preco {
      @include mixins.tabular-numbers;

      font-size: var(--ce-font-sm);
      font-weight: 700;
      color: var(--ce-primary-strong);
    }
  `,
})
export class ProdutoCard {
  readonly nome = input.required<string>();
  readonly detalhe = input('');
  readonly precoReferencia = input.required<number>();
  readonly fotoSrc = input<string | null>(null);

  protected readonly fotoFalhou = signal(false);
}
