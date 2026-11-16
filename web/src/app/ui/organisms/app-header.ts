import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Icon } from '../atoms/icon';

/**
 * Cabeçalho de página (DESIGN.md §5, "Padrão de página"): voltar (opcional) + título + ações
 * à direita. A linha é sticky logo abaixo da barra do shell; o `[ce-destaque]` e a onda rolam
 * com a página, por isso o host é `display: contents` (o sticky vale na altura do pai da página).
 */
@Component({
  selector: 'ce-app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { '[class.app-header--onda]': 'onda()' },
  template: `
    <header
      class="cabecalho"
      [class.cabecalho--topo]="!secao()"
      [class.cabecalho--fixo]="fixo() && !secao()"
      [class.cabecalho--folgado]="folgado()"
    >
      @if (mostrarVoltar()) {
        <button type="button" class="cabecalho__voltar" aria-label="Voltar" (click)="voltar.emit()">
          <ce-icon nome="seta-esquerda" />
        </button>
      }
      <div class="cabecalho__texto">
        @if (rotulo(); as r) {
          <p class="cabecalho__rotulo">{{ r }}</p>
        }
        @if (secao()) {
          <h2 class="cabecalho__titulo">{{ titulo() }}</h2>
        } @else {
          <h1 class="cabecalho__titulo">{{ titulo() }}</h1>
        }
      </div>
      <span class="cabecalho__acoes"><ng-content /></span>
    </header>
    <div class="topo" [class.topo--onda]="onda() && !secao()" [class.topo--folgado]="folgado()">
      <div class="destaque"><ng-content select="[ce-destaque]" /></div>
      @if (onda() && !secao()) {
        <svg class="topo__onda" viewBox="0 0 360 24" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 24V10C60 24 120 0 180 10S300 24 360 8V24Z" />
        </svg>
      }
    </div>
  `,
  styles: `
    @use 'mixins';

    :host {
      display: contents;
    }

    // linha do cabeçalho: fundo topo do tema, texto claro (DESIGN.md §5)
    .cabecalho--topo {
      background: var(--ce-topo);
      color: var(--ce-texto-sobre-topo);
    }

    // sticky logo abaixo da barra do shell; fora do shell o padrão é 0px
    .cabecalho--fixo {
      position: sticky;
      top: var(--ce-cabecalho-topo, 0px);
      z-index: var(--ce-z-header);
    }

    // destaque e onda: fundo topo do tema e onda para o chao
    // as 2 últimas linhas já são --ce-bg: a última linha do svg, com antialiasing, mistura com o
    // fundo atrás dela e deixava uma costura cinza abaixo da onda
    .topo--onda {
      background: linear-gradient(var(--ce-topo) calc(100% - 2px), var(--ce-bg) 0);
      color: var(--ce-texto-sobre-topo);
    }

    // botões slotados leem as cores do topo, não as da superfície
    .cabecalho--topo .cabecalho__acoes {
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
      // a página fora do shell (operador) reserva a área segura do topo aqui
      padding-top: calc(var(--ce-space-4) + var(--ce-cabecalho-respiro, 0px));
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
      .cabecalho--folgado {
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
  /** Onda para o chão sob o topo (padrão do app). */
  readonly onda = input(true);
  /** Linha voltar + título + ações presa abaixo da barra do shell. Só o PDV desliga. */
  readonly fixo = input(true);
  /** Lista embutida (RH): título h2, sem topo escuro, sem onda e sem sticky. */
  readonly secao = input(false);
  /** Em ≥960px usa o padding amplo do protótipo (28px 32px 56px). */
  readonly folgado = input(false);
  /** Linha pequena acima do título (ex.: a data). */
  readonly rotulo = input<string | null>(null);
  readonly voltar = output<void>();
}
