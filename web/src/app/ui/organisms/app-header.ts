import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Icon } from '../atoms/icon';

/** Cabeçalho de página: voltar (opcional) + título + slot de ações à direita. */
@Component({
  selector: 'ce-app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { '[class.app-header--onda]': 'onda()' },
  template: `
    <div class="topo" [class.topo--onda]="onda()" [class.topo--folgado]="folgado()">
      <header class="cabecalho">
        @if (mostrarVoltar()) {
          <button
            type="button"
            class="cabecalho__voltar"
            aria-label="Voltar"
            (click)="voltar.emit()"
          >
            <ce-icon nome="seta-esquerda" />
          </button>
        }
        <div class="cabecalho__texto">
          @if (rotulo(); as r) {
            <p class="cabecalho__rotulo">{{ r }}</p>
          }
          <h1 class="cabecalho__titulo">{{ titulo() }}</h1>
        </div>
        <span class="cabecalho__acoes"><ng-content /></span>
      </header>
      <div class="destaque"><ng-content select="[ce-destaque]" /></div>
      @if (onda()) {
        <svg class="topo__onda" viewBox="0 0 360 24" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 24V10C60 24 120 0 180 10S300 24 360 8V24Z" />
        </svg>
      }
    </div>
  `,
  styles: `
    @use 'mixins';

    :host {
      display: block;
    }

    // topo das telas principais: fundo topo do tema e onda para o chao (DESIGN.md §5)
    // as 2 últimas linhas já são --ce-bg: a última linha do svg, com antialiasing, mistura com o
    // fundo atrás dela e deixava uma costura cinza abaixo da onda
    .topo--onda {
      background: linear-gradient(var(--ce-topo) calc(100% - 2px), var(--ce-bg) 0);
      color: var(--ce-texto-sobre-topo);
    }

    // botões slotados leem as cores do topo, não as da superfície
    .topo--onda .cabecalho__acoes {
      --ce-primary: var(--ce-texto-sobre-topo);
      --ce-text-on-primary: var(--ce-topo);
      --ce-border: var(--ce-texto-sobre-topo);
    }

    .topo__onda {
      display: block;
      width: 100%;
      height: 24px;
      fill: var(--ce-bg);
    }

    .cabecalho {
      display: flex;
      align-items: center;
      gap: var(--ce-space-2);
      padding: var(--ce-space-4);
    }

    .cabecalho__voltar {
      @include mixins.touch-target;

      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-left: calc(-1 * var(--ce-space-2));
      color: inherit;
    }

    // desktop folgado (Caixa do dia): padding do protótipo, 28px 32px 56px
    @include mixins.from-desktop {
      .topo--folgado .cabecalho {
        padding: 28px 32px 0;
      }

      .topo--folgado .destaque:not(:empty) {
        padding: 0 32px 56px;
      }
    }

    .cabecalho__texto {
      flex: 1;
      min-width: 0;
    }

    .cabecalho__rotulo {
      margin: 0;
      font-size: var(--ce-font-sm);
      opacity: 0.85;
    }

    .destaque:not(:empty) {
      padding: 0 var(--ce-space-4) var(--ce-space-4);
    }

    .cabecalho__titulo {
      font-size: var(--ce-font-xl);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cabecalho__acoes {
      display: inline-flex;
      align-items: center;
      gap: var(--ce-space-2);
    }
  `,
})
export class AppHeader {
  readonly titulo = input.required<string>();
  readonly mostrarVoltar = input(false);
  readonly onda = input(false);
  /** Em ≥960px usa o padding amplo do protótipo (28px 32px 56px). */
  readonly folgado = input(false);
  /** Linha pequena acima do título (ex.: a data). */
  readonly rotulo = input<string | null>(null);
  readonly voltar = output<void>();
}
