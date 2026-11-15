import { BreakpointObserver } from '@angular/cdk/layout';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';

import {
  CreateFuncionarioRequest,
  FuncionarioResponse,
  TipoLancamentoFuncionario,
} from '../../core/api/models/rh';
import { ApiError } from '../../core/http/api-error';
import { SheetService } from '../../core/overlay/sheet-service';
import { CePermissao } from '../../core/permissions/ce-permissao';
import { ToastService } from '../../core/toast/toast-service';
import { Icon } from '../../ui/atoms/icon';
import { Skeleton } from '../../ui/atoms/skeleton';
import { EmptyState } from '../../ui/molecules/empty-state';
import { AppHeader } from '../../ui/organisms/app-header';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { ContaCorrenteStore } from './conta-corrente-store';
import { FuncionarioForm } from './funcionario-form';
import { FuncionariosPage } from './funcionarios-page';
import { FuncionariosStore } from './funcionarios-store';
import { LancarSheet, LancarSheetDados, LancarSheetResultado } from './lancar-sheet';
import { RhGrade } from './rh-grade';

const ROTULOS: Record<TipoLancamentoFuncionario, string> = {
  DIARIA: 'Diária',
  VALE: 'Vale',
  PAGAMENTO: 'Pagamento',
};

@Component({
  selector: 'ce-funcionario-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    NgTemplateOutlet,
    CePermissao,
    AppHeader,
    EmptyState,
    Icon,
    Skeleton,
    PrecoPipe,
    FuncionarioForm,
    FuncionariosPage,
    RhGrade,
  ],
  template: `
    <ng-template #conteudo>
      <ce-app-header
        [titulo]="funcionario()?.nome ?? 'Funcionário'"
        [onda]="true"
        [folgado]="true"
        [mostrarVoltar]="!desktop()"
        (voltar)="voltar()"
      >
        <div ce-destaque>
          @if (funcionario(); as f) {
            <p class="destaque__linha">
              {{ f.cargo }} ·
              @if (f.valorDiaria > 0) {
                diária {{ f.valorDiaria | cePreco }}
              } @else {
                sem diária
              }
            </p>
            @if (conta.status() === 'ok') {
              <p class="destaque__rotulo">Conta-corrente · a pagar a {{ primeiroNome() }}</p>
              <p class="destaque__saldo">{{ conta.saldoAPagar() | cePreco }}</p>
              <div class="destaque__acoes">
                <button
                  *cePermissao="'rh.gerir'"
                  type="button"
                  class="destaque__botao destaque__botao--vale"
                  aria-label="Lançar vale"
                  (click)="lancar('VALE')"
                >
                  <ce-icon nome="vale" [tamanho]="20" /> Vale
                </button>
                <button
                  *cePermissao="'rh.gerir'"
                  type="button"
                  class="destaque__botao"
                  aria-label="Lançar pagamento"
                  (click)="lancar('PAGAMENTO')"
                >
                  <ce-icon nome="dinheiro" [tamanho]="20" /> Pagamento
                </button>
              </div>
            }
          }
        </div>
      </ce-app-header>
      <div class="pagina">
        @if (erroCarga()) {
          <p class="erro" role="alert">Não foi possível carregar o funcionário.</p>
        } @else if (funcionario(); as f) {
          <section>
            <h2 class="secao">Extrato</h2>
            @if (conta.status() === 'ok') {
              @if (conta.extrato().length) {
                <ul class="cartao extrato">
                  @for (l of conta.extrato(); track l.lancamento.id) {
                    <li class="linha">
                      <span
                        class="icone-tipo"
                        [class.pago]="l.delta > 0"
                        [class.fiado]="l.delta <= 0"
                      >
                        <ce-icon [nome]="l.delta > 0 ? 'receber' : 'vale'" [tamanho]="20" />
                      </span>
                      <span class="linha__meio">
                        <b>
                          {{ rotulo(l.lancamento.tipo) }}
                          @if (l.lancamento.observacao) {
                            <span class="obs">· {{ l.lancamento.observacao }}</span>
                          }
                        </b>
                        <span class="obs">
                          {{ l.lancamento.data | date: 'dd/MM/yyyy HH:mm' }} · saldo
                          {{ l.saldoApos | cePreco }}
                        </span>
                      </span>
                      <span class="valor" [class.pago]="l.delta > 0" [class.fiado]="l.delta <= 0">
                        {{ l.delta > 0 ? '+' : '−' }} {{ absoluto(l.delta) | cePreco }}
                      </span>
                    </li>
                  }
                </ul>
              } @else {
                <ce-empty-state
                  icone="dinheiro"
                  titulo="Sem lançamentos"
                  descricao="Diárias entram no fechamento do caixa; vales e pagamentos você lança aqui."
                />
              }
            } @else if (conta.status() === 'error') {
              <p class="erro" role="alert">Não foi possível carregar a conta-corrente.</p>
            } @else {
              <div class="carregando" aria-busy="true">
                <ce-skeleton altura="56px" />
                <p class="obs">Carregando conta-corrente…</p>
              </div>
            }
          </section>

          <section class="cartao">
            <h2 class="secao">Dados do funcionário</h2>
            <ce-funcionario-form
              [inicial]="f"
              [salvando]="salvando()"
              [erro]="erro()"
              (salvar)="salvar($event)"
            />
          </section>
        }
      </div>
    </ng-template>

    @if (desktop()) {
      <ce-rh-grade>
        <div mestre><ce-funcionarios-page [embutido]="true" [selecionadoId]="id()" /></div>
        <ng-container *ngTemplateOutlet="conteudo" />
      </ce-rh-grade>
    } @else {
      <ng-container *ngTemplateOutlet="conteudo" />
    }
  `,
  styles: `
    @use 'mixins';

    .destaque__linha,
    .destaque__rotulo,
    .destaque__saldo {
      margin: 0;
    }

    .destaque__rotulo,
    .destaque__linha {
      font-size: var(--ce-font-sm);
      opacity: 0.85;
    }

    .destaque__saldo {
      font-family: var(--ce-font-family-titulo);
      font-size: 40px;
      font-weight: 700;
      line-height: 1.05;
      @include mixins.tabular-numbers;
    }

    .destaque__acoes {
      display: flex;
      gap: 10px;
      margin-top: 12px;
    }

    .destaque__botao {
      @include mixins.touch-target;

      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--ce-space-2);
      border-radius: 14px;
      font-weight: 600;
      background: var(--ce-topo-cartao);
      color: var(--ce-texto-sobre-topo);
    }

    .destaque__botao--vale {
      background: var(--ce-destaque);
      color: var(--ce-topo);
    }

    .pagina {
      padding: var(--ce-space-4);
      max-width: 560px;
      padding-bottom: var(--ce-space-8);
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-4);

      @include mixins.from-tablet {
        margin-inline: auto;
        width: 100%;
      }
    }

    .secao {
      margin: 0 0 var(--ce-space-2);
      font-family: var(--ce-font-family-titulo);
      font-size: var(--ce-font-lg);
    }

    .cartao {
      background: var(--ce-surface);
      border: 1px solid var(--ce-border);
      border-radius: 20px;
      padding: var(--ce-space-4);
    }

    .extrato {
      list-style: none;
      margin: 0;
      display: flex;
      flex-direction: column;
    }

    .linha {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 60px;
      padding: 8px 4px;
      border-bottom: 1px solid var(--ce-border);

      &:last-child {
        border-bottom: 0;
      }
    }

    .linha__meio {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .icone-tipo {
      display: grid;
      place-items: center;
      flex: none;
      width: 40px;
      height: 40px;
      border-radius: 12px;
    }

    .icone-tipo.pago {
      background: var(--ce-pago-soft);
      color: var(--ce-pago);
    }

    .icone-tipo.fiado {
      background: var(--ce-fiado-soft);
      color: var(--ce-fiado);
    }

    .valor {
      font-family: var(--ce-font-family-titulo);
      font-weight: 700;
      @include mixins.tabular-numbers;
    }

    .valor.pago {
      color: var(--ce-pago);
    }

    .valor.fiado {
      color: var(--ce-fiado);
    }

    .carregando {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    .obs {
      font-size: var(--ce-font-sm);
      font-weight: 400;
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
  private readonly sheet = inject(SheetService);
  private readonly toast = inject(ToastService);
  private readonly preco = new PrecoPipe();
  protected readonly conta = inject(ContaCorrenteStore);

  protected readonly funcionario = signal<FuncionarioResponse | null>(null);
  protected readonly erroCarga = signal(false);
  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly rotulo = (t: TipoLancamentoFuncionario) => ROTULOS[t];
  protected readonly absoluto = Math.abs;
  protected readonly desktop = toSignal(
    inject(BreakpointObserver)
      .observe('(min-width: 960px)')
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => void this.carregar(id));
    });
  }

  protected primeiroNome(): string {
    return this.funcionario()?.nome.trim().split(/\s+/)[0] ?? '';
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
    const f = this.funcionario();
    if (!f) {
      return;
    }
    const ref = this.sheet.abrir<LancarSheetResultado, LancarSheetDados>(LancarSheet, {
      funcionarioId: this.id(),
      nome: f.nome,
      tipo,
      saldo: this.conta.saldoAPagar(),
    });
    const saldo = await firstValueFrom(ref.closed);
    if (saldo !== undefined) {
      this.toast.success(`Saldo agora ${this.preco.transform(saldo)}`);
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
