import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CreateFuncionarioRequest } from '../../core/api/models/rh';
import { ApiError } from '../../core/http/api-error';
import { CePermissao } from '../../core/permissions/ce-permissao';
import { Badge } from '../../ui/atoms/badge';
import { Button } from '../../ui/atoms/button';
import { DataList } from '../../ui/organisms/data-list';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { FuncionarioForm } from './funcionario-form';
import { FuncionariosStore } from './funcionarios-store';

@Component({
  selector: 'ce-funcionarios-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CePermissao, Badge, Button, DataList, FuncionarioForm, PrecoPipe],
  template: `
    <div class="pagina">
      <h1>Funcionários</h1>
      @if (!formAberto()) {
        <ce-button *cePermissao="'rh.gerir'" (click)="novo()">Novo funcionário</ce-button>
        <ce-data-list
          [itens]="store.funcionarios()"
          [status]="store.status()"
          vazioTitulo="Nenhum funcionário"
          (recarregar)="store.carregar()"
        >
          <ng-template let-item>
            <a class="linha" [routerLink]="['/rh/funcionarios', item.id]">
              <span class="linha__dados">
                <span>{{ item.nome }}</span>
                <span class="linha__meta">
                  {{ item.cargo }} ·
                  @if (item.valorDiaria > 0) {
                    {{ item.valorDiaria | cePreco }}
                  } @else {
                    Sem diária
                  }
                </span>
              </span>
              <ce-badge [cor]="item.ativo ? 'success' : 'neutral'">
                {{ item.ativo ? 'Ativo' : 'Inativo' }}
              </ce-badge>
            </a>
          </ng-template>
        </ce-data-list>
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
      padding-inline: var(--ce-space-4);
      max-width: 560px;

      @include mixins.from-tablet {
        margin-inline: auto;
        width: 100%;
      }
    }

    .linha {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ce-space-3);
      color: inherit;
      text-decoration: none;
    }

    .linha__dados {
      display: flex;
      flex-direction: column;
    }

    .linha__meta {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }
  `,
})
export class FuncionariosPage {
  protected readonly store = inject(FuncionariosStore);
  protected readonly formAberto = signal(false);
  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    void this.store.carregar();
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
