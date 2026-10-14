import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { EstoqueItemResponse } from '../../core/api/models/estoque';
import { ApiError } from '../../core/http/api-error';
import { Button } from '../../ui/atoms/button';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { QuantityStepper } from '../../ui/molecules/quantity-stepper';
import { SheetShell } from '../../ui/organisms/sheet-shell';
import { EstoqueStore } from './estoque-store';

export interface AjusteSheetDados {
  readonly item: EstoqueItemResponse;
}

/** Ajuste manual de estoque (entrada/saída) — fecha devolvendo true se registrou. */
@Component({
  selector: 'ce-ajuste-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SheetShell, Button, TextInput, FormField, QuantityStepper],
  template: `
    <ce-sheet-shell [titulo]="'Ajustar — ' + dados.item.nome" (fechar)="ref.close()">
      <form class="form" (submit)="$event.preventDefault(); salvar()">
        <p class="atual">
          Quantidade atual: <strong>{{ dados.item.quantidade }}</strong>
        </p>

        <div class="direcao" role="radiogroup" aria-label="Tipo de ajuste">
          <button
            type="button"
            class="direcao__opcao"
            [class.direcao__opcao--ativa]="direcao() === 'entrada'"
            [attr.aria-checked]="direcao() === 'entrada'"
            role="radio"
            (click)="direcao.set('entrada')"
          >
            Entrada (+)
          </button>
          <button
            type="button"
            class="direcao__opcao"
            [class.direcao__opcao--ativa]="direcao() === 'saida'"
            [attr.aria-checked]="direcao() === 'saida'"
            role="radio"
            (click)="direcao.set('saida')"
          >
            Saída (−)
          </button>
        </div>

        <ce-form-field rotulo="Quantidade" [obrigatorio]="true">
          <ce-quantity-stepper [formControl]="quantidade" [min]="1" />
        </ce-form-field>

        <ce-form-field rotulo="Observação" dica="Motivo do ajuste — fica no histórico.">
          <ce-input placeholder="Ex.: contagem física" [formControl]="observacao" />
        </ce-form-field>

        @if (erro(); as mensagem) {
          <p class="erro" role="alert">{{ mensagem }}</p>
        }

        <ce-button tipo="submit" [block]="true" [loading]="salvando()">
          Confirmar ajuste
        </ce-button>
      </form>
    </ce-sheet-shell>
  `,
  styles: `
    @use 'mixins';

    .form {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .atual {
      color: var(--ce-text-muted);
    }

    .direcao {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--ce-space-2);
    }

    .direcao__opcao {
      @include mixins.touch-target;

      border: 1px solid var(--ce-border);
      border-radius: var(--ce-radius-md);
      background: var(--ce-surface);
      font-weight: 600;
      color: var(--ce-text-muted);
    }

    .direcao__opcao--ativa {
      border-color: var(--ce-primary);
      background: var(--ce-primary-soft);
      color: var(--ce-primary-strong);
    }

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class AjusteSheet {
  protected readonly ref = inject(DialogRef<boolean>);
  protected readonly dados = inject<AjusteSheetDados>(DIALOG_DATA);
  private readonly store = inject(EstoqueStore);

  protected readonly direcao = signal<'entrada' | 'saida'>('entrada');
  protected readonly quantidade = new FormControl(1, { nonNullable: true });
  protected readonly observacao = new FormControl('', { nonNullable: true });

  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);

  protected async salvar(): Promise<void> {
    this.erro.set(null);
    this.salvando.set(true);
    try {
      const sinal = this.direcao() === 'saida' ? -1 : 1;
      await this.store.ajustar({
        produtoId: this.dados.item.produtoId,
        quantidade: sinal * this.quantidade.value,
        observacao: this.observacao.value.trim() || null,
      });
      this.ref.close(true);
    } catch (erro: unknown) {
      this.erro.set(erro instanceof ApiError ? erro.userMessage : 'Erro ao registrar o ajuste.');
    } finally {
      this.salvando.set(false);
    }
  }
}
