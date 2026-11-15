import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ClientesApi } from '../../core/api/clientes-api';
import { CreateEnderecoRequest, EnderecoResponse } from '../../core/api/models/clientes';
import { ApiError } from '../../core/http/api-error';
import { Button } from '../../ui/atoms/button';
import { Checkbox } from '../../ui/atoms/checkbox';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { SheetShell } from '../../ui/organisms/sheet-shell';

/**
 * Sem `clienteId`: modo local (cadastro novo) — fecha com os dados do formulário, sem chamar a API.
 * Com `clienteId` e `enderecoId`: edita (PUT); só com `clienteId`: cria (POST).
 */
export interface EnderecoSheetDados {
  readonly clienteId?: string;
  readonly enderecoId?: string;
  readonly inicial?: CreateEnderecoRequest;
}

/** Sheet de endereço — fecha com o EnderecoResponse salvo, ou com os dados (modo local), ou undefined. */
@Component({
  selector: 'ce-endereco-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SheetShell, Button, Checkbox, TextInput, FormField],
  template: `
    <ce-sheet-shell
      [titulo]="editando ? 'Editar endereço' : 'Novo endereço'"
      (fechar)="ref.close()"
    >
      <form class="form" (submit)="$event.preventDefault(); salvar()">
        <ce-form-field rotulo="Logradouro" [obrigatorio]="true">
          <ce-input placeholder="Rua, avenida…" [formControl]="logradouro" />
        </ce-form-field>
        <div class="linha">
          <ce-form-field rotulo="Número">
            <ce-input placeholder="123" [formControl]="numero" />
          </ce-form-field>
          <ce-form-field rotulo="Bairro">
            <ce-input placeholder="Centro" [formControl]="bairro" />
          </ce-form-field>
        </div>
        <ce-form-field rotulo="Complemento">
          <ce-input placeholder="Apto, bloco…" [formControl]="complemento" />
        </ce-form-field>
        <ce-form-field rotulo="Referência" dica="Ajuda o entregador a achar.">
          <ce-input placeholder="Próximo ao mercado…" [formControl]="referencia" />
        </ce-form-field>
        <ce-checkbox [formControl]="principal">Endereço principal</ce-checkbox>

        @if (erro(); as mensagem) {
          <p class="erro" role="alert">{{ mensagem }}</p>
        }

        <ce-button tipo="submit" [block]="true" [loading]="salvando()">{{
          editando ? 'Salvar endereço' : 'Adicionar endereço'
        }}</ce-button>
      </form>
    </ce-sheet-shell>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .linha {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: var(--ce-space-3);
    }

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class EnderecoSheet {
  protected readonly ref = inject(DialogRef<EnderecoResponse | CreateEnderecoRequest>);
  private readonly dados = inject<EnderecoSheetDados>(DIALOG_DATA);
  private readonly api = inject(ClientesApi);
  protected readonly editando = !!this.dados.inicial;

  protected readonly logradouro = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly numero = new FormControl('', { nonNullable: true });
  protected readonly bairro = new FormControl('', { nonNullable: true });
  protected readonly complemento = new FormControl('', { nonNullable: true });
  protected readonly referencia = new FormControl('', { nonNullable: true });
  protected readonly principal = new FormControl(false, { nonNullable: true });

  constructor() {
    const i = this.dados.inicial;
    if (i) {
      this.logradouro.setValue(i.logradouro);
      this.numero.setValue(i.numero ?? '');
      this.bairro.setValue(i.bairro ?? '');
      this.complemento.setValue(i.complemento ?? '');
      this.referencia.setValue(i.referencia ?? '');
      this.principal.setValue(i.principal);
    }
  }

  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected async salvar(): Promise<void> {
    this.erro.set(null);
    if (this.logradouro.invalid) {
      this.erro.set('Informe o logradouro.');
      return;
    }

    const request: CreateEnderecoRequest = {
      logradouro: this.logradouro.value.trim(),
      numero: this.numero.value.trim() || null,
      bairro: this.bairro.value.trim() || null,
      complemento: this.complemento.value.trim() || null,
      referencia: this.referencia.value.trim() || null,
      principal: this.principal.value,
    };
    const { clienteId, enderecoId } = this.dados;
    if (clienteId === undefined) {
      this.ref.close(request);
      return;
    }

    this.salvando.set(true);
    try {
      const endereco = await firstValueFrom(
        enderecoId === undefined
          ? this.api.adicionarEndereco(clienteId, request)
          : this.api.atualizarEndereco(clienteId, enderecoId, request),
      );
      this.ref.close(endereco);
    } catch (erro: unknown) {
      this.erro.set(erro instanceof ApiError ? erro.userMessage : 'Erro ao salvar o endereço.');
    } finally {
      this.salvando.set(false);
    }
  }
}
