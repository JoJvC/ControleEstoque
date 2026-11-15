import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { map } from 'rxjs';

import { TipoDespesaResponse } from '../../core/api/models/financeiro';
import { ApiError } from '../../core/http/api-error';
import { ToastService } from '../../core/toast/toast-service';
import { Button } from '../../ui/atoms/button';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { MoneyInput } from '../../ui/molecules/money-input';
import { SheetShell } from '../../ui/organisms/sheet-shell';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { CaixaStore } from './caixa-store';

export interface DespesaSheetDados {
  readonly caixaId: string;
}

/** Resultado: true quando a despesa foi lançada, ou undefined (cancelou). */
export type DespesaSheetResultado = boolean;

const PRECO = new PrecoPipe();

@Component({
  selector: 'ce-despesa-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SheetShell, Button, TextInput, FormField, MoneyInput, PrecoPipe],
  template: `
    <ce-sheet-shell titulo="Lançar despesa" (fechar)="ref.close()">
      <form class="form" (submit)="$event.preventDefault(); lancar()">
        <div class="campo">
          <span class="campo__rotulo">Tipo (obrigatório)</span>
          <div class="pilulas" role="radiogroup" aria-label="Tipo de despesa">
            @for (t of tipos(); track t.id) {
              <button
                type="button"
                class="pilula"
                role="radio"
                [attr.aria-checked]="tipo() === t.id"
                (click)="tipo.set(t.id)"
              >
                {{ t.nome }}
              </button>
            }
          </div>
        </div>

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

        <ce-form-field rotulo="Valor (R$)">
          <ce-money-input [formControl]="valor" />
        </ce-form-field>
        <ce-form-field rotulo="Observação">
          <ce-input placeholder="Opcional" [formControl]="descricao" />
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

        <ce-button tipo="submit" [block]="true" [disabled]="!podeLancar()" [loading]="enviando()">
          Lançar saída {{ valorAtual() > 0 ? (valorAtual() | cePreco) : '' }}
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

    .novo-tipo {
      display: flex;
      align-items: flex-end;
      gap: var(--ce-space-2);

      ce-form-field {
        flex: 1;
      }
    }

    .campo {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    .campo__rotulo {
      font-size: var(--ce-font-sm);
      font-weight: 600;
    }

    .pilulas {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ce-space-2);
    }

    .pilula {
      @include mixins.touch-target;

      padding-inline: var(--ce-space-4);
      border: 1px solid var(--ce-border);
      border-radius: 999px;
      background: var(--ce-surface);
      font-weight: 600;

      &[aria-checked='true'] {
        border-color: var(--ce-primary);
        background: var(--ce-primary-soft);
        color: var(--ce-primary-strong);
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

  private readonly toast = inject(ToastService);

  protected readonly tipo = signal<string | null>(null);
  protected readonly novoTipo = new FormControl('', { nonNullable: true });
  protected readonly valor = new FormControl<number | null>(null);
  protected readonly descricao = new FormControl('', { nonNullable: true });

  protected readonly tipos = signal<TipoDespesaResponse[]>([]);
  protected readonly valorAtual = toSignal(this.valor.valueChanges.pipe(map((v) => v ?? 0)), {
    initialValue: 0,
  });
  protected readonly podeLancar = computed(() => !!this.tipo() && this.valorAtual() > 0);
  protected readonly erro = signal<string | null>(null);
  protected readonly caixaFechado = signal<string | null>(null);
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
      this.tipo.set(criado.id);
      this.novoTipo.setValue('');
    } catch (e) {
      this.tratar(e);
    } finally {
      this.criandoTipo.set(false);
    }
  }

  protected async lancar(): Promise<void> {
    const tipoId = this.tipo();
    const valor = this.valor.value;
    if (!tipoId || valor === null || valor <= 0) {
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
      this.toast.success(`Despesa lançada: ${PRECO.transform(valor)}`);
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
