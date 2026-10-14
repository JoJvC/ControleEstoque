import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { RhApi } from '../../core/api/rh-api';
import { FuncionarioResponse } from '../../core/api/models/rh';
import { ApiError } from '../../core/http/api-error';
import { Button } from '../../ui/atoms/button';
import { Checkbox } from '../../ui/atoms/checkbox';
import { Icon } from '../../ui/atoms/icon';
import { Spinner } from '../../ui/atoms/spinner';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { QuantityStepper } from '../../ui/molecules/quantity-stepper';
import { SheetShell } from '../../ui/organisms/sheet-shell';
import { EstoqueStore } from './estoque-store';

/** Baixa de casco por quebra — fecha devolvendo true se registrou. */
@Component({
  selector: 'ce-baixa-casco-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    SheetShell,
    Button,
    Checkbox,
    Icon,
    Spinner,
    TextInput,
    FormField,
    QuantityStepper,
  ],
  template: `
    <ce-sheet-shell titulo="Baixa de casco por quebra" (fechar)="ref.close()">
      <form class="form" (submit)="$event.preventDefault(); salvar()">
        <p class="aviso">
          <ce-icon nome="info" [tamanho]="16" />
          O casco baixado sai do estoque de casco vazio e entra no estoque de sucata.
        </p>

        <ce-form-field rotulo="Quantidade quebrada" [obrigatorio]="true">
          <ce-quantity-stepper [formControl]="quantidade" [min]="1" />
        </ce-form-field>

        <ce-form-field rotulo="Motivo" dica="Como aconteceu — fica no registro.">
          <ce-input placeholder="Ex.: queda na descarga" [formControl]="motivo" />
        </ce-form-field>

        <fieldset class="responsaveis">
          <legend class="responsaveis__rotulo">
            Responsáveis <span class="responsaveis__asterisco" aria-hidden="true">*</span>
          </legend>
          @if (carregandoFuncionarios()) {
            <div class="responsaveis__carregando"><ce-spinner [tamanho]="20" /></div>
          } @else {
            @for (funcionario of funcionarios(); track funcionario.id) {
              <ce-checkbox
                [ngModel]="selecionados().has(funcionario.id)"
                [ngModelOptions]="{ standalone: true }"
                (ngModelChange)="alternar(funcionario.id, $event)"
              >
                {{ funcionario.nome }}
              </ce-checkbox>
            } @empty {
              <p class="responsaveis__vazio">Nenhum funcionário ativo encontrado.</p>
            }
          }
        </fieldset>

        @if (erro(); as mensagem) {
          <p class="erro" role="alert">{{ mensagem }}</p>
        }

        <ce-button tipo="submit" variante="danger" [block]="true" [loading]="salvando()">
          Registrar baixa
        </ce-button>
      </form>
    </ce-sheet-shell>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .aviso {
      display: flex;
      align-items: center;
      gap: var(--ce-space-2);
      padding: var(--ce-space-2) var(--ce-space-3);
      border-radius: var(--ce-radius-md);
      background: var(--ce-primary-soft);
      color: var(--ce-primary-strong);
      font-size: var(--ce-font-sm);
    }

    .responsaveis {
      border: none;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-1);
    }

    .responsaveis__rotulo {
      font-size: var(--ce-font-sm);
      font-weight: 600;
      margin-bottom: var(--ce-space-1);
    }

    .responsaveis__asterisco {
      color: var(--ce-danger);
    }

    .responsaveis__carregando {
      display: flex;
      justify-content: center;
      padding: var(--ce-space-3);
    }

    .responsaveis__vazio {
      color: var(--ce-text-muted);
      font-size: var(--ce-font-sm);
    }

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class BaixaCascoSheet {
  protected readonly ref = inject(DialogRef<boolean>);
  private readonly store = inject(EstoqueStore);
  private readonly rhApi = inject(RhApi);

  protected readonly quantidade = new FormControl(1, { nonNullable: true });
  protected readonly motivo = new FormControl('', { nonNullable: true });

  protected readonly funcionarios = signal<FuncionarioResponse[]>([]);
  protected readonly carregandoFuncionarios = signal(true);
  protected readonly selecionados = signal<ReadonlySet<string>>(new Set());

  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);

  constructor() {
    this.rhApi.listarFuncionarios().subscribe({
      next: (funcionarios) => {
        this.funcionarios.set(funcionarios.filter((f) => f.ativo));
        this.carregandoFuncionarios.set(false);
      },
      error: () => {
        this.carregandoFuncionarios.set(false);
        this.erro.set('Não foi possível carregar os funcionários.');
      },
    });
  }

  protected alternar(id: string, marcado: boolean): void {
    this.selecionados.update((atual) => {
      const novo = new Set(atual);
      if (marcado) {
        novo.add(id);
      } else {
        novo.delete(id);
      }
      return novo;
    });
  }

  protected async salvar(): Promise<void> {
    this.erro.set(null);
    if (this.selecionados().size === 0) {
      this.erro.set('Informe ao menos um funcionário responsável pela quebra.');
      return;
    }

    this.salvando.set(true);
    try {
      await this.store.baixarCasco({
        quantidade: this.quantidade.value,
        motivo: this.motivo.value.trim() || null,
        responsaveisIds: [...this.selecionados()],
      });
      this.ref.close(true);
    } catch (erro: unknown) {
      this.erro.set(erro instanceof ApiError ? erro.userMessage : 'Erro ao registrar a baixa.');
    } finally {
      this.salvando.set(false);
    }
  }
}
