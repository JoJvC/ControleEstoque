import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Linha tocável de lista. Slots: [ce-leading], conteúdo padrão e [ce-trailing].
 * O clique nativo borbulha — a página escuta (click) no elemento.
 */
@Component({
  selector: 'ce-list-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="item" [disabled]="desabilitado()">
      <span class="item__leading"><ng-content select="[ce-leading]" /></span>
      <span class="item__conteudo"><ng-content /></span>
      <span class="item__trailing"><ng-content select="[ce-trailing]" /></span>
    </button>
  `,
  styles: `
    @use 'mixins';

    :host {
      display: block;
    }

    .item {
      @include mixins.touch-target;

      width: 100%;
      display: flex;
      align-items: center;
      gap: var(--ce-space-3);
      padding: var(--ce-space-3) var(--ce-space-4);
      background: var(--ce-surface);
      border: 1px solid var(--ce-border);
      border-radius: var(--ce-radius-md);
      text-align: left;
      font-size: var(--ce-font-md);

      &:not(:disabled):active {
        background: var(--ce-primary-soft);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .item__leading:empty,
    .item__trailing:empty {
      display: none;
    }

    .item__conteudo {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .item__trailing {
      display: inline-flex;
      align-items: center;
      gap: var(--ce-space-2);
      color: var(--ce-text-muted);
    }
  `,
})
export class ListItem {
  readonly desabilitado = input(false);
}
