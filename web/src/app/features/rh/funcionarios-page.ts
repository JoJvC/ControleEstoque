import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { CreateFuncionarioRequest } from '../../core/api/models/rh';
import { ApiError } from '../../core/http/api-error';
import { CePermissao } from '../../core/permissions/ce-permissao';
import { Avatar } from '../../ui/atoms/avatar';
import { Badge } from '../../ui/atoms/badge';
import { Button } from '../../ui/atoms/button';
import { Icon } from '../../ui/atoms/icon';
import { ListItem } from '../../ui/molecules/list-item';
import { AppHeader } from '../../ui/organisms/app-header';
import { BarraAcao } from '../../ui/organisms/barra-acao';
import { DataList } from '../../ui/organisms/data-list';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { FuncionarioForm } from './funcionario-form';
import { FuncionariosStore } from './funcionarios-store';

@Component({
  selector: 'ce-funcionarios-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CePermissao,
    AppHeader,
    Avatar,
    Badge,
    BarraAcao,
    Button,
    Icon,
    ListItem,
    DataList,
    FuncionarioForm,
    PrecoPipe,
  ],
  template: `
    <ce-app-header titulo="Funcionários" />
    <div class="pagina">
      @if (!formAberto()) {
        <ce-data-list
          [itens]="store.funcionarios()"
          [status]="store.status()"
          vazioTitulo="Nenhum funcionário"
          (recarregar)="store.carregar()"
        >
          <ng-template let-item>
            <ce-list-item (click)="abrir(item.id)">
              <ce-avatar ce-leading [nome]="item.nome" [tamanho]="40" />
              <span class="nome">{{ item.nome }}</span>
              <span class="meta">
                {{ item.cargo }} ·
                @if (item.valorDiaria > 0) {
                  {{ item.valorDiaria | cePreco }}
                } @else {
                  Sem diária
                }
              </span>
              <ce-badge ce-trailing [cor]="item.ativo ? 'success' : 'neutral'">
                {{ item.ativo ? 'Ativo' : 'Inativo' }}
              </ce-badge>
              <ce-icon ce-trailing nome="seta-direita" [tamanho]="18" />
            </ce-list-item>
          </ng-template>
        </ce-data-list>
        <ce-barra-acao *cePermissao="'rh.gerir'" rotulo="Novo funcionário">
          <ce-button (click)="novo()">Novo funcionário</ce-button>
        </ce-barra-acao>
      } @else {
        <ce-funcionario-form [salvando]="salvando()" [erro]="erro()" (salvar)="salvar($event)">
          <ce-button variante="ghost" (click)="formAberto.set(false)">Cancelar</ce-button>
        </ce-funcionario-form>
      }
    </div>
  `,
  styles: `
    @use 'mixins';

    .pagina {
      padding: var(--ce-space-4);
      padding-bottom: calc(var(--ce-barra-acao-height) + var(--ce-nav-height) + var(--ce-space-6));
      max-width: 560px;

      @include mixins.from-tablet {
        margin-inline: auto;
        width: 100%;
      }

      @include mixins.from-desktop {
        padding-bottom: calc(var(--ce-barra-acao-height) + var(--ce-space-6));
      }
    }

    // Cartões do design Depósito: raio 18–22 px (o ce-list-item é compartilhado, o raio vale só aqui).
    :host ::ng-deep .item {
      border-radius: 20px;
    }

    .nome {
      font-weight: 600;
    }

    .meta {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);

      @include mixins.tabular-numbers;
    }
  `,
})
export class FuncionariosPage {
  protected readonly store = inject(FuncionariosStore);
  protected readonly formAberto = signal(false);
  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);
  private readonly router = inject(Router);

  constructor() {
    void this.store.carregar();
  }

  protected abrir(id: string): void {
    this.router.navigateByUrl(`/rh/funcionarios/${id}`);
  }

  protected novo(): void {
    this.erro.set(null);
    this.formAberto.set(true);
  }

  protected async salvar(req: CreateFuncionarioRequest): Promise<void> {
    this.erro.set(null);
    this.salvando.set(true);
    try {
      await this.store.criar(req);
      this.formAberto.set(false);
    } catch (e) {
      this.erro.set(
        e instanceof ApiError ? e.userMessage : 'Não foi possível salvar o funcionário.',
      );
    } finally {
      this.salvando.set(false);
    }
  }
}
