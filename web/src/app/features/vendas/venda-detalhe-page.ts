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
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { VendaDetalheResponse } from '../../core/api/models/vendas';
import { ApiError } from '../../core/http/api-error';
import { SheetService } from '../../core/overlay/sheet-service';
import { PrintService } from '../../core/platform/print-service';
import { Button } from '../../ui/atoms/button';
import { Spinner } from '../../ui/atoms/spinner';
import { EmptyState } from '../../ui/molecules/empty-state';
import { AppHeader } from '../../ui/organisms/app-header';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { saldoAPagar } from './carrinho';
import { cupomHtml } from './cupom-html';
import { PagamentoSheet, PagamentoSheetDados, PagamentoSheetResultado } from './pagamento-sheet';
import { VendaStore } from './venda-store';
import { rotuloCliente, rotuloForma, rotuloProduto, rotuloStatusPagamento } from './venda-rotulos';

@Component({
  selector: 'ce-venda-detalhe-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, AppHeader, Button, EmptyState, PrecoPipe, Spinner],
  template: `
    <ce-app-header titulo="Venda" />

    <div class="conteudo">
      @switch (store.statusDetalhe()) {
        @case ('error') {
          <ce-empty-state
            icone="alerta"
            titulo="Não foi possível carregar a venda"
            [descricao]="store.erroDetalhe() ?? 'Verifique a conexão e tente novamente.'"
          />
        }
        @case ('ok') {
          @if (store.detalhe(); as venda) {
            <section class="bloco">
              <p class="cliente">{{ rotuloCliente(store.clientes().get(venda.clienteId)) }}</p>
              <p class="meta">{{ venda.data | date: 'dd/MM/yyyy HH:mm' }}</p>
              <p class="meta">
                {{ rotuloStatusPagamento(venda.statusPagamento) }}
                @if (saldoAPagar(venda.totalLiquido, venda.pagamentos) > 0) {
                  · Saldo a pagar
                  {{ saldoAPagar(venda.totalLiquido, venda.pagamentos) | cePreco }}
                }
              </p>
              @if (venda.cupomEmitido) {
                <p class="meta" data-testid="venda-cupom">
                  Cupom fiscal nº {{ venda.cupomNumero }}
                  @if (venda.cupomEmitidoEm; as emitidoEm) {
                    · {{ emitidoEm | date: 'dd/MM/yyyy HH:mm' }}
                  }
                </p>
              }
              @if (venda.observacao) {
                <p class="meta">{{ venda.observacao }}</p>
              }
            </section>

            <section class="bloco">
              <h2>Itens</h2>
              <ul class="linhas">
                @for (item of venda.itens; track $index) {
                  <li class="linha">
                    <span>
                      {{ rotuloProduto(store.produtos().get(item.produtoId)) }}
                      <span class="meta"
                        >{{ item.quantidade }} × {{ item.precoUnitario | cePreco }}</span
                      >
                      @if (item.descontoValor !== null) {
                        <span class="meta">
                          Desconto
                          {{
                            item.descontoTipo === 'PERCENTUAL'
                              ? item.descontoValor + '%'
                              : (item.descontoValor | cePreco)
                          }}
                          @if (item.motivoDesconto) {
                            — {{ item.motivoDesconto }}
                          }
                        </span>
                      }
                    </span>
                    <span class="valor">{{ item.totalItem | cePreco }}</span>
                  </li>
                }
              </ul>
            </section>

            <section class="bloco">
              <h2>Pagamentos</h2>
              <ul class="linhas">
                @for (p of venda.pagamentos; track $index) {
                  <li class="linha">
                    <span>{{ rotuloForma(p.forma) }}</span>
                    <span class="valor">{{ p.valor | cePreco }}</span>
                  </li>
                } @empty {
                  <li class="meta">Nenhum pagamento registrado.</li>
                }
              </ul>
            </section>

            <dl class="bloco totais">
              <div class="linha">
                <dt>Bruto</dt>
                <dd>{{ venda.totalBruto | cePreco }}</dd>
              </div>
              <div class="linha">
                <dt>Desconto</dt>
                <dd>{{ venda.totalDesconto | cePreco }}</dd>
              </div>
              <div class="linha total">
                <dt>Líquido</dt>
                <dd>{{ venda.totalLiquido | cePreco }}</dd>
              </div>
            </dl>

            <section class="venda-detalhe__acoes" data-testid="venda-acoes">
              <ce-button (click)="editar()">Editar</ce-button>
              @if (saldoAPagar(venda.totalLiquido, venda.pagamentos) > 0) {
                <ce-button (click)="adicionarPagamento(venda)">Adicionar pagamento</ce-button>
              }
              @if (venda.cupomEmitido) {
                <ce-button variante="ghost" (click)="imprimir(venda)">Imprimir cupom</ce-button>
              } @else {
                <ce-button
                  variante="ghost"
                  [loading]="emitindoCupom()"
                  (click)="emitirCupom(venda)"
                >
                  Emitir cupom fiscal
                </ce-button>
              }
              @if (erroCupom(); as mensagem) {
                <p class="erro" role="alert">{{ mensagem }}</p>
              }
            </section>
          }
        }
        @default {
          <div class="carregando" aria-busy="true"><ce-spinner /></div>
        }
      }

      <ce-button variante="ghost" (click)="voltar()">Voltar</ce-button>
    </div>
  `,
  styles: `
    .conteudo {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-4);
      padding: var(--ce-space-4);
    }

    .bloco {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-1);
    }

    .cliente {
      font-size: var(--ce-font-lg);
      font-weight: 600;
    }

    .meta {
      display: block;
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    .linhas {
      list-style: none;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    .linha {
      display: flex;
      justify-content: space-between;
      gap: var(--ce-space-3);
    }

    .valor,
    .total {
      font-weight: 600;
    }

    .venda-detalhe__acoes {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--ce-space-2);
    }

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }

    .carregando {
      display: flex;
      justify-content: center;
    }
  `,
})
export class VendaDetalhePage {
  /** Route param (:id). */
  readonly id = input.required<string>();

  protected readonly store = inject(VendaStore);
  private readonly router = inject(Router);
  private readonly sheet = inject(SheetService);
  private readonly print = inject(PrintService);

  protected readonly emitindoCupom = signal(false);
  protected readonly erroCupom = signal<string | null>(null);
  protected readonly saldoAPagar = saldoAPagar;

  protected readonly rotuloCliente = rotuloCliente;
  protected readonly rotuloForma = rotuloForma;
  protected readonly rotuloProduto = rotuloProduto;
  protected readonly rotuloStatusPagamento = rotuloStatusPagamento;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.store.obter(id));
    });
  }

  protected editar(): void {
    this.router.navigateByUrl('/vendas/editar/' + this.id());
  }

  // O sheet faz o POST pelo store, que já recarrega o detalhe (Regra 8.6).
  protected async adicionarPagamento(venda: VendaDetalheResponse): Promise<void> {
    const ref = this.sheet.abrir<PagamentoSheetResultado, PagamentoSheetDados>(PagamentoSheet, {
      vendaId: venda.id,
      saldo: saldoAPagar(venda.totalLiquido, venda.pagamentos),
    });
    await firstValueFrom(ref.closed);
  }

  protected async emitirCupom(venda: VendaDetalheResponse): Promise<void> {
    this.emitindoCupom.set(true);
    this.erroCupom.set(null);
    try {
      const cupom = await this.store.emitirCupom(venda.id);
      this.imprimir({
        ...venda,
        cupomEmitido: true,
        cupomNumero: cupom.numero,
        cupomEmitidoEm: cupom.emitidoEm,
      });
    } catch (e) {
      if (!(e instanceof ApiError)) {
        throw e;
      }
      if (e.status === 409 && e.code === 'CUPOM_JA_EMITIDO') {
        // Mostra o cupom que já existe, sem erro e sem imprimir sozinho.
        this.store.obter(venda.id);
      } else {
        this.erroCupom.set(e.userMessage);
      }
    } finally {
      this.emitindoCupom.set(false);
    }
  }

  protected imprimir(venda: VendaDetalheResponse): void {
    this.print.printHtml(
      `Cupom fiscal ${venda.cupomNumero}`,
      cupomHtml(venda, this.store.produtos()),
    );
  }

  protected voltar(): void {
    this.router.navigateByUrl('/vendas');
  }
}
