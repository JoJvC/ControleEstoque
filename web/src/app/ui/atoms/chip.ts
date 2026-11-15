import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Icon, IconeNome } from './icon';

export type ChipTom = 'casco' | 'sucata' | 'fiado' | 'pago' | 'agua';

/**
 * Chip de função (DESIGN.md §3): um único valor de um único tom.
 * Casco, sucata, fiado e pago nunca se somam: o componente não recebe lista nem total.
 * O texto fica em `--ce-text` (o par pago/pago-soft não chega a 4,5); a cor de função
 * vai na borda e no ícone, elementos não textuais (limiar 3).
 */
@Component({
  selector: 'ce-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <span class="chip" [class]="'chip--' + tom()">
      @if (icone(); as nome) {
        <ce-icon class="chip__icone" [nome]="nome" [tamanho]="16" />
      }
      <span class="chip__conteudo"><ng-content /></span>
    </span>
  `,
  styles: `
    @use 'mixins';

    :host {
      display: inline-block;
    }

    .chip {
      @include mixins.tabular-numbers;

      display: inline-flex;
      align-items: center;
      gap: var(--ce-space-1);
      padding: var(--ce-space-1) var(--ce-space-3);
      border: 1px solid var(--chip-cor);
      border-radius: 999px;
      background: var(--chip-fundo);
      color: var(--ce-text);
      font-size: var(--ce-font-sm);
      font-weight: 600;
    }

    .chip__icone {
      color: var(--chip-cor);
    }

    .chip--casco {
      --chip-cor: var(--ce-casco);
      --chip-fundo: var(--ce-casco-soft);
    }

    .chip--sucata {
      --chip-cor: var(--ce-sucata);
      --chip-fundo: var(--ce-sucata-soft);
    }

    .chip--fiado {
      --chip-cor: var(--ce-fiado);
      --chip-fundo: var(--ce-fiado-soft);
    }

    .chip--agua {
      --chip-cor: var(--ce-agua);
      --chip-fundo: var(--ce-agua-soft);
    }

    .chip--pago {
      --chip-cor: var(--ce-pago);
      --chip-fundo: var(--ce-pago-soft);
    }
  `,
})
export class Chip {
  readonly tom = input.required<ChipTom>();
  readonly icone = input<IconeNome>();
}
