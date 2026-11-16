import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { Button } from '../../ui/atoms/button';
import { AppHeader } from '../../ui/organisms/app-header';
import { DataList } from '../../ui/organisms/data-list';
import { rotuloDoFrete } from './abastecimento-linhas';
import { AbastecimentoStore } from './abastecimento-store';

/** Cargas com custo pendente; a rota exige `estoque.custos`. */
@Component({
  selector: 'ce-abastecimento-pendentes-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, AppHeader, Button, DataList],
  template: `
    <ce-app-header titulo="Custos pendentes" [mostrarVoltar]="true" (voltar)="voltar()" />

    <div class="conteudo">
      <ce-data-list
        [itens]="store.pendentes()"
        [status]="store.statusPendentes()"
        vazioTitulo="Nenhuma carga com custo pendente"
        (recarregar)="store.carregarPendentes()"
      >
        <ng-template let-carga>
          <div class="carga">
            <div class="carga__info">
              <b>{{ carga.data | date: 'dd/MM/yyyy' }}</b>
              <span class="carga__meta">
                {{ rotuloDoFrete(carga.tipoFrete) }} · {{ carga.totalUnidades }} un
              </span>
              <span class="carga__meta">
                {{ carga.linhasSemCusto }}
                {{ carga.linhasSemCusto === 1 ? 'linha sem custo' : 'linhas sem custo' }}
                @if (carga.freteFaltando) {
                  · frete faltando
                }
              </span>
            </div>
            <ce-button variante="ghost" (click)="completar(carga.id)">Completar custo</ce-button>
          </div>
        </ng-template>
      </ce-data-list>
    </div>
  `,
  styles: `
    .conteudo {
      padding: 0 var(--ce-space-4) var(--ce-space-6);
    }

    .carga {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ce-space-3);
      padding: var(--ce-space-3);
      border: 1px solid var(--ce-border);
      border-radius: 16px;
      background: var(--ce-surface);
    }

    .carga__info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .carga__meta {
      color: var(--ce-text-muted);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class AbastecimentoPendentesPage {
  protected readonly store = inject(AbastecimentoStore);
  private readonly router = inject(Router);

  constructor() {
    void this.store.carregarPendentes();
  }

  protected readonly rotuloDoFrete = rotuloDoFrete;

  protected completar(id: string): void {
    this.router.navigateByUrl(`/estoque/abastecimento/${id}/custos`);
  }

  protected voltar(): void {
    this.router.navigateByUrl('/estoque');
  }
}
