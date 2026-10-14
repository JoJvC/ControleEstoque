import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Icon, IconeNome } from '../atoms/icon';

@Component({
  selector: 'ce-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <div class="vazio">
      <ce-icon [nome]="icone()" [tamanho]="40" class="vazio__icone" />
      <p class="vazio__titulo">{{ titulo() }}</p>
      @if (descricao()) {
        <p class="vazio__descricao">{{ descricao() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: `
    .vazio {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--ce-space-2);
      padding: var(--ce-space-8) var(--ce-space-4);
      text-align: center;
      color: var(--ce-text-muted);
    }

    .vazio__titulo {
      font-size: var(--ce-font-lg);
      font-weight: 600;
      color: var(--ce-text);
    }
  `,
})
export class EmptyState {
  readonly icone = input<IconeNome>('caixa');
  readonly titulo = input.required<string>();
  readonly descricao = input('');
}
