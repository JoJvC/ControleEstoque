import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';

import { Button } from '../../ui/atoms/button';
import { Spinner } from '../../ui/atoms/spinner';
import { EmptyState } from '../../ui/molecules/empty-state';
import { AppHeader } from '../../ui/organisms/app-header';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
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
                @if (venda.cupomEmitido) {
                  · Cupom emitido
                }
              </p>
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

            <section class="venda-detalhe__acoes" data-testid="venda-acoes"></section>
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

  protected voltar(): void {
    this.router.navigateByUrl('/vendas');
  }
}
