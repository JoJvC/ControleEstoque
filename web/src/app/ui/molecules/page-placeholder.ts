import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Marcador temporário de tela ainda não implementada. Some conforme as sprints avançam. */
@Component({
  selector: 'ce-page-placeholder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="placeholder">
      <h1 class="placeholder__titulo">{{ titulo() }}</h1>
      <p class="placeholder__descricao">Em construção — chega na Sprint {{ sprint() }}.</p>
    </section>
  `,
  styles: `
    .placeholder {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
      padding: var(--ce-space-5) var(--ce-space-4);
    }

    .placeholder__titulo {
      font-size: var(--ce-font-xl);
    }

    .placeholder__descricao {
      color: var(--ce-text-muted);
    }
  `,
})
export class PagePlaceholder {
  readonly titulo = input.required<string>();
  readonly sprint = input.required<string>();
}
