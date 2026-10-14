import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { OperatorStore } from '../../core/operator/operator-store';

@Component({
  selector: 'ce-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="home">
      <h1 class="home__titulo">Olá, {{ primeiroNome() }}!</h1>
      <p class="home__descricao">
        O painel do dia (caixa, vendas e alertas de estoque) chega na Sprint F9.
      </p>
    </section>
  `,
  styles: `
    .home {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
      padding: var(--ce-space-5) var(--ce-space-4);
    }

    .home__titulo {
      font-size: var(--ce-font-xl);
    }

    .home__descricao {
      color: var(--ce-text-muted);
    }
  `,
})
export class HomePage {
  private readonly operatorStore = inject(OperatorStore);

  protected primeiroNome(): string {
    return this.operatorStore.operator()?.nome.split(' ')[0] ?? '';
  }
}
