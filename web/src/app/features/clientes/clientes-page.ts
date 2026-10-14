import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { ClienteResponse } from '../../core/api/models/clientes';
import { Avatar } from '../../ui/atoms/avatar';
import { Button } from '../../ui/atoms/button';
import { Icon } from '../../ui/atoms/icon';
import { ListItem } from '../../ui/molecules/list-item';
import { SearchBox } from '../../ui/molecules/search-box';
import { AppHeader } from '../../ui/organisms/app-header';
import { DataList } from '../../ui/organisms/data-list';
import { ClientesStore } from './clientes-store';

@Component({
  selector: 'ce-clientes-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeader, Avatar, Button, Icon, ListItem, SearchBox, DataList],
  template: `
    <ce-app-header titulo="Clientes">
      <ce-button variante="ghost" (click)="novo()">
        <ce-icon nome="mais" [tamanho]="18" /> Novo
      </ce-button>
    </ce-app-header>

    <div class="filtros">
      <ce-search-box placeholder="Buscar por nome…" (buscar)="store.buscar($event)" />
    </div>

    <div class="conteudo">
      <ce-data-list
        [itens]="store.clientes()"
        [status]="store.status()"
        [temMais]="store.temMais()"
        vazioTitulo="Nenhum cliente"
        vazioDescricao="Cadastre o primeiro cliente."
        (recarregar)="store.buscar('')"
        (maisPagina)="store.carregarMais()"
      >
        <ng-template let-cliente>
          <ce-list-item (click)="abrir(cliente)">
            <ce-avatar ce-leading [nome]="cliente.nome" [tamanho]="40" />
            <span class="nome">{{ cliente.nome }}</span>
            @if (cliente.telefone) {
              <span class="telefone">{{ cliente.telefone }}</span>
            }
            <ce-icon ce-trailing nome="seta-direita" [tamanho]="18" />
          </ce-list-item>
        </ng-template>
      </ce-data-list>
    </div>
  `,
  styles: `
    .filtros {
      padding-inline: var(--ce-space-4);
    }

    .conteudo {
      padding: var(--ce-space-4);
    }

    .nome {
      font-weight: 600;
    }

    .telefone {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }
  `,
})
export class ClientesPage {
  protected readonly store = inject(ClientesStore);
  private readonly router = inject(Router);

  constructor() {
    this.store.buscar('');
  }

  protected novo(): void {
    this.router.navigateByUrl('/clientes/novo');
  }

  protected abrir(cliente: ClienteResponse): void {
    this.router.navigateByUrl(`/clientes/${cliente.id}`);
  }
}
