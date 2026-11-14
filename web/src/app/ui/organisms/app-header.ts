import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Icon } from '../atoms/icon';

/** Cabeçalho de página: voltar (opcional) + título + slot de ações à direita. */
@Component({
  selector: 'ce-app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { '[class.app-header--onda]': 'onda()' },
  template: `
    <div class="topo" [class.topo--onda]="onda()">
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
        <h1 class="cabecalho__titulo">{{ titulo() }}</h1>
        <span class="cabecalho__acoes"><ng-content /></span>
      </header>
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

    .cabecalho__titulo {
      flex: 1;
      min-width: 0;
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
  readonly voltar = output<void>();
}
