import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import {
  CreateFuncionarioRequest,
  FuncionarioResponse,
  TipoLancamentoFuncionario,
} from '../../core/api/models/rh';
import { ApiError } from '../../core/http/api-error';
import { CePermissao } from '../../core/permissions/ce-permissao';
import { Button } from '../../ui/atoms/button';
import { Skeleton } from '../../ui/atoms/skeleton';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { MoneyInput } from '../../ui/molecules/money-input';
import { SaldoChip } from '../../ui/molecules/saldo-chip';
import { AppHeader } from '../../ui/organisms/app-header';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { ContaCorrenteStore } from './conta-corrente-store';
import { FuncionarioForm } from './funcionario-form';
import { FuncionariosStore } from './funcionarios-store';

const ROTULOS: Record<TipoLancamentoFuncionario, string> = {
  DIARIA: 'Diária',
  VALE: 'Vale',
  PAGAMENTO: 'Pagamento',
};

@Component({
  selector: 'ce-funcionario-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    CePermissao,
    AppHeader,
    Button,
    Skeleton,
    TextInput,
    FormField,
    MoneyInput,
    SaldoChip,
    PrecoPipe,
    FuncionarioForm,
  ],
  template: `
    <ce-app-header
      [titulo]="funcionario()?.nome ?? 'Funcionário'"
      [mostrarVoltar]="true"
      (voltar)="voltar()"
    />
    <div class="pagina">
      @if (erroCarga()) {
        <p class="erro" role="alert">Não foi possível carregar o funcionário.</p>
      } @else if (funcionario(); as f) {
        <ce-funcionario-form
          [inicial]="f"
          [salvando]="salvando()"
          [erro]="erro()"
          (salvar)="salvar($event)"
        />

        <section class="cartao">
          <h2 class="cartao__titulo">Conta-corrente</h2>
          @if (conta.status() === 'ok') {
            <ce-saldo-chip
              rotulo="Saldo a pagar"
              [cor]="conta.saldoAPagar() > 0 ? 'warning' : 'success'"
            >
              {{ conta.saldoAPagar() | cePreco }}
            </ce-saldo-chip>

            <form class="lancar" [formGroup]="lancamento">
              <ce-form-field rotulo="Valor">
                <ce-money-input formControlName="valor" />
              </ce-form-field>
              <ce-form-field rotulo="Observação">
                <ce-input formControlName="observacao" />
              </ce-form-field>
              @if (erroConta(); as msg) {
                <p class="erro" role="alert">{{ msg }}</p>
              }
              <div class="acoes">
                <ce-button
                  *cePermissao="'rh.gerir'"
                  variante="ghost"
                  [disabled]="!lancamento.controls.valor.value || lancando()"
                  (click)="lancar('VALE')"
                >
                  Lançar vale
                </ce-button>
                <ce-button
                  *cePermissao="'rh.gerir'"
                  variante="ghost"
                  [disabled]="!lancamento.controls.valor.value || lancando()"
                  (click)="lancar('PAGAMENTO')"
                >
                  Lançar pagamento
                </ce-button>
              </div>
            </form>

            <ul class="lancamentos">
              @for (l of conta.lancamentos(); track l.id) {
                <li class="lancamento">
                  <span class="lancamento__dados">
                    <span>{{ rotulo(l.tipo) }} · {{ l.data | date: 'dd/MM/yyyy HH:mm' }}</span>
                    @if (l.observacao) {
                      <span class="obs">{{ l.observacao }}</span>
                    }
                  </span>
                  <span class="valor">{{ l.valor | cePreco }}</span>
                </li>
              } @empty {
                <li class="obs">Nenhum lançamento.</li>
              }
            </ul>
          } @else if (conta.status() === 'error') {
            <p class="erro" role="alert">Não foi possível carregar a conta-corrente.</p>
          } @else {
            <div class="carregando" aria-busy="true">
              <ce-skeleton altura="56px" />
              <p class="obs">Carregando conta-corrente…</p>
            </div>
          }
        </section>
      }
    </div>
  `,
  styles: `
    @use 'mixins';

    .pagina {
      padding: var(--ce-space-4);
      max-width: 560px;
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-4);

      @include mixins.from-tablet {
        margin-inline: auto;
        width: 100%;
      }
    }

    .cartao {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
      padding: var(--ce-space-4);
      border: 1px solid var(--ce-border);
      border-radius: 20px;
      background: var(--ce-surface);
    }

    .cartao__titulo {
      margin: 0;
      font-family: var(--ce-font-family-titulo);
      font-size: var(--ce-font-lg);
    }

    .lancar {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .acoes {
      display: flex;
      gap: var(--ce-space-3);
    }

    .lancamentos {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    // Lançamento é informativo: cartão próprio, sem o estado disabled (opacidade) do ce-list-item.
    .lancamento {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ce-space-3);
      padding: var(--ce-space-3) var(--ce-space-4);
      border: 1px solid var(--ce-border);
      border-radius: 20px;
      background: var(--ce-surface);
      color: var(--ce-text);
    }

    .lancamento__dados {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .valor {
      font-family: var(--ce-font-family-titulo);
      color: var(--ce-text);

      @include mixins.tabular-numbers;
    }

    .carregando {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    .obs {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
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
export class FuncionarioPage {
  /** Route param (:id). */
  readonly id = input.required<string>();

  private readonly store = inject(FuncionariosStore);
  private readonly router = inject(Router);
  protected readonly conta = inject(ContaCorrenteStore);

  protected readonly funcionario = signal<FuncionarioResponse | null>(null);
  protected readonly erroCarga = signal(false);
  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly lancando = signal(false);
  protected readonly erroConta = signal<string | null>(null);
  protected readonly rotulo = (t: TipoLancamentoFuncionario) => ROTULOS[t];

  protected readonly lancamento = new FormGroup({
    valor: new FormControl<number | null>(null),
    observacao: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.carregar(id));
    });
  }

  protected voltar(): void {
    this.router.navigateByUrl('/rh/funcionarios');
  }

  protected async salvar(req: CreateFuncionarioRequest): Promise<void> {
    this.erro.set(null);
    this.salvando.set(true);
    try {
      this.funcionario.set(await this.store.atualizar(this.id(), req));
    } catch (e) {
      this.erro.set(
        e instanceof ApiError ? e.userMessage : 'Não foi possível salvar o funcionário.',
      );
    } finally {
      this.salvando.set(false);
    }
  }

  protected async lancar(tipo: 'VALE' | 'PAGAMENTO'): Promise<void> {
    const { valor, observacao } = this.lancamento.getRawValue();
    if (!valor) {
      return;
    }
    const req = { valor, observacao: observacao.trim() || null };
    this.erroConta.set(null);
    this.lancando.set(true);
    try {
      if (tipo === 'VALE') {
        await this.conta.lancarVale(this.id(), req);
      } else {
        await this.conta.lancarPagamento(this.id(), req);
      }
      this.lancamento.reset();
    } catch (e) {
      this.erroConta.set(
        e instanceof ApiError ? e.userMessage : 'Não foi possível lançar. Tente novamente.',
      );
    } finally {
      this.lancando.set(false);
    }
  }

  private async carregar(id: string): Promise<void> {
    try {
      this.funcionario.set(await this.store.obter(id));
    } catch {
      this.erroCarga.set(true);
      return;
    }
    await this.conta.carregar(id);
  }
}
