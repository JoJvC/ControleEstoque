import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Button } from '../../ui/atoms/button';
import { Skeleton } from '../../ui/atoms/skeleton';
import { EmptyState } from '../../ui/molecules/empty-state';

/** Esqueleto enquanto carrega sem dados e erro com "Tentar de novo"; os dados quem desenha é a página. */
@Component({
  selector: 'ce-estado-relatorio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, EmptyState, Skeleton],
  template: `
    @if (erro()) {
      <ce-empty-state
        icone="alerta"
        titulo="Não foi possível carregar o relatório"
        [descricao]="erro() ?? ''"
      >
        <ce-button variante="ghost" (click)="recarregar.emit()">Tentar de novo</ce-button>
      </ce-empty-state>
    } @else if (carregando() && !temDados()) {
      <div class="esqueleto" aria-busy="true">
        <ce-skeleton altura="32px" />
        <ce-skeleton altura="96px" />
      </div>
    }
  `,
  styles: `
    .esqueleto {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }
  `,
})
export class EstadoRelatorio {
  readonly carregando = input(false);
  readonly erro = input<string | null>(null);
  readonly temDados = input(false);

  readonly recarregar = output<void>();
}
