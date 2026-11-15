import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { CargoResponse } from '../../core/api/models/rh';
import { ApiError } from '../../core/http/api-error';
import { CePermissao } from '../../core/permissions/ce-permissao';
import { PermissionService } from '../../core/permissions/permission-service';
import { PERMISSOES } from '../../core/permissions/permissoes';
import { Badge } from '../../ui/atoms/badge';
import { Button } from '../../ui/atoms/button';
import { Checkbox } from '../../ui/atoms/checkbox';
import { Icon } from '../../ui/atoms/icon';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { ListItem } from '../../ui/molecules/list-item';
import { AppHeader } from '../../ui/organisms/app-header';
import { BarraAcao } from '../../ui/organisms/barra-acao';
import { DataList } from '../../ui/organisms/data-list';
import { CargosStore } from './cargos-store';

@Component({
  selector: 'ce-cargos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    CePermissao,
    AppHeader,
    Badge,
    BarraAcao,
    Button,
    Checkbox,
    Icon,
    TextInput,
    FormField,
    ListItem,
    DataList,
  ],
  template: `
    <ce-app-header titulo="Cargos" />
    <div class="pagina">
      @if (!formAberto()) {
        <ce-data-list
          [itens]="store.cargos()"
          [status]="store.status()"
          vazioTitulo="Nenhum cargo"
          (recarregar)="store.carregar()"
        >
          <ng-template let-item>
            <ce-list-item [desabilitado]="item.nativo || !pode()" (click)="editar(item)">
              <span class="nome">{{ item.nome }}</span>
              @if (item.nativo) {
                <ce-badge ce-trailing>nativo</ce-badge>
              } @else if (pode()) {
                <span ce-trailing class="editar">
                  <ce-icon nome="editar" [tamanho]="18" /> Editar
                </span>
              }
            </ce-list-item>
          </ng-template>
        </ce-data-list>
        <ce-barra-acao *cePermissao="'rh.gerir'" rotulo="Novo cargo">
          <ce-button (click)="novo()">Novo cargo</ce-button>
        </ce-barra-acao>
      } @else {
        <form [formGroup]="form" (ngSubmit)="salvar()">
          <ce-form-field rotulo="Nome" [obrigatorio]="true" [erro]="erroNome()">
            <ce-input formControlName="nome" />
          </ce-form-field>
          <div formGroupName="marcadas">
            @for (p of permissoes; track p.chave) {
              <ce-checkbox [formControlName]="p.chave">{{ p.rotulo }}</ce-checkbox>
            }
          </div>
          @if (erro(); as msg) {
            <p class="erro" role="alert">{{ msg }}</p>
          }
          <div class="acoes">
            <ce-button tipo="submit" [loading]="salvando()">Salvar</ce-button>
            <ce-button variante="ghost" (click)="cancelar()">Cancelar</ce-button>
          </div>
        </form>
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

    form {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-4);
    }

    .acoes {
      display: flex;
      gap: var(--ce-space-3);
    }

    // Cartões do design Depósito: raio 18–22 px (o ce-list-item é compartilhado, o raio vale só aqui).
    :host ::ng-deep .item {
      border-radius: 20px;
    }

    // linha sem ação (nativo ou sem permissão) é informativa: mantém o contraste do texto
    :host ::ng-deep .item:disabled {
      opacity: 1;
      cursor: default;
    }

    .nome {
      font-weight: 600;
    }

    .editar {
      display: inline-flex;
      align-items: center;
      gap: var(--ce-space-1);
      color: var(--ce-acao-texto);
    }

    .erro {
      margin: 0;
      padding: var(--ce-space-3);
      border: 1px solid var(--ce-danger);
      border-radius: var(--ce-radius-controle);
      color: var(--ce-danger);
    }
  `,
})
export class CargosPage {
  protected readonly store = inject(CargosStore);
  private readonly permissions = inject(PermissionService);
  protected readonly pode = () => this.permissions.has('rh.gerir');
  protected readonly permissoes = PERMISSOES;
  protected readonly formAberto = signal(false);
  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly erroNome = signal<string | null>(null);

  protected readonly form = new FormGroup({
    nome: new FormControl('', { nonNullable: true }),
    marcadas: new FormGroup(
      Object.fromEntries(
        PERMISSOES.map((p) => [p.chave, new FormControl(false, { nonNullable: true })]),
      ),
    ),
  });

  private editandoId: string | null = null;
  /** Permissões do cargo fora do catálogo: preservadas no PUT. */
  private foraDoCatalogo: string[] = [];

  constructor() {
    void this.store.carregar();
  }

  protected novo(): void {
    this.abrir(null, '', []);
  }

  protected editar(cargo: CargoResponse): void {
    if (cargo.nativo || !this.pode()) {
      return;
    }
    this.abrir(cargo.id, cargo.nome, cargo.permissoes);
  }

  protected cancelar(): void {
    this.formAberto.set(false);
  }

  protected async salvar(): Promise<void> {
    const marcadas = this.form.controls.marcadas.getRawValue();
    if (!this.form.controls.nome.value.trim()) {
      this.erroNome.set('Informe o nome do cargo.');
      return;
    }
    this.erroNome.set(null);
    const req = {
      nome: this.form.controls.nome.value,
      permissoes: [
        ...PERMISSOES.filter((p) => marcadas[p.chave]).map((p) => p.chave),
        ...this.foraDoCatalogo,
      ],
    };
    this.erro.set(null);
    this.salvando.set(true);
    try {
      if (this.editandoId) {
        await this.store.atualizar(this.editandoId, req);
      } else {
        await this.store.criar(req);
      }
      this.formAberto.set(false);
    } catch (e) {
      this.erro.set(e instanceof ApiError ? e.userMessage : 'Não foi possível salvar o cargo.');
    } finally {
      this.salvando.set(false);
    }
  }

  private abrir(id: string | null, nome: string, permissoes: string[]): void {
    const chaves = PERMISSOES.map((p) => p.chave);
    this.editandoId = id;
    this.foraDoCatalogo = permissoes.filter((p) => !chaves.includes(p));
    this.form.reset({
      nome,
      marcadas: Object.fromEntries(chaves.map((c) => [c, permissoes.includes(c)])),
    });
    this.erro.set(null);
    this.erroNome.set(null);
    this.formAberto.set(true);
  }
}
