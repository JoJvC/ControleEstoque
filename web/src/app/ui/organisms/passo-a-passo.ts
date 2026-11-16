import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Button } from '../atoms/button';

/** Texto do trilho: 'N de T · rótulo' (N a partir de 1). */
export function textoDoTrilho(passos: readonly string[], atual: number): string {
  return `${atual + 1} de ${passos.length} · ${passos[atual] ?? ''}`;
}

/**
 * Moldura de passo a passo: trilho 'N de T' no topo, o conteúdo do passo projetado e a barra inferior
 * (resumo opcional com `[resumo]`, Voltar, Continuar ou o botão final). Não guarda estado do passo: quem
 * usa dono do índice `atual` e dos dados, por isso voltar e avançar não perde nada.
 */
@Component({
  selector: 'ce-passo-a-passo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  template: `
    <p class="trilho" data-testid="passo-trilho">{{ trilho() }}</p>
    <div class="conteudo">
      <ng-content />
    </div>
    <div class="barra">
      <div class="barra__resumo">
        <ng-content select="[resumo]" />
      </div>
      @if (atual() > 0) {
        <ce-button variante="claro" data-testid="passo-voltar" (click)="voltar.emit()">
          Voltar
        </ce-button>
      }
      @if (ultimo()) {
        <ce-button
          data-testid="confirmar-venda"
          [loading]="carregando()"
          [disabled]="!podeAvancar()"
          (click)="podeAvancar() && concluir.emit()"
        >
          {{ rotuloFinal() }}
        </ce-button>
      } @else {
        <ce-button
          data-testid="passo-continuar"
          [disabled]="!podeAvancar()"
          (click)="podeAvancar() && avancar.emit()"
        >
          Continuar
        </ce-button>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .trilho {
      margin-bottom: var(--ce-space-3);
      font-size: var(--ce-font-sm);
      font-weight: 700;
      color: var(--ce-text-muted);
    }

    .conteudo {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    // barra fixa do celular, acima da bottom-nav
    .barra {
      position: sticky;
      bottom: calc(var(--ce-nav-height) + env(safe-area-inset-bottom, 0px));
      display: flex;
      align-items: center;
      gap: var(--ce-space-2);
      margin-top: var(--ce-space-3);
      padding: var(--ce-space-2) var(--ce-space-2) var(--ce-space-2) var(--ce-space-4);
      border-radius: 20px;
      background: var(--ce-topo);
      color: var(--ce-texto-sobre-topo);
    }

    .barra__resumo {
      flex: 1;
      display: flex;
      flex-direction: column;
      font-weight: 700;
    }
  `,
})
export class PassoAPasso {
  readonly passos = input.required<readonly string[]>();
  readonly atual = input.required<number>();
  readonly podeAvancar = input(true);
  /** Texto do botão do último passo. */
  readonly rotuloFinal = input('Confirmar');
  readonly carregando = input(false);

  readonly voltar = output<void>();
  readonly avancar = output<void>();
  readonly concluir = output<void>();

  protected readonly trilho = computed(() => textoDoTrilho(this.passos(), this.atual()));
  protected readonly ultimo = computed(() => this.atual() >= this.passos().length - 1);
}
