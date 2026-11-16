import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RelatorioFaturamento } from '../../core/api/models/relatorios';
import { Icon, IconeNome } from '../../ui/atoms/icon';
import { iconeDaCategoria } from '../../ui/atoms/icone-do-produto';
import { Skeleton } from '../../ui/atoms/skeleton';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { HojeStatus } from './hoje-status';

export interface HeroModelo {
  total: number;
  recebido: number;
  fiadoGerado: number;
  linhas: { categoria: string; quantidade: number; icone: IconeNome }[];
}

/** Valores vêm do servidor; nada é somado aqui. */
export function modeloHero(r: RelatorioFaturamento): HeroModelo {
  return {
    total: r.totalLiquido,
    recebido: r.recebido,
    fiadoGerado: r.fiadoGerado,
    linhas: r.porCategoria.map((c) => ({
      categoria: c.categoria,
      quantidade: c.quantidade,
      icone: iconeDaCategoria(c.categoria),
    })),
  };
}

export function saudacao(hora: number): string {
  if (hora < 6) return 'boa noite';
  if (hora < 12) return 'bom dia';
  return hora < 18 ? 'boa tarde' : 'boa noite';
}

export function dataExtenso(d: Date): string {
  const texto = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

@Component({
  selector: 'ce-hoje-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, PrecoPipe, Skeleton],
  template: `
    <section class="hero" aria-label="Vendido hoje">
      <p class="hero__data">{{ data() }}</p>
      <h2 class="hero__saudacao">{{ saudacao() }}</h2>
      <p class="hero__rotulo">Vendido hoje</p>
      @switch (status()) {
        @case ('ok') {
          @if (modelo(); as m) {
            <p class="hero__valor">{{ m.total | cePreco }}</p>
            <p class="hero__chips">
              <span class="hero__chip hero__recebido">Recebido {{ m.recebido | cePreco }}</span>
              <span class="hero__chip hero__fiado">Fiado gerado {{ m.fiadoGerado | cePreco }}</span>
            </p>
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
      <div class="hero__acoes"><ng-content /></div>
    </section>
  `,
  styles: `
    .hero__data {
      font-size: var(--ce-font-sm);
      opacity: 0.85;
    }

    .hero__saudacao {
      font-family: var(--ce-font-family-titulo);
      font-size: var(--ce-font-xl);
      font-weight: 700;
    }

    .hero__acoes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ce-space-3);
      margin-top: var(--ce-space-2);
    }

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

    .hero__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ce-space-2);
    }

    .hero__chip {
      background: var(--ce-topo-cartao);
      color: var(--ce-texto-sobre-topo);
      border-radius: var(--ce-radius-lg);
      padding: var(--ce-space-1) var(--ce-space-3);
      font-size: var(--ce-font-sm);
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
  readonly data = input('');
  readonly saudacao = input('');
}
