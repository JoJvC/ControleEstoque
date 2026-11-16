import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { TipoCascoResponse } from '../../core/api/models/estoque';
import { ApiError } from '../../core/http/api-error';
import { Button } from '../../ui/atoms/button';
import { Checkbox } from '../../ui/atoms/checkbox';
import { Icon } from '../../ui/atoms/icon';
import { Select, SelectOpcao } from '../../ui/atoms/select';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { ListItem } from '../../ui/molecules/list-item';
import { MoneyInput } from '../../ui/molecules/money-input';
import { AppHeader } from '../../ui/organisms/app-header';
import { DataList } from '../../ui/organisms/data-list';
import { MarcasStore } from './marcas-store';
import { TiposCascoStore } from './tipos-casco-store';

@Component({
  selector: 'ce-tipos-casco-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
    AppHeader,
    Button,
    Checkbox,
    Icon,
    Select,
    TextInput,
    FormField,
    ListItem,
    MoneyInput,
    DataList,
  ],
  template: `
    <ce-app-header [titulo]="tituloPagina()" [mostrarVoltar]="true" (voltar)="voltar()">
      @if (formAberto()) {
        <ce-button [loading]="salvando()" (click)="salvar()">Salvar</ce-button>
      } @else {
        <ce-button rotulo="Novo tipo de casco" (click)="novo()">+ Novo</ce-button>
      }
    </ce-app-header>
    <div class="pagina">
      @if (!formAberto()) {
        <section class="cartao">
          <ce-data-list
            [itens]="store.tipos()"
            [status]="store.status()"
            vazioTitulo="Nenhum tipo de casco"
            vazioDescricao="Cadastre o primeiro tipo de casco."
            (recarregar)="store.carregar()"
          >
            <ng-template let-item>
              <ce-list-item (click)="editar(item)">
                <span ce-leading class="icone-tipo"><ce-icon nome="casco" [tamanho]="20" /></span>
                <span class="meio">
                  <span class="nome">{{ item.nome }}</span>
                  <span class="detalhe">{{
                    item.marca ? 'específico · ' + item.marca : 'genérico'
                  }}</span>
                </span>
                <span ce-trailing class="direita">
                  <span class="preco">{{ item.precoVasilhame | currency: 'BRL' }}</span>
                  @if (item.aceitaSucata) {
                    <span class="chip-sucata"
                      ><ce-icon nome="sucata" [tamanho]="16" /> aceita sucata</span
                    >
                  }
                </span>
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
          <ce-form-field rotulo="Preço do vasilhame">
            <ce-money-input rotulo="Preço do vasilhame" formControlName="precoVasilhame" />
          </ce-form-field>
          <ce-checkbox formControlName="aceitaSucata">Aceita sucata</ce-checkbox>
          <ce-form-field rotulo="Marca (casco específico)">
            <ce-select
              rotulo="Marca (casco específico)"
              [opcoes]="opcoesMarca()"
              formControlName="marcaId"
            />
          </ce-form-field>
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
      padding: 0 var(--ce-space-4) var(--ce-space-6);
      max-width: 560px;
    }

    form {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-4);
    }

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

    .icone-tipo {
      display: inline-grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      background: var(--ce-casco-soft);
      color: var(--ce-casco);
    }

    .meio {
      display: flex;
      flex-direction: column;
    }

    .nome {
      font-weight: 600;
    }

    .detalhe {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    .direita {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--ce-space-1);
    }

    .preco {
      @include mixins.tabular-numbers;

      font-size: var(--ce-font-lg);
      font-weight: 700;
      color: var(--ce-text);
    }

    .chip-sucata {
      display: inline-flex;
      align-items: center;
      gap: var(--ce-space-1);
      padding: 2px var(--ce-space-2);
      border-radius: 999px;
      background: var(--ce-sucata-soft);
      color: var(--ce-sucata);
      font-size: var(--ce-font-sm);
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
export class TiposCascoPage {
  protected readonly store = inject(TiposCascoStore);
  private readonly marcas = inject(MarcasStore);
  private readonly router = inject(Router);

  protected readonly formAberto = signal(false);
  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly erroNome = signal<string | null>(null);

  protected readonly form = new FormGroup({
    nome: new FormControl('', { nonNullable: true }),
    precoVasilhame: new FormControl<number | null>(0),
    aceitaSucata: new FormControl(false, { nonNullable: true }),
    marcaId: new FormControl<string | null>(null),
  });

  /** Marca do item em edição que não veio em marcas(): mantida para não perdê-la ao salvar. */
  private readonly marcaExtra = signal<SelectOpcao | null>(null);
  private editandoId: string | null = null;

  protected readonly opcoesMarca = computed<SelectOpcao[]>(() => {
    const marcas = this.marcas.marcas().map((m) => ({ value: m.id, label: m.nome }));
    const extra = this.marcaExtra();
    if (extra && !marcas.some((m) => m.value === extra.value)) {
      marcas.push(extra);
    }
    return [{ value: '', label: 'Nenhuma — casco genérico' }, ...marcas];
  });

  constructor() {
    void this.store.carregar();
    this.marcas.carregar();
  }

  protected novo(): void {
    this.abrir(null, null, '', 0, false, null);
  }

  protected editar(t: TipoCascoResponse): void {
    this.abrir(
      t.id,
      t.marcaId ? { value: t.marcaId, label: t.marca ?? t.marcaId } : null,
      t.nome,
      t.precoVasilhame,
      t.aceitaSucata,
      t.marcaId,
    );
  }

  protected cancelar(): void {
    this.formAberto.set(false);
  }

  /** Com o formulário aberto, voltar fecha sem salvar; senão sai para o Mais. */
  protected voltar(): void {
    if (this.formAberto()) {
      this.cancelar();
      return;
    }
    this.router.navigateByUrl('/mais');
  }

  protected tituloPagina(): string {
    if (!this.formAberto()) return 'Tipos de casco';
    return this.editandoId ? 'Editar tipo de casco' : 'Novo tipo de casco';
  }

  protected async salvar(): Promise<void> {
    // o submitter oculto (Enter) não fica desabilitado: barra o envio duplo
    if (this.salvando()) return;

    const v = this.form.getRawValue();
    const nome = v.nome.trim();
    if (!nome) {
      this.erroNome.set('Informe o nome do tipo de casco.');
      return;
    }
    this.erroNome.set(null);
    const req = {
      nome,
      marcaId: v.marcaId,
      precoVasilhame: v.precoVasilhame ?? 0,
      aceitaSucata: v.aceitaSucata,
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
      this.erro.set(
        e instanceof ApiError ? e.userMessage : 'Não foi possível salvar o tipo de casco.',
      );
    } finally {
      this.salvando.set(false);
    }
  }

  private abrir(
    id: string | null,
    extra: SelectOpcao | null,
    nome: string,
    precoVasilhame: number,
    aceitaSucata: boolean,
    marcaId: string | null,
  ): void {
    this.editandoId = id;
    this.marcaExtra.set(extra);
    this.form.reset({ nome, precoVasilhame, aceitaSucata, marcaId });
    this.erro.set(null);
    this.erroNome.set(null);
    this.formAberto.set(true);
  }
}
