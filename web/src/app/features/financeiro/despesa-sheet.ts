import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { TipoDespesaResponse } from '../../core/api/models/financeiro';
import { ApiError } from '../../core/http/api-error';
import { Button } from '../../ui/atoms/button';
import { Select } from '../../ui/atoms/select';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { MoneyInput } from '../../ui/molecules/money-input';
import { SheetShell } from '../../ui/organisms/sheet-shell';
import { CaixaStore } from './caixa-store';

export interface DespesaSheetDados {
  readonly caixaId: string;
}

/** Resultado: true quando a despesa foi lançada, ou undefined (cancelou). */
export type DespesaSheetResultado = boolean;

@Component({
  selector: 'ce-despesa-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SheetShell, Button, Select, TextInput, FormField, MoneyInput],
  template: `
    <ce-sheet-shell titulo="Lançar despesa" (fechar)="ref.close()">
      <form class="form" (submit)="$event.preventDefault(); lancar()">
        <ce-form-field rotulo="Tipo" [obrigatorio]="true" [erro]="erroTipo()">
          <ce-select [opcoes]="opcoes()" placeholder="Selecione" [formControl]="tipo" />
        </ce-form-field>

        <div class="novo-tipo">
          <ce-form-field rotulo="Novo tipo">
            <ce-input
              [formControl]="novoTipo"
              (keydown.enter)="$event.preventDefault(); criarTipo()"
            />
          </ce-form-field>
          <ce-button variante="ghost" [disabled]="!novoTipoValido()" (click)="criarTipo()">
            Criar tipo
          </ce-button>
        </div>

        <ce-form-field rotulo="Valor" [obrigatorio]="true">
          <ce-money-input [formControl]="valor" />
        </ce-form-field>
        <ce-form-field rotulo="Descrição">
          <ce-input [formControl]="descricao" />
        </ce-form-field>

        @if (caixaFechado(); as mensagem) {
          <div class="alerta" role="alert">
            <p class="alerta__titulo">Caixa fechado</p>
            <p>{{ mensagem }}</p>
            <ce-button variante="ghost" (click)="ref.close()">Voltar ao caixa</ce-button>
          </div>
        }
        @if (erro(); as mensagem) {
          <p class="erro" role="alert">{{ mensagem }}</p>
        }

        <ce-button tipo="submit" [block]="true" [loading]="enviando()">Lançar despesa</ce-button>
      </form>
    </ce-sheet-shell>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .novo-tipo {
      display: flex;
      align-items: flex-end;
      gap: var(--ce-space-2);

      ce-form-field {
        flex: 1;
      }
    }

    .alerta {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--ce-space-2);
      padding: var(--ce-space-3);
      border-radius: 20px;
      background: var(--ce-warning-soft);
      color: var(--ce-text);
    }

    .alerta p {
      margin: 0;
    }

    .alerta__titulo {
      font-family: var(--ce-font-family-titulo);
      font-weight: 700;
      color: var(--ce-warning);
    }

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class DespesaSheet {
  protected readonly ref = inject(DialogRef<DespesaSheetResultado>);
  private readonly dados = inject<DespesaSheetDados>(DIALOG_DATA);
  private readonly store = inject(CaixaStore);

  protected readonly tipo = new FormControl<string | null>(null);
  protected readonly novoTipo = new FormControl('', { nonNullable: true });
  protected readonly valor = new FormControl<number | null>(null);
  protected readonly descricao = new FormControl('', { nonNullable: true });

  private readonly tipos = signal<TipoDespesaResponse[]>([]);
  protected readonly opcoes = computed(() =>
    this.tipos().map((t) => ({ value: t.id, label: t.nome })),
  );
  protected readonly erro = signal<string | null>(null);
  protected readonly caixaFechado = signal<string | null>(null);
  protected readonly erroTipo = signal<string | null>(null);
  protected readonly enviando = signal(false);
  private readonly criandoTipo = signal(false);
  private readonly novoTipoTexto = signal('');
  protected readonly novoTipoValido = computed(
    () => this.novoTipoTexto().trim() !== '' && !this.criandoTipo(),
  );

  constructor() {
    this.novoTipo.valueChanges.subscribe((v) => this.novoTipoTexto.set(v));
    this.carregarTipos();
  }

  private async carregarTipos(): Promise<void> {
    try {
      this.tipos.set(await this.store.listarTipos());
    } catch (e) {
      // 0/5xx já viram toast no interceptor; 4xx não tem tratamento próprio aqui
      if (!(e instanceof ApiError)) {
        throw e;
      }
    }
  }

  protected async criarTipo(): Promise<void> {
    const nome = this.novoTipo.value.trim();
    if (!this.novoTipoValido()) {
      return;
    }
    this.criandoTipo.set(true);
    this.erro.set(null);
    try {
      const criado = await this.store.criarTipo(nome);
      await this.carregarTipos();
      this.tipo.setValue(criado.id);
      this.erroTipo.set(null);
      this.novoTipo.setValue('');
    } catch (e) {
      this.tratar(e);
    } finally {
      this.criandoTipo.set(false);
    }
  }

  protected async lancar(): Promise<void> {
    const tipoId = this.tipo.value;
    if (!tipoId) {
      this.erroTipo.set('Escolha o tipo da despesa.');
      return;
    }
    this.erroTipo.set(null);
    const valor = this.valor.value;
    if (valor === null || valor <= 0) {
      this.erro.set('Informe o valor da despesa.');
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    this.caixaFechado.set(null);
    try {
      await this.store.lancarDespesa(
        this.dados.caixaId,
        tipoId,
        valor,
        this.descricao.value.trim() || null,
      );
      this.ref.close(true);
    } catch (e) {
      // 409 CAIXA_FECHADO vira bloco de alerta; 400 VALOR_INVALIDO e 422 TIPO_DESPESA_INEXISTENTE ficam inline.
      this.tratar(e);
    } finally {
      this.enviando.set(false);
    }
  }

  private tratar(e: unknown): void {
    if (!(e instanceof ApiError)) {
      throw e;
    }
    if (e.code === 'CAIXA_FECHADO') {
      this.caixaFechado.set(e.userMessage);
    } else if (e.status >= 400 && e.status < 500) {
      this.erro.set(e.userMessage);
    }
  }
}
