import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ClientesApi } from '../../core/api/clientes-api';
import { FinanceiroApi } from '../../core/api/financeiro-api';
import { DetalheCaixa, FechamentoResponse } from '../../core/api/models/financeiro';
import { VendaDetalheResponse } from '../../core/api/models/vendas';
import { VendasApi } from '../../core/api/vendas-api';
import { ApiError } from '../../core/http/api-error';
import { OperatorStore } from '../../core/operator/operator-store';
import { SheetService } from '../../core/overlay/sheet-service';
import { CePermissao } from '../../core/permissions/ce-permissao';
import { hojeLocal } from '../../core/util/data-local';
import { Button } from '../../ui/atoms/button';
import { Skeleton } from '../../ui/atoms/skeleton';
import { EmptyState } from '../../ui/molecules/empty-state';
import { AppHeader } from '../../ui/organisms/app-header';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { rotuloForma } from '../vendas/venda-rotulos';
import { DespesaSheet, DespesaSheetDados } from './despesa-sheet';
import { FechamentoSheet, FechamentoSheetDados } from './fechamento-sheet';
import { LancarDiariasSheet, LancarDiariasSheetDados } from './lancar-diarias-sheet';
import { modoDoCaixa } from './modo-do-caixa';
import { ReabrirCaixaSheet, ReabrirCaixaSheetDados } from './reabrir-caixa-sheet';

@Component({
  selector: 'ce-caixa-detalhe-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeader, Button, CePermissao, DatePipe, EmptyState, PrecoPipe, Skeleton],
  template: `
    <ce-app-header
      [titulo]="detalhe() ? 'Caixa de ' + dataBr() : 'Caixa'"
      [rotulo]="modo() === 'reaberto' ? 'Caixa reaberto' : null"
      [mostrarVoltar]="true"
      (voltar)="voltar()"
    />

    <div class="conteudo">
      @switch (status()) {
        @case ('error') {
          <ce-empty-state icone="alerta" titulo="Não foi possível carregar o caixa">
            <ce-button variante="ghost" (click)="carregar()">Tentar de novo</ce-button>
          </ce-empty-state>
        }
        @case ('ok') {
          @if (detalhe(); as d) {
            <section class="cartao">
              <p class="linha-status">
                {{ d.status === 'ABERTO' ? 'Aberto' : 'Fechado' }}
                @if (modo() === 'reaberto') {
                  · Caixa reaberto
                }
              </p>
              @if (d.abertura; as a) {
                <p class="secundario">
                  Aberto
                  @if (a.por) {
                    por {{ a.por.nome }}
                  }
                  em {{ a.em | date: 'dd/MM/yyyy HH:mm' }}
                </p>
              }
              @if (d.fechamento; as f) {
                <p class="secundario">
                  @if (f.pelaSistema) {
                    Fechado pelo sistema à meia-noite
                  } @else {
                    Fechado
                    @if (f.por) {
                      por {{ f.por.nome }}
                    }
                    @if (f.em) {
                      em {{ f.em | date: 'dd/MM/yyyy HH:mm' }}
                    }
                  }
                </p>
              }
              <dl class="resumo">
                <dt>Saldo inicial</dt>
                <dd>{{ d.saldoInicial | cePreco }}</dd>
                <dt>Entradas</dt>
                <dd>{{ d.totalEntradas | cePreco }}</dd>
                <dt>Saídas</dt>
                <dd>{{ d.totalSaidas | cePreco }}</dd>
                <dt>Saldo final</dt>
                <dd>{{ d.saldoFinal | cePreco }}</dd>
                <dt>Dinheiro na gaveta</dt>
                <dd>{{ d.dinheiroNaGaveta | cePreco }}</dd>
              </dl>
              @for (t of d.totaisPorForma; track t.forma) {
                <p class="forma">
                  <span>{{ rotuloForma(t.forma) }}</span> <b>{{ t.valor | cePreco }}</b>
                </p>
              }
            </section>

            <div class="acoes">
              @if (d.status === 'FECHADO') {
                <ce-button *cePermissao="'caixa.reabrir'" (click)="reabrir()"
                  >Reabrir caixa</ce-button
                >
              }
              @if (d.fechamento?.pelaSistema && d.diarias.pendentes) {
                <ce-button (click)="lancarDiarias()">Lançar diárias</ce-button>
              }
              @if (modo() === 'reaberto') {
                <ce-button *cePermissao="'vendas.registrar'" (click)="novaVenda()"
                  >Nova venda neste caixa</ce-button
                >
                <ce-button variante="ghost" (click)="lancarDespesa()">Lançar despesa</ce-button>
                <ce-button *cePermissao="'caixa.fechar'" (click)="fechar()">Fechar caixa</ce-button>
              }
            </div>

            @if (erroAcao(); as mensagem) {
              <p class="erro" role="alert">{{ mensagem }}</p>
            }

            <section>
              <h2 class="titulo">Diárias</h2>
              @for (x of d.diarias.lancadas; track x.funcionarioId) {
                <p class="forma">
                  <span>{{ x.funcionarioNome }}</span> <b>{{ x.valor | cePreco }}</b>
                </p>
              }
              @if (d.diarias.pendentes) {
                <p class="vazio">Diárias pendentes.</p>
              } @else if (d.diarias.lancadas.length === 0) {
                <p class="vazio">Nenhuma diária lançada.</p>
              }
            </section>

            <div class="secoes">
              <section>
                <h2 class="titulo">Entradas</h2>
                @for (e of d.entradas; track $index) {
                  <p class="forma">
                    <span
                      >{{ e.hora | date: 'HH:mm' }} · {{ e.clienteNome }} ·
                      {{ e.origem === 'VENDA' ? 'Venda' : 'Recebimento de fiado' }} ·
                      {{ rotuloForma(e.forma) }}</span
                    >
                    <b>{{ e.valor | cePreco }}</b>
                  </p>
                } @empty {
                  <p class="vazio">Nenhuma entrada.</p>
                }
              </section>
              <section>
                <h2 class="titulo">Saídas</h2>
                @for (s of d.saidas; track $index) {
                  <p class="forma">
                    <span
                      >{{ s.hora | date: 'HH:mm' }} · {{ s.descricao }} ·
                      {{ rotuloForma(s.forma) }}</span
                    >
                    <b>{{ s.valor | cePreco }}</b>
                  </p>
                } @empty {
                  <p class="vazio">Nenhuma saída.</p>
                }
              </section>
            </div>

            <section>
              <h2 class="titulo">Vendas deste caixa</h2>
              @if (statusVendas() === 'error') {
                <p class="erro" role="alert">Não foi possível carregar as vendas.</p>
              }
              @for (v of vendas(); track v.id) {
                <div class="venda">
                  <span class="venda__info">
                    {{ v.data | date: 'HH:mm' }} · {{ nomes().get(v.clienteId) ?? 'Cliente' }}
                  </span>
                  <b>{{ v.totalLiquido | cePreco }}</b>
                  @if (modo() !== 'fechado') {
                    <span class="venda__acoes">
                      @if (!v.cupomEmitido) {
                        <ce-button
                          *cePermissao="'vendas.editar'"
                          variante="ghost"
                          (click)="editar(v)"
                          >Editar</ce-button
                        >
                      }
                      <ce-button
                        *cePermissao="'vendas.cancelar'"
                        variante="ghost"
                        (click)="cancelar(v)"
                        >Cancelar</ce-button
                      >
                    </span>
                  }
                </div>
              } @empty {
                @if (statusVendas() === 'ok') {
                  <p class="vazio">Nenhuma venda neste dia.</p>
                }
              }
            </section>
          }
        }
        @default {
          <div class="carregando" aria-busy="true">
            <ce-skeleton altura="96px" />
            <ce-skeleton altura="96px" />
          </div>
        }
      }
    </div>
  `,
  styles: `
    @use 'mixins';

    .conteudo,
    .carregando,
    .cartao {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .conteudo {
      @include mixins.safe-area-bottom(var(--ce-space-6));

      padding: var(--ce-space-4);

      @include mixins.from-desktop {
        padding: 24px 32px 32px;
        max-width: 1180px;
      }
    }

    .cartao {
      padding: var(--ce-space-3) var(--ce-space-4);
      border-radius: 20px;
      background: var(--ce-surface);

      p {
        margin: 0;
      }
    }

    .linha-status {
      font-family: var(--ce-font-family-titulo);
      font-weight: 700;
    }

    .resumo {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--ce-space-1) var(--ce-space-3);
      margin: 0;

      dd {
        margin: 0;
        text-align: right;
        font-weight: 600;
        @include mixins.tabular-numbers;
      }
    }

    .acoes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ce-space-2);
    }

    .secoes {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);

      @include mixins.from-desktop {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 28px;
        align-items: start;
      }
    }

    .titulo {
      font-size: var(--ce-font-lg);
      margin-bottom: var(--ce-space-2);
    }

    .forma,
    .venda {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ce-space-3);
      margin: 0 0 var(--ce-space-1);
      @include mixins.tabular-numbers;
    }

    .venda {
      padding: var(--ce-space-2) var(--ce-space-3);
      border-radius: 20px;
      background: var(--ce-surface);
    }

    .venda__info {
      flex: 1;
      min-width: 0;
    }

    .venda__acoes {
      display: flex;
      gap: var(--ce-space-1);
    }

    .secundario,
    .vazio {
      margin: 0;
      color: var(--ce-text-muted);
      font-size: var(--ce-font-sm);
    }

    .erro {
      margin: 0;
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class CaixaDetalhePage implements OnInit {
  /** Param de rota `:id`, pelo withComponentInputBinding. */
  readonly id = input.required<string>();

  private readonly api = inject(FinanceiroApi);
  private readonly vendasApi = inject(VendasApi);
  private readonly clientesApi = inject(ClientesApi);
  private readonly sheet = inject(SheetService);
  private readonly router = inject(Router);
  private readonly operador = inject(OperatorStore);

  protected readonly status = signal<'loading' | 'ok' | 'error'>('loading');
  protected readonly detalhe = signal<DetalheCaixa | null>(null);
  protected readonly statusVendas = signal<'loading' | 'ok' | 'error'>('loading');
  protected readonly vendas = signal<readonly VendaDetalheResponse[]>([]);
  protected readonly nomes = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly erroAcao = signal<string | null>(null);

  protected readonly modo = computed(() => {
    const d = this.detalhe();
    return d ? modoDoCaixa(d.status, d.data, hojeLocal()) : null;
  });
  protected readonly dataBr = computed(() => {
    const [a, m, d] = (this.detalhe()?.data ?? '').split('-');
    return `${d}/${m}/${a}`;
  });
  protected readonly rotuloForma = rotuloForma;

  /** O `id` da rota só está disponível depois da criação (withComponentInputBinding). */
  ngOnInit(): void {
    void this.carregar();
  }

  protected async carregar(): Promise<void> {
    try {
      const d = await firstValueFrom(this.api.obterDetalheCaixa(this.id()));
      this.detalhe.set(d);
      this.status.set('ok');
      await this.carregarVendas(d.data);
    } catch {
      // 0/5xx já viram toast no interceptor; recarga com a tela montada mantém o detalhe antigo
      if (!this.detalhe()) {
        this.status.set('error');
      }
    }
  }

  /** As entradas do detalhe não trazem o id da venda: as ações ficam nas vendas do dia (primeira página, 200). */
  private async carregarVendas(data: string): Promise<void> {
    this.statusVendas.set('loading');
    try {
      const vendas = await firstValueFrom(
        this.vendasApi.listar({ inicio: data, fim: data, pageSize: 200 }),
      );
      this.vendas.set(vendas);
      this.statusVendas.set('ok');
      await this.resolverNomes(vendas);
    } catch {
      this.statusVendas.set('error');
    }
  }

  /** Um GET por cliente ainda sem nome; falha deixa a linha como 'Cliente'. */
  private async resolverNomes(vendas: readonly VendaDetalheResponse[]): Promise<void> {
    const faltam = [...new Set(vendas.map((v) => v.clienteId))].filter(
      (id) => !this.nomes().has(id),
    );
    await Promise.all(
      faltam.map(async (id) => {
        try {
          const c = await firstValueFrom(this.clientesApi.obter(id));
          this.nomes.update((atual) => new Map(atual).set(id, c.nome));
        } catch {
          // fica sem nome
        }
      }),
    );
  }

  protected voltar(): void {
    void this.router.navigateByUrl('/financeiro/caixas');
  }

  private async abrirSheet<R, D>(
    componente: Parameters<SheetService['abrir']>[0],
    dados: D,
  ): Promise<R | undefined> {
    const ref = this.sheet.abrir<R, D>(componente, dados);
    return firstValueFrom(ref.closed);
  }

  protected async reabrir(): Promise<void> {
    const ok = await this.abrirSheet<boolean, ReabrirCaixaSheetDados>(ReabrirCaixaSheet, {
      caixaId: this.id(),
    });
    if (ok) {
      await this.carregar();
    }
  }

  protected async lancarDiarias(): Promise<void> {
    const ok = await this.abrirSheet<boolean, LancarDiariasSheetDados>(LancarDiariasSheet, {
      caixaId: this.id(),
    });
    if (ok) {
      await this.carregar();
    }
  }

  protected novaVenda(): void {
    const d = this.detalhe();
    if (!d) {
      return;
    }
    void this.router.navigate(['/vendas/nova'], {
      queryParams: { caixa: d.id, dataCaixa: d.data },
    });
  }

  protected async lancarDespesa(): Promise<void> {
    await this.abrirSheet<boolean, DespesaSheetDados>(DespesaSheet, { caixaId: this.id() });
    // com ou sem resultado: um CAIXA_FECHADO do servidor leva a tela ao estado FECHADO
    await this.carregar();
  }

  /** O resumo vem direto da API: o CaixaStore guarda o caixa de hoje e não pode trocar por um antigo. */
  protected async fechar(): Promise<void> {
    const d = this.detalhe();
    if (!d) {
      return;
    }
    this.erroAcao.set(null);
    try {
      const resumo = await firstValueFrom(this.api.obterResumoCaixa(d.data));
      await this.abrirSheet<FechamentoResponse, FechamentoSheetDados>(FechamentoSheet, {
        caixaId: d.id,
        resumo,
      });
      await this.carregar();
    } catch (e) {
      this.tratarErro(e);
    }
  }

  protected editar(v: VendaDetalheResponse): void {
    void this.router.navigateByUrl(`/vendas/editar/${v.id}`);
  }

  protected async cancelar(v: VendaDetalheResponse): Promise<void> {
    const funcionarioId = this.operador.operator()?.id;
    if (!funcionarioId) {
      this.erroAcao.set('Selecione o operador para cancelar a venda.');
      return;
    }
    const confirmado = await this.sheet.confirmar({
      titulo: 'Cancelar venda',
      mensagem: `Cancelar a venda de ${this.nomes().get(v.clienteId) ?? 'cliente'}? Esta ação não pode ser desfeita.`,
      confirmarLabel: 'Cancelar venda',
      perigo: true,
    });
    if (!confirmado) {
      return;
    }
    this.erroAcao.set(null);
    try {
      await firstValueFrom(this.vendasApi.cancelar(v.id, { funcionarioId }));
      await this.carregar();
    } catch (e) {
      this.tratarErro(e);
    }
  }

  /** Rede/5xx já viraram toast no interceptor; 4xx (CAIXA_FECHADO, 403, 422) fica inline. */
  private tratarErro(e: unknown): void {
    if (!(e instanceof ApiError)) {
      throw e;
    }
    if (e.status >= 400 && e.status < 500) {
      this.erroAcao.set(e.userMessage);
    }
  }
}
