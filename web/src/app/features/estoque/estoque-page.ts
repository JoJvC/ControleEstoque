import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { EstoqueItemResponse } from '../../core/api/models/estoque';
import { SheetService } from '../../core/overlay/sheet-service';
import { ToastService } from '../../core/toast/toast-service';
import { Badge } from '../../ui/atoms/badge';
import { Button } from '../../ui/atoms/button';
import { Icon } from '../../ui/atoms/icon';
import { ListItem } from '../../ui/molecules/list-item';
import { AppHeader } from '../../ui/organisms/app-header';
import { DataList } from '../../ui/organisms/data-list';
import { AjusteSheet, AjusteSheetDados } from './ajuste-sheet';
import { BaixaCascoSheet } from './baixa-casco-sheet';
import { EstoqueStore } from './estoque-store';

const TIPO_LABEL: Record<string, string> = {
  AGUA: 'Água',
  GALAO_COMPLETO: 'Galão completo',
  CASCO: 'Casco',
  SUCATA: 'Sucata',
  DESCARTAVEL: 'Descartável',
};

@Component({
  selector: 'ce-estoque-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeader, Badge, Button, Icon, ListItem, DataList],
  template: `
    <ce-app-header titulo="Estoque" [mostrarVoltar]="true" (voltar)="voltarParaMais()" />

    <div class="conteudo">
      <ce-data-list
        [itens]="store.itens()"
        [status]="store.status()"
        vazioTitulo="Estoque vazio"
        vazioDescricao="Registre um abastecimento para começar."
        (recarregar)="store.carregar()"
      >
        <ng-template let-item>
          <ce-list-item (click)="ajustar(item)">
            <span class="nome">{{ item.nome }}</span>
            <span class="detalhe">{{ detalheDe(item) }}</span>
            @if (item.abaixoMinimo) {
              <ce-badge cor="warning">
                <ce-icon nome="alerta" [tamanho]="14" /> abaixo do mínimo ({{ item.estoqueMinimo }})
              </ce-badge>
            }
            <span ce-trailing class="quantidade" [class.quantidade--alerta]="item.abaixoMinimo">{{
              item.quantidade
            }}</span>
          </ce-list-item>
        </ng-template>
      </ce-data-list>
    </div>

    <div class="acoes">
      <ce-button [block]="true" (click)="abastecer()">
        <ce-icon nome="caixa" [tamanho]="18" /> Abastecer
      </ce-button>
      <ce-button variante="ghost" (click)="baixaCasco()">Baixa de casco</ce-button>
    </div>
  `,
  styles: `
    @use 'mixins';

    .conteudo {
      padding: var(--ce-space-4);
    }

    .nome {
      font-weight: 600;
    }

    .detalhe {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    ce-badge {
      margin-top: var(--ce-space-1);
      align-self: flex-start;
    }

    .quantidade {
      @include mixins.tabular-numbers;

      font-size: var(--ce-font-xl);
      font-weight: 700;
      color: var(--ce-text);
    }

    .quantidade--alerta {
      color: var(--ce-warning);
    }

    // Ações primárias ao alcance do polegar: gruda logo acima da bottom-nav (plano §4.3)
    .acoes {
      position: sticky;
      bottom: calc(var(--ce-nav-height) + env(safe-area-inset-bottom, 0px));
      display: flex;
      gap: var(--ce-space-3);
      padding: var(--ce-space-3) var(--ce-space-4);
      background: var(--ce-bg);
      border-top: 1px solid var(--ce-border);

      @include mixins.from-desktop {
        bottom: 0;
      }
    }
  `,
})
export class EstoquePage {
  protected readonly store = inject(EstoqueStore);
  private readonly sheet = inject(SheetService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  constructor() {
    this.store.carregar();
  }

  protected detalheDe(item: EstoqueItemResponse): string {
    return [TIPO_LABEL[item.tipo] ?? item.tipo, item.marca, item.tamanho, item.categoria]
      .filter((parte): parte is string => !!parte)
      .join(' · ');
  }

  protected async ajustar(item: EstoqueItemResponse): Promise<void> {
    const ref = this.sheet.abrir<boolean, AjusteSheetDados>(AjusteSheet, { item });
    if (await firstValueFrom(ref.closed)) {
      this.toast.success('Ajuste registrado!');
    }
  }

  protected async baixaCasco(): Promise<void> {
    const ref = this.sheet.abrir<boolean>(BaixaCascoSheet);
    if (await firstValueFrom(ref.closed)) {
      this.toast.success('Baixa registrada — os cascos entraram no estoque de sucata.');
    }
  }

  protected abastecer(): void {
    this.router.navigateByUrl('/estoque/abastecimento');
  }

  protected voltarParaMais(): void {
    this.router.navigateByUrl('/mais');
  }
}
