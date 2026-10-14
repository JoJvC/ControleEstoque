import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { ApiError } from '../../core/http/api-error';
import { ToastService } from '../../core/toast/toast-service';
import { Button } from '../../ui/atoms/button';
import { FormField } from '../../ui/molecules/form-field';
import { ListItem } from '../../ui/molecules/list-item';
import { TextInput } from '../../ui/atoms/text-input';
import { AppHeader } from '../../ui/organisms/app-header';
import { DataList } from '../../ui/organisms/data-list';
import { MarcasStore } from './marcas-store';

@Component({
  selector: 'ce-marcas-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, AppHeader, Button, FormField, TextInput, ListItem, DataList],
  template: `
    <ce-app-header titulo="Marcas" [mostrarVoltar]="true" (voltar)="voltar()" />

    <div class="conteudo">
      <form class="nova" (submit)="$event.preventDefault(); criar()">
        <ce-form-field rotulo="Nova marca" [erro]="erro()">
          <ce-input placeholder="Ex.: Indaiá" [formControl]="nome" />
        </ce-form-field>
        <ce-button tipo="submit" [loading]="criando()">Adicionar</ce-button>
      </form>

      <ce-data-list
        [itens]="store.marcas()"
        [status]="store.status()"
        vazioTitulo="Nenhuma marca"
        vazioDescricao="Cadastre a primeira marca de água."
        (recarregar)="store.carregar()"
      >
        <ng-template let-marca>
          <ce-list-item [desabilitado]="true">{{ marca.nome }}</ce-list-item>
        </ng-template>
      </ce-data-list>
    </div>
  `,
  styles: `
    .conteudo {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-5);
      padding: 0 var(--ce-space-4) var(--ce-space-6);
      max-width: 560px;
    }

    .nova {
      display: flex;
      align-items: flex-end;
      gap: var(--ce-space-3);

      ce-form-field {
        flex: 1;
      }
    }
  `,
})
export class MarcasPage {
  protected readonly store = inject(MarcasStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly nome = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly criando = signal(false);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    this.store.carregar();
  }

  protected async criar(): Promise<void> {
    this.erro.set(null);
    const nome = this.nome.value.trim();
    if (!nome) {
      this.erro.set('Informe o nome da marca.');
      return;
    }

    this.criando.set(true);
    try {
      await this.store.criar(nome);
      this.nome.setValue('');
      this.toast.success('Marca adicionada!');
    } catch (erro: unknown) {
      this.erro.set(
        erro instanceof ApiError && erro.status === 409
          ? 'Já existe uma marca com esse nome.'
          : 'Erro ao adicionar a marca.',
      );
    } finally {
      this.criando.set(false);
    }
  }

  protected voltar(): void {
    this.router.navigateByUrl('/mais');
  }
}
