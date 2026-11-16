import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { CreateFuncionarioRequest } from '../../core/api/models/rh';
import { ApiError } from '../../core/http/api-error';
import { CePermissao } from '../../core/permissions/ce-permissao';
import { Badge } from '../../ui/atoms/badge';
import { Button } from '../../ui/atoms/button';
import { Icon } from '../../ui/atoms/icon';
import { ListItem } from '../../ui/molecules/list-item';
import { AppHeader } from '../../ui/organisms/app-header';
import { DataList } from '../../ui/organisms/data-list';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { iniciais } from '../operador/iniciais';
import { FuncionarioForm } from './funcionario-form';
import { FuncionariosStore } from './funcionarios-store';

@Component({
  selector: 'ce-funcionarios-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CePermissao,
    AppHeader,
    Badge,
    Button,
    Icon,
    ListItem,
    DataList,
    FuncionarioForm,
    PrecoPipe,
  ],
  template: `
    <ce-app-header
      [titulo]="formAberto() ? 'Novo funcionário' : 'Funcionários'"
      [secao]="embutido()"
      [mostrarVoltar]="!embutido() || formAberto()"
      (voltar)="voltar()"
    >
      @if (formAberto()) {
        <ce-button
          *cePermissao="'rh.gerir'"
          [disabled]="!formulario()?.valido()"
          [loading]="salvando()"
          (click)="formulario()?.enviar()"
          >Salvar</ce-button
        >
      } @else {
        <ce-button *cePermissao="'rh.gerir'" rotulo="Novo funcionário" (click)="novo()"
          >+ Novo</ce-button
        >
      }
    </ce-app-header>
    <div class="pagina">
      @if (!formAberto()) {
        <ce-data-list
          [itens]="store.funcionarios()"
          [status]="store.status()"
          vazioTitulo="Nenhum funcionário"
          (recarregar)="store.carregar()"
        >
          <ng-template let-item>
            <ce-list-item
              [attr.aria-current]="item.id === selecionadoId() ? 'true' : null"
              (click)="abrir(item.id)"
            >
              <span ce-leading class="avatar" aria-hidden="true">{{ iniciais(item.nome) }}</span>
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
      } @else {
        <ce-funcionario-form [erro]="erro()" [salvando]="salvando()" (salvar)="salvar($event)" />
      }
    </div>
  `,
  styles: `
    @use 'mixins';

    .pagina {
      padding: var(--ce-space-4);
      padding-bottom: var(--ce-space-6);
      max-width: 560px;

      @include mixins.from-tablet {
        margin-inline: auto;
        width: 100%;
      }
    }

    // Cartões do design Depósito: raio 18–22 px (o ce-list-item é compartilhado, o raio vale só aqui).
    :host ::ng-deep .item {
      border-radius: 20px;
    }

    // linha do funcionário aberto (desktop, mestre-detalhe)
    :host ::ng-deep ce-list-item[aria-current='true'] .item {
      background: var(--ce-primary-soft);
      box-shadow: inset 3px 0 0 var(--ce-primary);
    }

    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--ce-primary-soft);
      color: var(--ce-primary-strong);
      font-size: 16px;
      font-weight: 700;
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
  /** Dentro de /rh ou do detalhe: cabeçalho de seção (h2, sem topo, sem voltar). */
  readonly embutido = input(false);
  /** Funcionário aberto no detalhe (desktop): a linha leva aria-current. */
  readonly selecionadoId = input<string | null>(null);

  protected readonly iniciais = iniciais;
  protected readonly store = inject(FuncionariosStore);
  protected readonly formulario = viewChild(FuncionarioForm);
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

  /** Com o formulário aberto, voltar fecha sem salvar; senão sobe para /rh. */
  protected voltar(): void {
    if (this.formAberto()) {
      this.formAberto.set(false);
      return;
    }
    this.router.navigateByUrl('/rh');
  }

  protected novo(): void {
    this.erro.set(null);
    this.formAberto.set(true);
  }

  protected async salvar(req: CreateFuncionarioRequest): Promise<void> {
    // o submitter oculto (Enter) não fica desabilitado: barra o envio duplo
    if (this.salvando()) return;

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
