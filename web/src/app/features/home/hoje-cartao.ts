import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { Icon, IconeNome } from '../../ui/atoms/icon';
import { Skeleton } from '../../ui/atoms/skeleton';
import { HojeStatus } from './hoje-status';

export type CartaoVariante = 'casco' | 'fiado';

export function modeloCartao(variante: CartaoVariante): {
  rotulo: string;
  icone: IconeNome | null;
} {
  return variante === 'casco'
    ? { rotulo: 'Cascos na rua', icone: 'casco-na-rua' }
    : { rotulo: 'Fiado a receber', icone: null };
}

@Component({
  selector: 'ce-hoje-cartao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Skeleton],
  template: `
    <section
      class="cartao"
      [class.cartao--casco]="variante() === 'casco'"
      [class.cartao--fiado]="variante() === 'fiado'"
      [attr.aria-label]="m().rotulo"
    >
      <p class="cartao__rotulo">
        @if (m().icone; as i) {
          <ce-icon [nome]="i" [tamanho]="20" />
        }
        {{ m().rotulo }}
      </p>
      @switch (status()) {
        @case ('ok') {
          <p class="cartao__valor">{{ valor() }}</p>
        }
        @case ('error') {
          <p>Não foi possível carregar.</p>
        }
        @default {
          <ce-skeleton largura="50%" altura="2rem" />
        }
      }
    </section>
  `,
  styles: `
    .cartao {
      background: var(--ce-surface);
      border-radius: calc(var(--ce-radius-lg) + 4px);
      padding: var(--ce-space-4);
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    .cartao--casco {
      border: 2px dashed var(--ce-casco);
      background: var(--ce-casco-soft);
    }

    .cartao--fiado {
      border: 2px solid var(--ce-fiado);
      background: var(--ce-fiado-soft);
    }

    .cartao__rotulo {
      display: flex;
      align-items: center;
      gap: var(--ce-space-2);
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    .cartao__valor {
      font-family: var(--ce-font-family-titulo);
      font-size: var(--ce-font-xl);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class HojeCartao {
  readonly variante = input.required<CartaoVariante>();
  readonly valor = input('');
  readonly status = input<HojeStatus>('ok');
  protected readonly m = computed(() => modeloCartao(this.variante()));
}
