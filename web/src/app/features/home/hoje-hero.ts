import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RelatorioFaturamento } from '../../core/api/models/relatorios';
import { Icon, IconeNome } from '../../ui/atoms/icon';
import { iconeDaCategoria } from '../../ui/atoms/icone-do-produto';
import { Skeleton } from '../../ui/atoms/skeleton';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { HojeStatus } from './hoje-status';

export interface HeroModelo {
  total: number;
  linhas: { categoria: string; quantidade: number; icone: IconeNome }[];
}

/** Valores vêm do servidor; nada é somado aqui. */
export function modeloHero(r: RelatorioFaturamento): HeroModelo {
  return {
    total: r.totalLiquido,
    linhas: r.porCategoria.map((c) => ({
      categoria: c.categoria,
      quantidade: c.quantidade,
      icone: iconeDaCategoria(c.categoria),
    })),
  };
}

@Component({
  selector: 'ce-hoje-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, PrecoPipe, Skeleton],
  template: `
    <section class="hero" aria-label="Vendido hoje">
      <p class="hero__rotulo">Vendido hoje</p>
      @switch (status()) {
        @case ('ok') {
          @if (modelo(); as m) {
            <p class="hero__valor">{{ m.total | cePreco }}</p>
            <ul class="hero__saidas" aria-label="Saídas por categoria">
              @for (l of m.linhas; track l.categoria) {
                <li class="hero__saida">
                  <ce-icon [nome]="l.icone" [tamanho]="20" />
                  <span>{{ l.categoria }}</span>
                  <strong>{{ l.quantidade }}</strong>
                </li>
              }
            </ul>
          }
        }
        @case ('error') {
          <p>Não foi possível carregar o total.</p>
        }
        @default {
          <ce-skeleton largura="60%" altura="2.5rem" />
        }
      }
    </section>
  `,
  styles: `
    .hero {
      background: var(--ce-topo);
      color: var(--ce-texto-sobre-topo);
      border-radius: calc(var(--ce-radius-lg) + 4px);
      padding: var(--ce-space-5);
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    .hero__rotulo {
      font-size: var(--ce-font-sm);
      opacity: 0.85;
    }

    .hero__valor {
      font-family: var(--ce-font-family-titulo);
      font-size: 2.25rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }

    .hero__saidas {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: var(--ce-space-2) var(--ce-space-4);
    }

    .hero__saida {
      display: flex;
      align-items: center;
      gap: var(--ce-space-2);
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class HojeHero {
  readonly modelo = input<HeroModelo | null>(null);
  readonly status = input<HojeStatus>('ok');
}
