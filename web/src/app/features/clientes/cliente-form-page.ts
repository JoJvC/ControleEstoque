import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { ClientesApi } from '../../core/api/clientes-api';
import { ApiError } from '../../core/http/api-error';
import { ToastService } from '../../core/toast/toast-service';
import { Button } from '../../ui/atoms/button';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { AppHeader } from '../../ui/organisms/app-header';
import { ClientesStore } from './clientes-store';

@Component({
  selector: 'ce-cliente-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, AppHeader, Button, TextInput, FormField],
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

      @if (erro(); as mensagem) {
        <p class="form__erro" role="alert">{{ mensagem }}</p>
      }

      <ce-button tipo="submit" [block]="true" [loading]="salvando()">
        {{ id() === null ? 'Cadastrar cliente' : 'Salvar alterações' }}
      </ce-button>
    </form>
  `,
  styles: `
    @use 'mixins';

    .form {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-4);
      padding-inline: var(--ce-space-4);
      max-width: 560px;

      @include mixins.from-tablet {
        margin-inline: auto;
        width: 100%;
      }
    }

    .form__erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class ClienteFormPage {
  /** Route param (:id) — null em /clientes/novo. */
  readonly id = input<string | null>(null);

  private readonly store = inject(ClientesStore);
  private readonly api = inject(ClientesApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly nome = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly telefone = new FormControl('', { nonNullable: true });
  protected readonly observacoes = new FormControl('', { nonNullable: true });

  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);

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
      const cliente = await this.store.salvar(
        {
          nome: this.nome.value.trim(),
          telefone: this.telefone.value.trim() || null,
          observacoes: this.observacoes.value.trim() || null,
        },
        this.id(),
      );
      this.toast.success(this.id() === null ? 'Cliente cadastrado!' : 'Cliente atualizado!');
      this.router.navigateByUrl(`/clientes/${cliente.id}`);
    } catch (erro: unknown) {
      this.erro.set(erro instanceof ApiError ? erro.userMessage : 'Erro ao salvar o cliente.');
    } finally {
      this.salvando.set(false);
    }
  }

  protected voltar(): void {
    this.router.navigateByUrl('/clientes');
  }
}
