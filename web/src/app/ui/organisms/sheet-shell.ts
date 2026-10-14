import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Icon } from '../atoms/icon';

/**
 * Casca visual de um sheet/dialog (título + fechar + conteúdo).
 * Usada DENTRO dos componentes abertos pelo SheetService (core/overlay).
 */
@Component({
  selector: 'ce-sheet-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <section class="sheet">
      <header class="sheet__cabecalho">
        <h2 class="sheet__titulo">{{ titulo() }}</h2>
        <button type="button" class="sheet__fechar" aria-label="Fechar" (click)="fechar.emit()">
          <ce-icon nome="fechar" />
        </button>
      </header>
      <div class="sheet__conteudo">
        <ng-content />
      </div>
    </section>
  `,
  styles: `
    @use 'mixins';

    .sheet {
      @include mixins.safe-area-bottom(var(--ce-space-4));

      display: flex;
      flex-direction: column;
      background: var(--ce-surface);
      border-radius: var(--ce-radius-lg) var(--ce-radius-lg) 0 0;
      max-height: 85dvh;

      @include mixins.from-tablet {
        border-radius: var(--ce-radius-lg);
        max-height: 80dvh;
      }
    }

    .sheet__cabecalho {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ce-space-2);
      padding: var(--ce-space-4) var(--ce-space-4) var(--ce-space-2);
    }

    .sheet__titulo {
      font-size: var(--ce-font-lg);
    }

    .sheet__fechar {
      @include mixins.touch-target;

      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--ce-text-muted);
    }

    .sheet__conteudo {
      overflow-y: auto;
      padding: var(--ce-space-2) var(--ce-space-4) var(--ce-space-4);
    }
  `,
})
export class SheetShell {
  readonly titulo = input.required<string>();
  readonly fechar = output<void>();
}
