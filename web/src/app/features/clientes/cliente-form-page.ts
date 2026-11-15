import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Observable, firstValueFrom, of } from 'rxjs';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { ClientesApi } from '../../core/api/clientes-api';
import { CreateEnderecoRequest, EnderecoResponse } from '../../core/api/models/clientes';
import { ApiError } from '../../core/http/api-error';
import { SheetService } from '../../core/overlay/sheet-service';
import { ToastService } from '../../core/toast/toast-service';
import { Button } from '../../ui/atoms/button';
import { Icon } from '../../ui/atoms/icon';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { AppHeader } from '../../ui/organisms/app-header';
import { BarraAcao } from '../../ui/organisms/barra-acao';
import { ClientesStore } from './clientes-store';
import { EnderecoSheet, EnderecoSheetDados } from './endereco-sheet';
import {
  RascunhoEndereco,
  adicionar,
  dadosDe,
  editar,
  marcarPrincipal,
  remover,
} from './enderecos-regras';

@Component({
  selector: 'ce-cliente-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, AppHeader, BarraAcao, Button, Icon, TextInput, FormField],
  template: `
    <ce-app-header
      [titulo]="id() === null ? 'Novo cliente' : 'Editar cliente'"
      [mostrarVoltar]="true"
      (voltar)="voltar()"
    />

    <form class="form" (submit)="$event.preventDefault(); salvar()">
      <ce-form-field rotulo="Nome" [obrigatorio]="true">
        <ce-input placeholder="Ex.: Maria Silva" [formControl]="nome" autocomplete="name" />
      </ce-form-field>

      <ce-form-field rotulo="Telefone">
        <ce-input
          tipo="tel"
          placeholder="(00) 90000-0000"
          [formControl]="telefone"
          inputmode="tel"
        />
      </ce-form-field>

      <ce-form-field rotulo="Observações" dica="Acordos de preço, referências…">
        <ce-input placeholder="Opcional" [formControl]="observacoes" />
      </ce-form-field>

      <section class="enderecos" aria-labelledby="enderecos-titulo">
        <div class="enderecos__cabecalho">
          <h2 id="enderecos-titulo" class="enderecos__titulo">Endereços</h2>
          <ce-button variante="ghost" (click)="novoEndereco()">
            <ce-icon nome="mais" [tamanho]="18" /> Adicionar
          </ce-button>
        </div>

        @if (enderecos().length === 0 && falhos().length === 0) {
          <p class="enderecos__vazio">Nenhum endereço cadastrado.</p>
        }
        <ul class="enderecos__lista">
          @for (e of enderecos(); track e.chave) {
            <li class="endereco">
              <span class="endereco__linha">
                {{ e.logradouro }}{{ e.numero ? ', ' + e.numero : '' }}
                @if (e.principal) {
                  <span class="endereco__principal">principal</span>
                }
              </span>
              @if (e.bairro || e.complemento) {
                <span class="endereco__extra">{{ [e.bairro, e.complemento].join(' · ') }}</span>
              }
              @if (e.referencia) {
                <span class="endereco__extra">Ref.: {{ e.referencia }}</span>
              }
              <span class="endereco__acoes">
                @if (!e.principal) {
                  <ce-button variante="ghost" (click)="tornarPrincipal(e)">
                    Marcar principal
                  </ce-button>
                }
                <ce-button variante="ghost" (click)="editarEndereco(e)">
                  <ce-icon nome="editar" [tamanho]="18" /> Editar
                </ce-button>
                <ce-button variante="ghost" (click)="removerEndereco(e)">
                  <ce-icon nome="lixeira" [tamanho]="18" /> Remover
                </ce-button>
              </span>
            </li>
          }
        </ul>

        @if (falhos().length > 0) {
          <div class="falhos" role="alert">
            <p class="falhos__titulo">Estes endereços não foram salvos:</p>
            <ul class="enderecos__lista">
              @for (e of falhos(); track e.chave) {
                <li class="endereco">
                  <span class="endereco__linha">
                    {{ e.logradouro }}{{ e.numero ? ', ' + e.numero : '' }}
                  </span>
                </li>
              }
            </ul>
            <ce-button variante="ghost" [loading]="tentando()" (click)="tentarDeNovo()">
              Tentar de novo
            </ce-button>
          </div>
        }

        @if (erroEnderecos(); as mensagem) {
          <p class="form__erro" role="alert">{{ mensagem }}</p>
        }
      </section>

      @if (erro(); as mensagem) {
        <p class="form__erro" role="alert">{{ mensagem }}</p>
      }

      <ce-barra-acao rotulo="Salvar cliente">
        <ce-button tipo="submit" [block]="true" [loading]="salvando()">
          {{ id() === null ? 'Cadastrar cliente' : 'Salvar alterações' }}
        </ce-button>
      </ce-barra-acao>
    </form>
  `,
  styles: `
    @use 'mixins';

    .form {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-4);
      padding-inline: var(--ce-space-4);
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

    .enderecos {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
      padding: var(--ce-space-4);
      background: var(--ce-surface);
      border: 1px solid var(--ce-border);
      border-radius: 20px;
    }

    .enderecos__cabecalho {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .enderecos__titulo {
      font-size: var(--ce-font-md);
      font-weight: 700;
      color: var(--ce-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .enderecos__vazio {
      color: var(--ce-text-muted);
      font-size: var(--ce-font-sm);
    }

    .enderecos__lista {
      list-style: none;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .endereco {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-bottom: var(--ce-space-3);
      border-bottom: 1px solid var(--ce-border);

      &:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }
    }

    .endereco__linha {
      font-weight: 600;
    }

    .endereco__principal {
      margin-left: var(--ce-space-2);
      padding: 1px var(--ce-space-2);
      border-radius: 999px;
      background: var(--ce-primary-soft);
      color: var(--ce-primary-strong);
      font-size: var(--ce-font-sm);
      font-weight: 600;
    }

    .endereco__extra {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    .endereco__acoes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ce-space-1);
    }

    .falhos {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
      padding-top: var(--ce-space-3);
      border-top: 1px dashed var(--ce-danger);
    }

    .falhos__titulo {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }

    .form__erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class ClienteFormPage {
  /** Route param (:id) — null em /clientes/novo. */
  readonly id = input<string | null, string | null | undefined>(null, {
    // withComponentInputBinding entrega undefined (não null) quando a rota não tem :id.
    transform: (v) => v ?? null,
  });

  private readonly store = inject(ClientesStore);
  private readonly api = inject(ClientesApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly sheet = inject(SheetService);
  private proximaChave = 0;

  protected readonly nome = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly telefone = new FormControl('', { nonNullable: true });
  protected readonly observacoes = new FormControl('', { nonNullable: true });

  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);

  /** Cadastro novo: rascunhos locais. Edição: espelho dos endereços salvos (chave = id). */
  protected readonly enderecos = signal<readonly RascunhoEndereco[]>([]);
  protected readonly erroEnderecos = signal<string | null>(null);
  protected readonly tentando = signal(false);

  protected falhos(): readonly RascunhoEndereco[] {
    const id = this.id();
    return id === null ? [] : this.store.falhosDe(id);
  }

  constructor() {
    queueMicrotask(() => this.carregarExistente());
  }

  private carregarExistente(): void {
    const id = this.id();
    if (id === null) {
      return;
    }
    this.api.obter(id).subscribe({
      next: (cliente) => {
        this.nome.setValue(cliente.nome);
        this.telefone.setValue(cliente.telefone ?? '');
        this.observacoes.setValue(cliente.observacoes ?? '');
        this.enderecos.set(cliente.enderecos.map(comoRascunho));
      },
      error: () => this.toast.error('Não foi possível carregar o cliente.'),
    });
  }

  protected async salvar(): Promise<void> {
    this.erro.set(null);
    if (this.nome.invalid) {
      this.erro.set('Informe o nome do cliente.');
      return;
    }

    this.salvando.set(true);
    try {
      const request = {
        nome: this.nome.value.trim(),
        telefone: this.telefone.value.trim() || null,
        observacoes: this.observacoes.value.trim() || null,
      };
      if (this.id() === null) {
        const { cliente, falhos } = await this.store.salvarComEnderecos(request, this.enderecos());
        this.toast.success('Cliente cadastrado!');
        if (falhos.length > 0) {
          this.toast.error('Alguns endereços não foram salvos. Tente de novo na edição.');
          this.router.navigateByUrl(`/clientes/${cliente.id}/editar`);
        } else {
          this.router.navigateByUrl(`/clientes/${cliente.id}`);
        }
        return;
      }
      const cliente = await this.store.salvar(request, this.id());
      this.toast.success('Cliente atualizado!');
      this.router.navigateByUrl(`/clientes/${cliente.id}`);
    } catch (erro: unknown) {
      this.erro.set(erro instanceof ApiError ? erro.userMessage : 'Erro ao salvar o cliente.');
    } finally {
      this.salvando.set(false);
    }
  }

  protected async novoEndereco(): Promise<void> {
    const dados = await this.abrirSheet({});
    if (dados) {
      await this.aplicar(
        () => adicionar(this.enderecos(), dados, `novo-${++this.proximaChave}`),
        jaSalvoPelaSheet,
      );
    }
  }

  protected async editarEndereco(e: RascunhoEndereco): Promise<void> {
    const dados = await this.abrirSheet({ inicial: dadosDe(e), enderecoId: e.chave });
    if (dados) {
      await this.aplicar(() => editar(this.enderecos(), e.chave, dados), jaSalvoPelaSheet);
    }
  }

  protected tornarPrincipal(e: RascunhoEndereco): Promise<void> {
    return this.aplicar(
      () => marcarPrincipal(this.enderecos(), e.chave),
      () => this.api.atualizarEndereco(this.id()!, e.chave, { ...dadosDe(e), principal: true }),
    );
  }

  protected removerEndereco(e: RascunhoEndereco): Promise<void> {
    return this.aplicar(
      () => remover(this.enderecos(), e.chave),
      () => this.api.removerEndereco(this.id()!, e.chave),
    );
  }

  protected async tentarDeNovo(): Promise<void> {
    const id = this.id();
    if (id === null) {
      return;
    }
    this.tentando.set(true);
    try {
      await this.store.tentarDeNovo(id);
      await this.recarregarEnderecos(id);
    } finally {
      this.tentando.set(false);
    }
  }

  /** Cadastro novo: só a lista local (a sheet em modo local não chama a API). Edição: chama a API na hora e recarrega a lista. */
  private async aplicar(local: () => RascunhoEndereco[], remoto: () => Observable<unknown>) {
    this.erroEnderecos.set(null);
    const id = this.id();
    if (id === null) {
      this.enderecos.set(local());
      return;
    }
    try {
      await firstValueFrom(remoto());
      await this.recarregarEnderecos(id);
    } catch (erro: unknown) {
      this.erroEnderecos.set(
        erro instanceof ApiError ? erro.userMessage : 'Erro ao salvar o endereço.',
      );
    }
  }

  private async recarregarEnderecos(id: string): Promise<void> {
    const cliente = await firstValueFrom(this.api.obter(id));
    this.enderecos.set(cliente.enderecos.map(comoRascunho));
  }

  private async abrirSheet(extra: Pick<EnderecoSheetDados, 'inicial' | 'enderecoId'>) {
    const id = this.id();
    const ref = this.sheet.abrir<CreateEnderecoRequest | EnderecoResponse, EnderecoSheetDados>(
      EnderecoSheet,
      { ...extra, ...(id === null ? {} : { clienteId: id }) },
    );
    return firstValueFrom(ref.closed);
  }

  protected voltar(): void {
    this.router.navigateByUrl('/clientes');
  }
}

function comoRascunho(e: EnderecoResponse): RascunhoEndereco {
  return { ...dadosDe(e), chave: e.id };
}

// Na edição a própria sheet já chamou a API (POST/PUT); resta recarregar a lista.
const jaSalvoPelaSheet = () => of(null);
