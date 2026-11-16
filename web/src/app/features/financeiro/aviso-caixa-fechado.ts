import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';

import { CaixaDiariasPendentes } from '../../core/api/models/financeiro';
import { Button } from '../../ui/atoms/button';
import { avisoFechadoPeloSistema } from './aviso-fechado-pelo-sistema';

/** Aviso de caixa fechado pelo sistema com diárias pendentes; some com a lista vazia. */
@Component({
  selector: 'ce-aviso-caixa-fechado',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button],
  template: `
    @if (aviso(); as a) {
      <div class="aviso" role="status">
        <p>{{ a.texto }}</p>
        <ce-button variante="ghost" (click)="ir(a.rota)">Lançar diárias</ce-button>
      </div>
    }
  `,
  styles: `
    .aviso {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--ce-space-2);
      padding: var(--ce-space-3) var(--ce-space-4);
      border-radius: 20px;
      background: var(--ce-warning-soft);
      color: var(--ce-text);
    }

    p {
      margin: 0;
    }
  `,
})
export class AvisoCaixaFechado {
  private readonly router = inject(Router);

  readonly pendentes = input<readonly CaixaDiariasPendentes[]>([]);
  protected readonly aviso = computed(() => avisoFechadoPeloSistema(this.pendentes()));

  protected ir(rota: string): void {
    void this.router.navigateByUrl(rota);
  }
}
