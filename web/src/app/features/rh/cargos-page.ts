import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { CargoResponse } from '../../core/api/models/rh';
import { ApiError } from '../../core/http/api-error';
import { CePermissao } from '../../core/permissions/ce-permissao';
import { PermissionService } from '../../core/permissions/permission-service';
import { PERMISSAO_TODAS, PERMISSOES } from '../../core/permissions/permissoes';
import { Badge } from '../../ui/atoms/badge';
import { Button } from '../../ui/atoms/button';
import { Checkbox } from '../../ui/atoms/checkbox';
import { Icon } from '../../ui/atoms/icon';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { ListItem } from '../../ui/molecules/list-item';
import { AppHeader } from '../../ui/organisms/app-header';
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
    Button,
    Checkbox,
    Icon,
    TextInput,
    FormField,
    ListItem,
    DataList,
  ],
  template: `
    <ce-app-header
      [titulo]="tituloPagina()"
      [secao]="embutido()"
      [mostrarVoltar]="!embutido() || formAberto()"
      (voltar)="voltar()"
    >
      @if (formAberto()) {
        <ce-button *cePermissao="'rh.gerir'" [loading]="salvando()" (click)="salvar()"
          >Salvar</ce-button
        >
      } @else {
        <ce-button *cePermissao="'rh.gerir'" rotulo="Novo cargo" (click)="novo()">+ Novo</ce-button>
      }
    </ce-app-header>
    <div class="pagina">
      @if (!formAberto()) {
        <section class="cartao">
          <ce-data-list
            [itens]="store.cargos()"
            [status]="store.status()"
            vazioTitulo="Nenhum cargo"
            (recarregar)="store.carregar()"
          >
            <ng-template let-item>
              <ce-list-item [desabilitado]="item.nativo || !pode()" (click)="editar(item)">
                <span ce-leading class="icone-tipo">
                  <ce-icon [nome]="item.nativo ? 'cadeado' : 'rh'" [tamanho]="20" />
                </span>
                <span class="nome">{{ item.nome }}</span>
                <span class="perms">{{ permissoesDe(item) }}</span>
                @if (item.nativo) {
                  <ce-badge ce-trailing cor="primary">nativo</ce-badge>
                } @else if (pode()) {
                  <span ce-trailing class="editar">
                    <ce-icon nome="editar" [tamanho]="18" /> Editar
                  </span>
                }
              </ce-list-item>
            </ng-template>
          </ce-data-list>
        </section>
      } @else {
        <form [formGroup]="form" (ngSubmit)="salvar()">
          <button
            type="submit"
            hidden
            aria-hidden="true"
            tabindex="-1"
            [disabled]="salvando()"
          ></button>
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
        </form>
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

    form {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-4);
    }

    // Seção "Cargos" num cartão só (protótipo): as linhas viram .li separadas por filete,
    // sem o cartão próprio do ce-list-item (compartilhado, o ajuste vale só aqui).
    .cartao {
      background: var(--ce-surface);
      border: 1px solid var(--ce-border);
      border-radius: 20px;
      padding: var(--ce-space-4);
    }

    :host ::ng-deep .item {
      border: 0;
      border-radius: 0;
      background: transparent;
      padding-inline: var(--ce-space-1);
    }

    :host ::ng-deep li:not(:last-child) {
      border-bottom: 1px solid var(--ce-border);
    }

    :host ::ng-deep .lista {
      gap: 0;
    }

    // linha sem ação (nativo ou sem permissão) é informativa: mantém o contraste do texto
    :host ::ng-deep .item:disabled {
      opacity: 1;
      cursor: default;
    }

    .nome {
      font-weight: 600;
    }

    .icone-tipo {
      display: inline-grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: var(--ce-primary-soft);
      color: var(--ce-acao-texto);
    }

    .perms {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
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
  /** Dentro de /rh: cabeçalho de seção (h2, sem topo, sem voltar). */
  readonly embutido = input(false);

  protected readonly store = inject(CargosStore);
  private readonly permissions = inject(PermissionService);
  private readonly router = inject(Router);
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

  protected permissoesDe(cargo: CargoResponse): string {
    const rotulos = cargo.permissoes.map((c) =>
      c === PERMISSAO_TODAS
        ? 'Todas as permissões'
        : (PERMISSOES.find((p) => p.chave === c)?.rotulo ?? c),
    );
    return rotulos.length ? rotulos.join(', ') : 'Sem permissões';
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

  /** Com o formulário aberto, voltar fecha sem salvar; senão sobe para /rh. */
  protected voltar(): void {
    if (this.formAberto()) {
      this.cancelar();
      return;
    }
    this.router.navigateByUrl('/rh');
  }

  protected tituloPagina(): string {
    if (!this.formAberto()) return 'Cargos';
    return this.editandoId ? 'Editar cargo' : 'Novo cargo';
  }

  protected async salvar(): Promise<void> {
    // o submitter oculto (Enter) não fica desabilitado: barra o envio duplo
    if (this.salvando()) return;

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
