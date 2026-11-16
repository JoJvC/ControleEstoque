import { BreakpointObserver } from '@angular/cdk/layout';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom, forkJoin, map } from 'rxjs';

import { ClientesApi } from '../../core/api/clientes-api';
import { EstoqueApi } from '../../core/api/estoque-api';
import { classificarSaldo, rotuloSaldo } from '../clientes/saldo-cliente';
import { ClienteResponse, EnderecoResponse } from '../../core/api/models/clientes';
import { SaldosResponse } from '../../core/api/models/clientes';
import {
  ProdutoMarcaResponse,
  ProdutoResponse,
  TipoCascoResponse,
} from '../../core/api/models/estoque';
import { rotuloDaMarca } from '../../core/api/produto-leitura';
import { StatusPagamento, VendaDetalheResponse, VendaResponse } from '../../core/api/models/vendas';
import { VendasApi } from '../../core/api/vendas-api';
import { ApiError } from '../../core/http/api-error';
import { OperatorStore } from '../../core/operator/operator-store';
import { SheetService } from '../../core/overlay/sheet-service';
import { Badge } from '../../ui/atoms/badge';
import { Button } from '../../ui/atoms/button';
import { Chip } from '../../ui/atoms/chip';
import { Icon, IconeNome } from '../../ui/atoms/icon';
import { iconeDoProduto } from '../../ui/atoms/icone-do-produto';
import { QuantityStepper } from '../../ui/molecules/quantity-stepper';
import { SearchBox } from '../../ui/molecules/search-box';
import { AppHeader } from '../../ui/organisms/app-header';
import { DataList, DataListStatus } from '../../ui/organisms/data-list';
import { PagamentoEdicao } from '../../ui/organisms/pagamento-lista';
import { PassoAPasso } from '../../ui/organisms/passo-a-passo';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import {
  ItemCarrinho,
  abatidaDe,
  categoriasDe,
  fiadoDe,
  filtrarPorCategoria,
  itemNovo,
  itensDaUltimaVenda,
  mesmoItem,
  paraCreateVendaRequest,
  rascunhoDeVenda,
  totaisDe,
  totalItemDe,
  totalPagoDe,
  totalVasilhameDe,
  totalVasilhamesDe,
  vasilhameNovo,
  vasilhamesPorTipo,
  valorDoAtalho,
  valorDescontoDe,
  VasilhameCarrinho,
} from './carrinho';
import {
  LinhaLista,
  LinhaProduto,
  SugestaoBusca,
  ehVasilhame,
  filtrarPorSugestao,
  filtrarPorTexto,
  linhasDeVasilhame,
  linhasDoCatalogo,
  sugestoesDaBusca,
} from './busca-produto';
import {
  QuantidadesPorTipo,
  descontoSucataDe,
  linhasCascoPorTipo,
  previaCascoDoTipo,
  cascosComEle,
  cascosAFavor,
  quantidadeDevolvida,
  sucataExcede,
  tiposCascoDoCarrinho,
} from './cascos-por-tipo';
import {
  CascoTipoEstado,
  CobrarAcao,
  CobrarEstado,
  CobrarPainel,
  VasilhameEstado,
} from './cobrar-painel';
import { ItemVendaSheet, ItemVendaSheetDados, ItemVendaSheetResultado } from './item-venda-sheet';
import { PassoCascos } from './passo-cascos';
import { PassoPagamento } from './passo-pagamento';
import { ROTULO_PASSO, passosDaVenda, podeAvancarPasso } from './passos-venda';
import { VendaStore } from './venda-store';
import { creditoNaEdicao, limitarPagamentos } from './pagamento-credito';
import { rotuloStatusPagamento } from './venda-rotulos';

// Uma forma já escolhida, sem valor (protótipo): "Tudo fiado" a limpa e a venda sem valor vai toda para fiado.
const PAGAMENTO_PADRAO: readonly PagamentoEdicao[] = [{ forma: 'DINHEIRO', valor: null }];

@Component({
  selector: 'ce-pdv-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    AppHeader,
    Badge,
    Button,
    Chip,
    CobrarPainel,
    DataList,
    Icon,
    NgTemplateOutlet,
    PassoAPasso,
    PassoCascos,
    PassoPagamento,
    PrecoPipe,
    QuantityStepper,
    SearchBox,
  ],
  template: `
    <ce-app-header [titulo]="id() ? 'Editar venda' : 'Nova venda'" [fixo]="false" />
    @if (caixaDeLancamento()) {
      <p class="faixa-caixa" role="status">Lançando no caixa de {{ rotuloDataCaixa() }}</p>
    }

    <div class="conteudo">
      @if (venda(); as v) {
        <section class="sucesso" aria-label="Venda registrada">
          <h2>Venda registrada</h2>
          <ce-badge [cor]="v.statusPagamento === 'PAGA' ? 'success' : 'warning'">{{
            rotuloStatus(v.statusPagamento)
          }}</ce-badge>
          <p class="sucesso__total">{{ v.totalLiquido | cePreco }}</p>
          <p class="dica">{{ clienteSelecionado()?.nome }} · pago {{ v.totalPago | cePreco }}</p>
          <p class="dica">Saldos devolvidos pelo servidor, cada um na sua unidade:</p>
          <dl class="resumo">
            <div class="resumo__linha">
              <dt>Saldo de cascos do cliente</dt>
              <dd>{{ v.saldoCascoCliente }}</dd>
            </div>
            @if (saldos(); as s) {
              <div class="resumo__linha resumo__linha--fiado">
                <dt>Fiado do cliente</dt>
                <dd>{{ s.saldoFiado | cePreco }}</dd>
              </div>
            }
            <div class="resumo__linha resumo__linha--fiado">
              <dt>Fiado gerado</dt>
              <dd>{{ v.saldoFiadoGerado | cePreco }}</dd>
            </div>
          </dl>
          <ce-button [block]="true" (click)="reiniciar()">Nova venda</ce-button>
          @if (cupom(); as c) {
            <p class="cupom">Cupom fiscal nº {{ c.numero }}</p>
          } @else {
            <ce-button
              variante="ghost"
              [block]="true"
              [loading]="emitindoCupom()"
              (click)="emitirCupom(v.id)"
            >
              Emitir cupom fiscal
            </ce-button>
          }
          @if (erroCupom(); as mensagem) {
            <p class="erro" role="alert">{{ mensagem }}</p>
          }
          <ce-button variante="ghost" [block]="true" (click)="voltarAoHoje()">
            {{ caixaDeLancamento() ? 'Voltar ao caixa' : 'Voltar ao Hoje' }}
          </ce-button>
        </section>
      } @else if (carga() === 'carregando') {
        <p class="dica">Carregando venda…</p>
      } @else if (carga() === 'erro') {
        <p class="erro" role="alert">{{ erroCarga() }}</p>
      } @else {
        @if (somenteLeitura()) {
          <p class="erro" role="alert" data-testid="venda-somente-leitura">
            Venda com cupom emitido não pode ser editada.
          </p>
        }
        <div
          class="venda"
          [class.venda--desktop]="desktop()"
          [attr.inert]="somenteLeitura() ? '' : null"
        >
          <div class="grade">
            @if (emPassos()) {
              <ce-passo-a-passo
                [passos]="rotulosDosPassos()"
                [atual]="passoAtual()"
                [podeAvancar]="podeAvancarNoPasso()"
                [rotuloFinal]="cobrarEstado().rotuloConfirmar"
                [carregando]="enviando()"
                (voltar)="voltarPasso()"
                (avancar)="avancarPasso()"
                (concluir)="registrar()"
              >
                <ng-container resumo>
                  <small>
                    {{ rotuloItens() }}
                    @if (totais().desconto > 0) {
                      · desc. {{ totais().desconto | cePreco }}
                    }
                  </small>
                  <strong>{{ totais().liquido | cePreco }}</strong>
                </ng-container>
                @switch (passosAtivos()[passoAtual()]) {
                  @case ('cascos') {
                    <ce-passo-cascos [estado]="cobrarEstado()" (acao)="agir($event)" />
                  }
                  @case ('pagamento') {
                    <ce-passo-pagamento [estado]="cobrarEstado()" (acao)="agir($event)" />
                  }
                  @default {
                    <ng-container *ngTemplateOutlet="tplCliente" />
                    <ng-container *ngTemplateOutlet="tplCatalogo" />
                  }
                }
              </ce-passo-a-passo>
            } @else {
              <div class="grade__catalogo">
                <ng-container *ngTemplateOutlet="tplCliente" />
                <ng-container *ngTemplateOutlet="tplCatalogo" />
              </div>
            }
            @if (desktop()) {
              <aside class="grade__venda" aria-label="Venda atual">
                <h2 class="grade__titulo">
                  Venda
                  @if (quantidadeTotal() > 0) {
                    <span class="dica">· {{ rotuloItens() }}</span>
                  }
                </h2>
                @if (clienteSelecionado() && !carrinhoVazio()) {
                  <ce-cobrar-painel [estado]="cobrarEstado()" (acao)="agir($event)" />
                } @else {
                  <p class="dica">
                    {{
                      clienteSelecionado()
                        ? 'Toque nos produtos para montar a venda.'
                        : 'Escolha o cliente e os produtos. O total aparece aqui, ao vivo.'
                    }}
                  </p>
                  <p class="grade__total">
                    <span>Total</span>
                    <strong>{{ totais().liquido | cePreco }}</strong>
                  </p>
                }
              </aside>
            }
          </div>

          @if (!id()) {
            <ce-button variante="ghost" (click)="cancelar()">Cancelar venda</ce-button>
          }
        </div>
      }
    </div>

    <ng-template #tplCliente>
      @if (clienteSelecionado(); as c) {
        <section class="cliente-fixo" aria-label="Cliente da venda">
          <div class="cliente-fixo__linha">
            <strong class="cliente-fixo__nome">{{ c.nome }}</strong>
            <ce-button variante="ghost" (click)="trocarCliente()">Trocar</ce-button>
          </div>
          @if (saldos(); as s) {
            <div class="cliente-fixo__chips">
              <button
                type="button"
                class="chip-botao"
                [attr.aria-expanded]="cascosAbertos()"
                (click)="cascosAbertos.set(!cascosAbertos())"
              >
                <ce-chip tom="casco" icone="casco"
                  >Casco {{ cascosComEle(s.cascosPorTipo)
                  }}{{
                    cascosAFavor(s.cascosPorTipo)
                      ? ' · ' + cascosAFavor(s.cascosPorTipo) + ' a favor'
                      : ''
                  }}</ce-chip
                >
              </button>
              @let saldo = classificarSaldo(s.saldo);
              <ce-chip [tom]="saldo.tom" icone="dinheiro">{{ rotuloSaldo(saldo) }}</ce-chip>
            </div>
            @if (cascosAbertos()) {
              <ul class="casco-lista" aria-label="Cascos por tipo">
                @for (linha of cascosComSaldo(); track linha) {
                  <li>{{ linha }}</li>
                } @empty {
                  <li>Nenhum casco com ele.</li>
                }
              </ul>
            }
          }
          @if (podeRepetir()) {
            <button
              type="button"
              class="repetir"
              [disabled]="repetir().estado === 'carregando'"
              (click)="repetirUltimaVenda()"
            >
              <ce-icon nome="atualizar" [tamanho]="18" />
              {{ repetir().estado === 'carregando' ? 'Carregando…' : 'Repetir última venda' }}
            </button>
          }
          @let r = repetir();
          @if (r.estado === 'sem-venda') {
            <p class="dica" role="status">Este cliente ainda não tem venda anterior.</p>
          } @else if (r.estado === 'erro') {
            <p class="erro" role="alert">{{ r.mensagem }}</p>
          } @else if (r.estado === 'pulados') {
            <p class="dica" role="status">
              {{
                r.pulados === 1
                  ? '1 item da última venda não está mais no catálogo e ficou de fora.'
                  : r.pulados +
                    ' itens da última venda não estão mais no catálogo e ficaram de fora.'
              }}
            </p>
          }
        </section>
        @if (c.enderecos.length > 1) {
          <div role="radiogroup" aria-label="Endereço de entrega" class="lista">
            @for (e of c.enderecos; track e.id) {
              <button
                type="button"
                class="opcao"
                role="radio"
                [attr.aria-checked]="enderecoId() === e.id"
                [class.opcao--ativa]="enderecoId() === e.id"
                (click)="enderecoId.set(e.id)"
              >
                {{ enderecoTexto(e) }}
              </button>
            }
          </div>
          @if (enderecoId() === null) {
            <p class="dica">Escolha o endereço de entrega.</p>
          }
        } @else if (c.enderecos.length === 1) {
          <p class="dica">Entrega: {{ enderecoTexto(c.enderecos[0]) }}</p>
        }
      } @else {
        <section class="cliente-vazio" aria-label="Cliente da venda">
          <strong>Quem está comprando?</strong>
          <span class="dica">Escolha o cliente para vender</span>
          <ce-search-box
            rotulo="Buscar cliente"
            placeholder="Buscar cliente por nome…"
            (buscar)="buscarClientes($event)"
            (keydown.enter)="enterCliente($event)"
          />
          @if (erroClientes(); as mensagem) {
            <p class="erro" role="alert">{{ mensagem }}</p>
          }
          <div class="lista">
            @for (c of clientes(); track c.id) {
              <button type="button" class="opcao" (click)="selecionarCliente(c)">
                {{ c.nome }}
                @if (c.telefone) {
                  <span class="dica">{{ c.telefone }}</span>
                }
              </button>
            }
          </div>
        </section>
      }
    </ng-template>

    <ng-template #tplCatalogo>
      <div class="pilulas" role="group" aria-label="Filtrar por categoria">
        <button
          type="button"
          class="pilula"
          [class.pilula--ativa]="categoria() === null"
          [attr.aria-pressed]="categoria() === null"
          (click)="escolherCategoria(null)"
        >
          Todos
        </button>
        @for (c of categorias(); track c) {
          <button
            type="button"
            class="pilula"
            [class.pilula--ativa]="categoria() === c"
            [attr.aria-pressed]="categoria() === c"
            (click)="escolherCategoria(c)"
          >
            {{ c }}
          </button>
        }
      </div>
      <ce-search-box
        rotulo="Buscar produto"
        placeholder="Buscar por nome, marca ou categoria…"
        [valor]="textoBusca()"
        (buscar)="buscarProduto($event)"
        (keydown.enter)="enterProduto($event)"
      />
      @if (sugestoes().length > 0) {
        <ul class="sugestoes" aria-label="Sugestões da busca">
          @for (sugestao of sugestoes(); track sugestao.tipo + sugestao.valor) {
            <li>
              <button type="button" class="sugestao" (click)="escolherSugestao(sugestao)">
                {{ rotuloDaSugestao(sugestao) }}
              </button>
            </li>
          }
        </ul>
      }
      @if (filtroSugestao(); as filtro) {
        <span class="filtro" role="group" aria-label="Filtro da busca">
          {{ rotuloDaSugestao(filtro) }}
          <button type="button" aria-label="Limpar filtro" (click)="limparSugestao()">
            <ce-icon nome="fechar" [tamanho]="16" />
          </button>
        </span>
      }
      <ce-data-list
        [itens]="linhasDeProduto()"
        [status]="produtosStatus()"
        vazioTitulo="Nenhum produto encontrado"
        (recarregar)="carregarProdutos()"
      >
        <ng-template let-linha>
          @if (linha.vasilhame; as tipo) {
            @let rotuloV = 'Vasilhame ' + tipo.nome;
            @let qtd = quantidadeDeVasilhame(tipo.id);
            <div class="prod" [class.prod--sel]="qtd > 0">
              <button
                type="button"
                class="prod__corpo"
                [attr.aria-label]="'Adicionar ' + rotuloV"
                (click)="definirVasilhame(tipo, qtd + 1)"
              >
                <ce-icon class="prod__icone" nome="casco" [tamanho]="32" />
                <span class="prod__info">
                  <span class="prod__nome">{{ rotuloV }}</span>
                  <span class="dica">
                    <span class="prod__preco">{{ tipo.precoVasilhame | cePreco }}</span>
                  </span>
                </span>
              </button>
              @if (qtd > 0) {
                <ce-quantity-stepper
                  [rotulo]="'Quantidade de ' + rotuloV"
                  [item]="rotuloV"
                  [ngModel]="qtd"
                  (ngModelChange)="definirVasilhame(tipo, $event)"
                />
              }
            </div>
          } @else {
            @let p = linha.produto;
            @let item = itemDe(linha);
            @let rotulo = rotuloDaLinha(linha);
            <div class="prod" [class.prod--sel]="item !== undefined">
              <button
                type="button"
                class="prod__corpo"
                [attr.aria-label]="'Adicionar ' + rotulo"
                (click)="mudarQuantidade(linha, (item?.quantidade ?? 0) + 1)"
              >
                <ce-icon class="prod__icone" [nome]="iconeDe(p)" [tamanho]="32" />
                <span class="prod__info">
                  <span class="prod__nome">{{ rotulo }}</span>
                  <span class="dica">
                    @if (p.tamanho) {
                      {{ p.tamanho }} ·
                    }
                    Estoque: {{ linha.marca.quantidade }} ·
                    <span class="prod__preco">{{ precoDe(linha) | cePreco }}</span>
                  </span>
                </span>
              </button>
              @if (item) {
                <ce-quantity-stepper
                  [rotulo]="'Quantidade de ' + rotulo"
                  [item]="rotulo"
                  [ngModel]="item.quantidade"
                  (ngModelChange)="mudarQuantidade(linha, $event)"
                />
                <div class="prod__extra">
                  <button type="button" class="prod__link" (click)="editarPreco(linha)">
                    Preço e desconto
                  </button>
                  @if (item.desconto) {
                    <span class="dica">desc. {{ descontoDe(item) | cePreco }}</span>
                  } @else if (item.precoUnitario !== linha.marca.precoReferencia) {
                    <span class="dica">preço editado</span>
                  }
                  <span class="prod__total">{{ totalDe(item) | cePreco }}</span>
                </div>
              }
            </div>
          }
        </ng-template>
      </ce-data-list>
    </ng-template>
  `,
  styles: `
    @use 'mixins';

    :host {
      display: block;
    }

    .faixa-caixa {
      margin: 0;
      padding: var(--ce-space-2) var(--ce-space-4);
      background: var(--ce-warning-soft);
      color: var(--ce-text);
      font-weight: 600;
    }

    .conteudo {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-4);
      padding: var(--ce-space-4);

      @include mixins.from-tablet {
        max-width: 640px;
        margin-inline: auto;
      }

      @include mixins.from-desktop {
        max-width: 1200px;
      }
    }

    .venda,
    .grade__catalogo,
    .grade__venda {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    // abaixo do header fixo do shell (56 px), que não rola
    .cliente-fixo,
    .cliente-vazio {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
      padding: var(--ce-space-3);
      border-radius: 20px;
      background: var(--ce-surface);
    }

    .cliente-fixo {
      position: sticky;
      top: calc(56px + env(safe-area-inset-top, 0px));
      z-index: 1;
      border: 1px solid var(--ce-border);
    }

    .cliente-vazio {
      border: 2px solid var(--ce-primary);
    }

    .cliente-fixo__linha {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ce-space-2);
    }

    .cliente-fixo__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ce-space-2);
    }

    .pilulas {
      display: flex;
      gap: var(--ce-space-2);
      overflow-x: auto;
    }

    .pilula,
    .sugestao,
    .repetir {
      @include mixins.touch-target;

      flex-shrink: 0;
      padding-inline: var(--ce-space-4);
      border: 1px solid var(--ce-borda-campo);
      border-radius: 999px;
      background: var(--ce-surface);
      font-weight: 600;
    }

    .sugestoes {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ce-space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .filtro {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: var(--ce-space-2);
      padding: var(--ce-space-1) var(--ce-space-3);
      border-radius: 999px;
      background: var(--ce-primary-soft);
      color: var(--ce-primary-strong);
      font-weight: 600;
    }

    .chip-botao {
      padding: 0;
      border: none;
      background: none;
    }

    .casco-lista {
      margin: 0;
      padding-left: var(--ce-space-4);
      color: var(--ce-text-muted);
      font-size: var(--ce-font-sm);
    }

    .repetir {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: var(--ce-space-2);
      background: var(--ce-agua-soft);
      color: var(--ce-acao-texto);
    }

    .pilula--ativa {
      border-color: var(--ce-primary);
      background: var(--ce-primary);
      color: var(--ce-text-on-primary);
    }

    // linha do catálogo: 64 px, toque na linha adiciona, −/+ aparece com o item no carrinho
    .prod {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: var(--ce-space-1) var(--ce-space-3);
      min-height: 64px;
      padding: var(--ce-space-2) var(--ce-space-3);
      border: 1px solid var(--ce-border);
      border-radius: 16px;
      background: var(--ce-surface);
    }

    .prod--sel {
      border: 2px solid var(--ce-primary);
    }

    .prod__corpo {
      display: flex;
      align-items: center;
      gap: var(--ce-space-3);
      min-height: 48px;
      text-align: left;
      color: inherit;
    }

    .prod__info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .prod__nome {
      font-weight: 600;
    }

    .prod__preco,
    .prod__total {
      @include mixins.tabular-numbers;

      font-weight: 700;
    }

    .prod__extra {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--ce-space-2);
    }

    .prod__link {
      @include mixins.touch-target;

      padding: 0;
      color: var(--ce-primary-strong);
      font-size: var(--ce-font-sm);
      font-weight: 600;
      text-decoration: underline;
    }

    .prod__total {
      margin-left: auto;
    }

    // ≥960 px: catálogo à esquerda, a venda (o mesmo conteúdo da sheet) à direita
    .grade {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--ce-space-4);
      align-items: start;
    }

    .venda--desktop .grade {
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    }

    .grade__venda {
      position: sticky;
      top: calc(56px + env(safe-area-inset-top, 0px) + var(--ce-space-4));
      // a coluna cabe na janela: o corpo do painel rola e o Confirmar fica no rodapé
      max-height: calc(100dvh - 56px - env(safe-area-inset-top, 0px) - 2 * var(--ce-space-4));
    }

    .grade__total,
    .sucesso__total {
      display: flex;
      justify-content: space-between;
      font-size: var(--ce-font-xl);
      font-weight: 700;
    }

    .lista {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    .opcao {
      @include mixins.touch-target;

      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ce-space-2);
      padding: var(--ce-space-2) var(--ce-space-3);
      border: 1px solid var(--ce-border);
      border-radius: 20px;
      background: var(--ce-surface);
      text-align: left;
    }

    .opcao--ativa {
      border-color: var(--ce-primary);
      background: var(--ce-primary-soft);
    }

    .dica {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }

    .resumo {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-1);
      padding: var(--ce-space-3);
      border-radius: 20px;
      background: var(--ce-surface-muted);
    }

    .resumo__linha {
      display: flex;
      justify-content: space-between;
      gap: var(--ce-space-2);
      font-weight: 600;
    }

    .resumo__linha--fiado {
      color: var(--ce-warning);
    }

    .sucesso {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }
  `,
})
export class PdvPage implements OnInit {
  private readonly vendaStore = inject(VendaStore);
  private readonly clientesApi = inject(ClientesApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly estoqueApi = inject(EstoqueApi);
  private readonly operador = inject(OperatorStore);
  private readonly sheet = inject(SheetService);
  private readonly vendasApi = inject(VendasApi);
  private readonly router = inject(Router);
  private readonly breakpoints = inject(BreakpointObserver);

  // A partir de 960 px a cobrança é o painel à direita (DESIGN.md §5); abaixo, o passo a passo.
  protected readonly desktop = toSignal(
    this.breakpoints.observe('(min-width: 960px)').pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  // Rascunho
  protected readonly clienteSelecionado = signal<ClienteResponse | null>(null);
  protected readonly enderecoId = signal<string | null>(null);
  protected readonly itens = signal<readonly ItemCarrinho[]>([]);
  // Casco e sucata por tipo de casco (chave = tipoCascoId); com 'na hora' o devolvido vem do carrinho.
  protected readonly cascosDevolvidos = signal<QuantidadesPorTipo>({});
  protected readonly cascosNaHora = signal(false);
  protected readonly sucataEntregue = signal<QuantidadesPorTipo>({});
  // Desconto por unidade da sucata, por tipo; começa em 0 (não há valor sugerido no cadastro).
  protected readonly sucataValores = signal<QuantidadesPorTipo>({});
  protected readonly vasilhames = signal<readonly VasilhameCarrinho[]>([]);
  // Edição: crédito de galão por tipo conhecido pelo detalhe (o que o servidor abateu).
  private readonly creditoEdicao = signal<QuantidadesPorTipo>({});
  protected readonly pagamentos = signal<readonly PagamentoEdicao[]>(PAGAMENTO_PADRAO);

  // Edição: com `id` (rota editar/:id) a página pré-carrega a venda e salva por PUT.
  readonly id = input<string>();
  /** Query param ?cliente=<id> (vem do detalhe do cliente): pré-seleciona o cliente numa venda nova. */
  readonly cliente = input<string>();
  /** Query params ?caixa=<id>&dataCaixa=<yyyy-MM-dd> (vêm do detalhe do caixa reaberto): a venda nova vai para esse caixa. */
  readonly caixa = input<string>();
  readonly dataCaixa = input<string>();
  /** Só venda nova: o PUT mantém o caixa da venda. */
  protected readonly caixaDeLancamento = computed(() => (this.id() ? undefined : this.caixa()));
  protected readonly rotuloDataCaixa = computed(() => {
    const [, mes, dia] = (this.dataCaixa() ?? '').split('-');
    return dia && mes ? `${dia}/${mes}` : '';
  });
  /** Query param ?repetirUltima=1 (vem do Repetir do cliente): com `cliente`, carrega a última venda dele. */
  readonly repetirUltima = input<string>();
  private readonly vendaCarregada = signal<VendaDetalheResponse | null>(null);
  protected readonly carga = signal<'carregando' | 'erro' | 'ok'>('ok');
  protected readonly erroCarga = signal<string | null>(null);
  protected readonly somenteLeitura = computed(() => this.vendaCarregada()?.cupomEmitido === true);

  // Fluxo
  protected readonly erro = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly venda = signal<VendaResponse | null>(null);
  // Cupom emitido agora (201) ou já existente (409): só o número é exibido.
  protected readonly cupom = signal<{ numero: string } | null>(null);
  protected readonly erroCupom = signal<string | null>(null);
  protected readonly emitindoCupom = signal(false);

  // Cliente
  protected readonly clientes = signal<readonly ClienteResponse[]>([]);
  protected readonly erroClientes = signal<string | null>(null);
  private buscaClientes: {
    nome: string;
    promessa: Promise<readonly ClienteResponse[]>;
  } | null = null;

  // Produtos: a API não filtra por texto, então carrega a lista inteira e filtra aqui.
  protected readonly produtos = signal<readonly ProdutoResponse[]>([]);
  protected readonly tiposCasco = signal<readonly TipoCascoResponse[]>([]);
  protected readonly produtosStatus = signal<DataListStatus>('idle');
  protected readonly termoProduto = signal('');
  // Texto mostrado na caixa de busca; esvaziá-lo ao escolher uma sugestão limpa o campo.
  protected readonly textoBusca = signal('');
  protected readonly filtroSugestao = signal<SugestaoBusca | null>(null);
  protected readonly categoria = signal<string | null>(null);
  protected readonly categorias = computed(() => categoriasDe(this.produtos()));
  private readonly catalogo = computed(() => linhasDoCatalogo(this.produtos()));
  protected readonly sugestoes = computed(() =>
    sugestoesDaBusca(this.catalogo(), this.termoProduto()),
  );
  protected readonly linhasDeProduto = computed<LinhaLista[]>(() => {
    const porCategoria = filtrarPorCategoria(this.catalogo(), this.categoria());
    const filtro = this.filtroSugestao();
    const porSugestao = filtro === null ? porCategoria : filtrarPorSugestao(porCategoria, filtro);
    const vasilhames = linhasDeVasilhame(
      this.tiposCasco(),
      this.termoProduto(),
      this.categoria() !== null || filtro !== null,
    );
    return [...filtrarPorTexto(porSugestao, this.termoProduto()), ...vasilhames];
  });

  protected readonly carrinhoVazio = computed(
    () => this.itens().length === 0 && this.vasilhames().length === 0,
  );
  // Crédito de galão por tipo = max(0, −saldo); na edição o saldo não é carregado.
  private readonly creditosVasilhame = computed<QuantidadesPorTipo>(() => {
    const base = this.saldoBaseDeCascos();
    return base === null
      ? this.creditoEdicao()
      : Object.fromEntries(base.map((c) => [c.tipoCascoId, Math.max(0, -c.saldo)]));
  });
  // Uma linha por tipo de casco do carrinho (retornáveis e vasilhames já lançados); sem lançamento, começa em 0.
  protected readonly vasilhamesEstado = computed<VasilhameEstado[]>(() => {
    const creditos = this.creditosVasilhame();
    const lancados = this.vasilhames();
    const ids = new Set([
      ...this.tiposDoCarrinho().map((t) => t.tipoCascoId),
      ...lancados.map((v) => v.tipoCascoId),
    ]);
    const linhas: VasilhameEstado[] = [];
    for (const tipo of this.tiposCasco().filter((t) => ids.has(t.id))) {
      const v = lancados.find((l) => l.tipoCascoId === tipo.id) ?? vasilhameNovo(tipo, 0);
      const credito = creditos[tipo.id] ?? 0;
      linhas.push({
        ...v,
        nome: tipo.nome,
        abatida: abatidaDe(v, credito),
        total: totalVasilhameDe(v, credito),
        escolhaModo: credito > 0 || v.modo === 'COMPRAR',
      });
    }
    return linhas;
  });
  protected readonly totalVasilhames = computed(() =>
    totalVasilhamesDe(this.vasilhames(), this.creditosVasilhame()),
  );
  protected readonly descontoSucata = computed(() =>
    descontoSucataDe(this.tiposDoCarrinho(), this.sucataEntregue(), this.sucataValores()),
  );
  protected readonly totais = computed(() =>
    totaisDe(this.itens(), this.totalVasilhames(), this.descontoSucata()),
  );
  protected readonly sucataPassaDoTotal = computed(() =>
    sucataExcede(this.descontoSucata(), this.totais().liquido + this.descontoSucata()),
  );
  protected readonly pago = computed(() => totalPagoDe(this.pagamentos()));
  protected readonly fiado = computed(() => fiadoDe(this.totais().liquido, this.pagamentos()));
  // Feedback ao vivo (Regra 8.6): em venda nova com saldo carregado, o saldo do cliente por tipo entra
  // na conta; na edição o saldo já inclui a venda original, então só conta o casco desta venda.
  private readonly saldoBaseDeCascos = computed(() =>
    this.id() === undefined ? (this.saldos()?.cascosPorTipo ?? null) : null,
  );
  private readonly tiposDoCarrinho = computed(() =>
    tiposCascoDoCarrinho(this.itens(), this.tiposCasco(), vasilhamesPorTipo(this.vasilhames())),
  );
  protected readonly cascos = computed<CascoTipoEstado[]>(() => {
    const base = this.saldoBaseDeCascos();
    return this.tiposDoCarrinho().map((tipo) => {
      const { valor, travado } = quantidadeDevolvida(
        tipo,
        this.cascosNaHora(),
        this.cascosDevolvidos()[tipo.tipoCascoId] ?? 0,
      );
      const saldo = base?.find((c) => c.tipoCascoId === tipo.tipoCascoId)?.saldo ?? 0;
      // Na edição o saldo não é carregado: o abatido já está no saldo gravado, não entra na prévia.
      const abatidos =
        base === null
          ? 0
          : (this.vasilhamesEstado().find((v) => v.tipoCascoId === tipo.tipoCascoId)?.abatida ?? 0);
      const { naRua, aMais } = previaCascoDoTipo(saldo, tipo.vendidosEmTroca, valor, abatidos);
      return {
        ...tipo,
        devolvidos: valor,
        travado,
        sucata: this.sucataEntregue()[tipo.tipoCascoId] ?? 0,
        valorSucata: this.sucataValores()[tipo.tipoCascoId] ?? 0,
        naRua,
        aMais,
      };
    });
  });
  protected readonly cascosAbertos = signal(false);
  protected readonly cascosComSaldo = computed(() =>
    linhasCascoPorTipo(this.saldos()?.cascosPorTipo ?? []),
  );
  protected readonly classificarSaldo = classificarSaldo;
  protected readonly rotuloSaldo = rotuloSaldo;
  protected readonly cascosComEle = cascosComEle;
  protected readonly cascosAFavor = cascosAFavor;

  // Saldos do cliente vêm do servidor e são exibidos como chegaram (Regra 8.6); só o chip de casco soma localmente os saldos positivos por tipo.
  protected readonly saldos = signal<SaldosResponse | null>(null);

  private readonly enderecoOk = computed(() => {
    const c = this.clienteSelecionado();
    return c !== null && (c.enderecos.length <= 1 || this.enderecoId() !== null);
  });

  protected readonly podeRegistrar = computed(
    () => this.enderecoOk() && !this.carrinhoVazio() && !this.sucataPassaDoTotal(),
  );

  // Resumo da barra do celular
  protected readonly quantidadeTotal = computed(
    () =>
      this.itens().reduce((soma, i) => soma + i.quantidade, 0) +
      this.vasilhames().reduce((soma, v) => soma + v.quantidade, 0),
  );
  protected readonly rotuloItens = computed(() => {
    const n = this.quantidadeTotal();
    return `${n} ${n === 1 ? 'item' : 'itens'}`;
  });

  // Crédito para pagar a venda: o disponível do servidor; na edição, o que o servidor devolveria
  // com os lançamentos da própria venda estornados (usa o saldo, não o disponível, que já é ≥ 0).
  private readonly creditoDisponivel = computed(() => {
    const saldos = this.saldos();
    if (saldos === null) {
      return null;
    }
    const original = this.vendaCarregada();
    return original === null ? saldos.creditoDisponivel : creditoNaEdicao(saldos.saldo, original);
  });

  protected readonly cobrarEstado = computed<CobrarEstado>(() => ({
    itens: this.itens(),
    totais: this.totais(),
    vasilhames: this.vasilhamesEstado(),
    totalVasilhames: this.totalVasilhames(),
    descontoSucata: this.descontoSucata(),
    sucataExcede: this.sucataPassaDoTotal(),
    cascos: this.cascos(),
    cascosNaHora: this.cascosNaHora(),
    clienteNome: this.saldoBaseDeCascos() === null ? null : (this.clienteSelecionado()?.nome ?? ''),
    pagamentos: this.pagamentos(),
    creditoDisponivel: this.creditoDisponivel(),
    nomeDoCliente: this.clienteSelecionado()?.nome ?? '',
    erro: this.erro(),
    enviando: this.enviando(),
    podeRegistrar: this.podeRegistrar(),
    rotuloConfirmar: this.id() ? 'Salvar alterações' : 'Confirmar venda',
  }));

  // Repetir última venda (só em venda nova, com cliente e carrinho vazio)
  protected readonly repetir = signal<
    | { readonly estado: 'ocioso' | 'carregando' | 'sem-venda' }
    | { readonly estado: 'erro'; readonly mensagem: string }
    | { readonly estado: 'pulados'; readonly pulados: number }
  >({ estado: 'ocioso' });
  protected readonly podeRepetir = computed(
    () => this.id() === undefined && this.carrinhoVazio() && this.repetir().estado !== 'sem-venda',
  );

  // Passo a passo do celular: o índice é a única coisa que ele guarda; o rascunho fica nos signals acima.
  private readonly passo = signal(0);
  protected readonly emPassos = computed(() => !this.desktop() && !this.somenteLeitura());
  protected readonly passosAtivos = computed(() => passosDaVenda(this.itens(), this.vasilhames()));
  protected readonly rotulosDosPassos = computed(() =>
    this.passosAtivos().map((p) => ROTULO_PASSO[p]),
  );
  protected readonly passoAtual = computed(() =>
    Math.min(this.passo(), this.passosAtivos().length - 1),
  );
  protected readonly podeAvancarNoPasso = computed(() =>
    podeAvancarPasso(this.passosAtivos()[this.passoAtual()], {
      carrinhoVazio: this.carrinhoVazio(),
      enderecoOk: this.enderecoOk(),
      sucataExcede: this.sucataPassaDoTotal(),
    }),
  );

  private produtosPronto: Promise<void> = Promise.resolve();

  constructor() {
    this.carregarProdutos();
    effect(() => {
      if (this.desktop()) {
        this.passo.set(0);
      }
    });
  }

  ngOnInit(): void {
    const id = this.id();
    const clienteId = this.cliente();
    if (id) {
      void this.carregarVenda(id);
    } else if (clienteId) {
      this.clientesApi
        .obter(clienteId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          // Se o operador já escolheu outro cliente enquanto isso, não sobrescreve.
          next: (c) => {
            if (this.clienteSelecionado() !== null) {
              return;
            }
            this.selecionarCliente(c);
            if (this.repetirUltima() === '1') {
              void this.repetirUltimaVenda();
            }
          },
          error: () => undefined, // abre sem cliente, como sem o parâmetro
        });
    }
  }

  private async carregarVenda(id: string): Promise<void> {
    this.carga.set('carregando');
    try {
      const venda = await firstValueFrom(this.vendasApi.obter(id));
      const cliente = await firstValueFrom(this.clientesApi.obter(venda.clienteId));
      await this.produtosPronto;
      const produtos = new Map(this.produtos().map((p) => [p.id, p]));
      for (const { produtoId } of venda.itens) {
        if (!produtos.has(produtoId)) {
          produtos.set(produtoId, await firstValueFrom(this.estoqueApi.obterProduto(produtoId)));
        }
      }
      const rascunho = rascunhoDeVenda(venda, produtos);
      this.selecionarCliente(cliente);
      this.enderecoId.set(rascunho.enderecoEntregaId);
      this.itens.set(rascunho.itens);
      this.vasilhames.set(rascunho.vasilhames);
      this.creditoEdicao.set(rascunho.creditoVasilhames);
      this.pagamentos.set(rascunho.pagamentos);
      this.cascosDevolvidos.set(rascunho.cascosDevolvidos);
      this.cascosNaHora.set(rascunho.cascosNaHora);
      this.sucataEntregue.set(rascunho.sucataEntregue);
      this.sucataValores.set(rascunho.sucataValores);
      this.vendaCarregada.set(venda);
      this.carga.set('ok');
    } catch (e) {
      this.erroCarga.set(e instanceof ApiError ? e.userMessage : 'Erro ao carregar a venda.');
      this.carga.set('erro');
    }
  }

  protected rotuloStatus(status: StatusPagamento): string {
    return rotuloStatusPagamento(status);
  }

  protected descontoDe = valorDescontoDe;
  protected totalDe = totalItemDe;

  protected enderecoTexto(e: EnderecoResponse): string {
    return [e.logradouro, e.numero, e.bairro].filter((parte) => !!parte).join(', ');
  }

  protected rotuloDaLinha({ produto, marca }: LinhaProduto): string {
    return `${produto.nome} — ${rotuloDaMarca(marca.marcaNome)}`;
  }

  protected rotuloDaSugestao(s: SugestaoBusca): string {
    const valor = s.tipo === 'marca' ? rotuloDaMarca(s.valor) : s.valor;
    return `${{ nome: 'Produto', marca: 'Marca', categoria: 'Categoria' }[s.tipo]}: ${valor}`;
  }

  // Cliente

  // A busca em voo fica guardada por termo: o Enter logo após o debounce espera a mesma
  // requisição em vez de ler a lista do termo anterior.
  protected buscarClientes(nome: string): Promise<readonly ClienteResponse[]> {
    if (this.buscaClientes?.nome === nome) {
      return this.buscaClientes.promessa;
    }
    this.erroClientes.set(null);
    const promessa = this.consultarClientes(nome);
    this.buscaClientes = { nome, promessa };
    return promessa;
  }

  private async consultarClientes(nome: string): Promise<readonly ClienteResponse[]> {
    if (nome === '') {
      this.clientes.set([]);
      return [];
    }
    try {
      const lista = await firstValueFrom(this.clientesApi.listar(nome, 1));
      if (this.buscaClientes?.nome === nome) {
        this.clientes.set(lista);
      }
      return lista;
    } catch (e) {
      if (this.buscaClientes?.nome === nome) {
        this.buscaClientes = null;
        this.erroClientes.set(e instanceof ApiError ? e.userMessage : 'Erro ao buscar clientes.');
      }
      return [];
    }
  }

  protected async enterCliente(evento: Event): Promise<void> {
    const nome = (evento.target as HTMLInputElement).value.trim();
    const [primeiro] = await this.buscarClientes(nome);
    if (primeiro) {
      this.selecionarCliente(primeiro);
    }
  }

  protected selecionarCliente(cliente: ClienteResponse): void {
    this.clienteSelecionado.set(cliente);
    this.enderecoId.set(cliente.enderecos.length === 1 ? cliente.enderecos[0].id : null);
    this.saldos.set(null);
    this.removerCredito();
    this.cascosAbertos.set(false);
    this.repetir.set({ estado: 'ocioso' });
    this.carregarSaldos(cliente.id);
  }

  // O crédito é do cliente: sem saldos carregados (troca ou remoção de cliente) a linha de crédito sai.
  private removerCredito(): void {
    this.pagamentos.update((atual) => limitarPagamentos(atual, null, 0));
  }

  private carregarSaldos(clienteId: string): void {
    this.clientesApi.obterSaldos(clienteId).subscribe({
      next: (saldos) => {
        if (this.clienteSelecionado()?.id === clienteId) {
          this.saldos.set(saldos);
          // O crédito pode ter mudado: a linha de crédito não passa do que o servidor diz agora.
          this.pagamentos.update((atual) =>
            limitarPagamentos(atual, this.creditoDisponivel(), this.totais().liquido),
          );
        }
      },
      error: () => undefined, // sem saldo, os chips ficam ocultos; o resto da venda segue
    });
  }

  protected trocarCliente(): void {
    this.clienteSelecionado.set(null);
    this.enderecoId.set(null);
    this.saldos.set(null);
    this.removerCredito();
    this.cascosAbertos.set(false);
    this.repetir.set({ estado: 'ocioso' });
  }

  // Itens

  protected carregarProdutos(): void {
    this.produtosStatus.set('loading');
    this.produtosPronto = new Promise((resolve) => {
      forkJoin({
        produtos: this.estoqueApi.listarProdutos(),
        tiposCasco: this.estoqueApi.listarTiposCasco(),
      }).subscribe({
        next: ({ produtos, tiposCasco }) => {
          this.produtos.set(produtos);
          this.tiposCasco.set(tiposCasco);
          this.produtosStatus.set('ok');
          resolve();
        },
        error: () => {
          this.produtosStatus.set('error');
          resolve();
        },
      });
    });
  }

  protected buscarProduto(texto: string): void {
    this.termoProduto.set(texto);
    this.textoBusca.set(texto);
  }

  protected escolherSugestao(sugestao: SugestaoBusca): void {
    this.filtroSugestao.set(sugestao);
    this.categoria.set(sugestao.tipo === 'categoria' ? sugestao.valor : this.categoria());
    this.termoProduto.set('');
    this.textoBusca.set('');
  }

  protected limparSugestao(): void {
    if (this.filtroSugestao()?.tipo === 'categoria') {
      this.categoria.set(null);
    }
    this.filtroSugestao.set(null);
  }

  // Trocar a pílula desfaz o filtro de categoria vindo de uma sugestão.
  protected escolherCategoria(categoria: string | null): void {
    if (this.filtroSugestao()?.tipo === 'categoria') {
      this.filtroSugestao.set(null);
    }
    this.categoria.set(categoria);
  }

  protected enterProduto(evento: Event): void {
    this.termoProduto.set((evento.target as HTMLInputElement).value.trim());
    const [primeira] = this.linhasDeProduto();
    if (primeira && ehVasilhame(primeira)) {
      this.definirVasilhame(
        primeira.vasilhame,
        this.quantidadeDeVasilhame(primeira.vasilhame.id) + 1,
      );
    } else if (primeira) {
      void this.adicionarProduto(primeira);
    }
  }

  protected async adicionarProduto(linha: LinhaProduto): Promise<void> {
    const resultado = await this.abrirItem(linha, null);
    if (resultado !== undefined && resultado !== 'remover') {
      this.itens.update((atual) => [...atual, resultado]);
    }
  }

  protected quantidadeDeVasilhame(tipoCascoId: string): number {
    return this.vasilhames().find((v) => v.tipoCascoId === tipoCascoId)?.quantidade ?? 0;
  }

  /** Lista do PDV: tocar em 'Vasilhame <tipo>' soma 1 no quadro; quantidade 0 tira o vasilhame do pedido (a linha do tipo segue no quadro enquanto há retornável do tipo). */
  protected definirVasilhame(tipo: TipoCascoResponse, quantidade: number): void {
    this.alterarVasilhame(tipo.id, { quantidade });
  }

  private alterarVasilhame(
    tipoCascoId: string,
    mudanca: Partial<Pick<VasilhameCarrinho, 'quantidade' | 'precoUnitario' | 'modo'>>,
  ): void {
    const quantidade = mudanca.quantidade;
    const tipo = this.tiposCasco().find((t) => t.id === tipoCascoId);
    if (this.quantidadeDeVasilhame(tipoCascoId) === 0 && tipo && quantidade && quantidade > 0) {
      this.vasilhames.update((atual) => [
        ...atual,
        { ...vasilhameNovo(tipo, quantidade), ...mudanca },
      ]);
      return;
    }
    this.vasilhames.update((atual) =>
      mudanca.quantidade !== undefined && mudanca.quantidade <= 0
        ? atual.filter((v) => v.tipoCascoId !== tipoCascoId)
        : atual.map((v) => (v.tipoCascoId === tipoCascoId ? { ...v, ...mudanca } : v)),
    );
  }

  protected itemDe({ produto, marca }: LinhaProduto): ItemCarrinho | undefined {
    return this.itens().find((i) => mesmoItem(i, produto, marca));
  }

  protected iconeDe(produto: ProdutoResponse): IconeNome {
    return iconeDoProduto(produto);
  }

  /** Repetir última venda: itens e quantidades da última venda do cliente, a preço de hoje. */
  protected async repetirUltimaVenda(): Promise<void> {
    const cliente = this.clienteSelecionado();
    if (!cliente || this.repetir().estado === 'carregando') {
      return;
    }
    this.repetir.set({ estado: 'carregando' });
    try {
      const ultima = await this.vendaStore.ultimaVendaDoCliente(cliente.id);
      await this.produtosPronto;
      if (this.clienteSelecionado()?.id !== cliente.id) {
        return;
      }
      if (ultima !== null && this.produtosStatus() === 'error') {
        this.repetir.set({ estado: 'erro', mensagem: 'Não foi possível carregar o catálogo.' });
        return;
      }
      // O operador tocou no catálogo com a consulta em voo: o carrinho dele não é substituído.
      if (!this.carrinhoVazio()) {
        this.repetir.set({ estado: 'ocioso' });
        return;
      }
      const catalogo = new Map(this.produtos().map((p) => [p.id, p]));
      if (ultima === null) {
        this.repetir.set({ estado: 'sem-venda' });
        return;
      }
      const { itens, vasilhames, pulados } = itensDaUltimaVenda(
        ultima,
        catalogo,
        this.tiposCasco(),
      );
      const copiou = itens.length > 0 || vasilhames.length > 0;
      if (copiou) {
        this.itens.set(itens);
        this.vasilhames.set(vasilhames);
      }
      this.repetir.set(
        pulados > 0 ? { estado: 'pulados', pulados } : { estado: copiou ? 'ocioso' : 'sem-venda' },
      );
    } catch (e) {
      if (this.clienteSelecionado()?.id === cliente.id) {
        const mensagem =
          e instanceof ApiError ? e.userMessage : 'Não foi possível carregar a última venda.';
        this.repetir.set({ estado: 'erro', mensagem });
      }
    }
  }

  /** Preço vivo: o do item no carrinho (editável) ou a sugestão da marca. */
  protected precoDe(linha: LinhaProduto): number {
    return this.itemDe(linha)?.precoUnitario ?? linha.marca.precoReferencia;
  }

  protected mudarQuantidade(linha: LinhaProduto, quantidade: number): void {
    const indice = this.itens().findIndex((i) => mesmoItem(i, linha.produto, linha.marca));
    if (quantidade <= 0) {
      if (indice >= 0) {
        this.removerItem(indice);
      }
    } else if (indice >= 0) {
      this.itens.update((atual) => atual.map((i, n) => (n === indice ? { ...i, quantidade } : i)));
    } else {
      const novo = itemNovo(linha.produto, linha.marca, quantidade);
      this.itens.update((atual) => [...atual, novo]);
    }
  }

  /** Link "preço e desconto": abre o sheet do item já no carrinho ou, se não houver, da linha. */
  protected async editarPreco(linha: LinhaProduto): Promise<void> {
    const indice = this.itens().findIndex((i) => mesmoItem(i, linha.produto, linha.marca));
    await (indice >= 0 ? this.editarItem(indice) : this.adicionarProduto(linha));
  }

  protected async editarItem(indice: number): Promise<void> {
    const existente = this.itens()[indice];
    const resultado = await this.abrirItem(existente, existente);
    if (resultado === 'remover') {
      this.removerItem(indice);
    } else if (resultado !== undefined) {
      this.itens.update((atual) => atual.map((item, i) => (i === indice ? resultado : item)));
    }
  }

  protected removerItem(indice: number): void {
    this.itens.update((atual) => atual.filter((_, i) => i !== indice));
  }

  private async abrirItem(
    { produto, marca }: { produto: ProdutoResponse; marca: ProdutoMarcaResponse },
    existente: ItemCarrinho | null,
  ): Promise<ItemVendaSheetResultado | undefined> {
    const ref = this.sheet.abrir<ItemVendaSheetResultado, ItemVendaSheetDados>(ItemVendaSheet, {
      produto,
      marca,
      existente,
      clienteId: this.clienteSelecionado()?.id ?? null,
    });
    return firstValueFrom(ref.closed);
  }

  // Cobrança: passo a passo no celular, painel no desktop (mesmas ações)

  protected avancarPasso(): void {
    this.passo.set(Math.min(this.passoAtual() + 1, this.passosAtivos().length - 1));
  }

  protected voltarPasso(): void {
    this.passo.set(Math.max(this.passoAtual() - 1, 0));
  }

  protected agir(acao: CobrarAcao): void {
    switch (acao.tipo) {
      case 'cascos':
        this.cascosDevolvidos.update((m) => ({ ...m, [acao.tipoCascoId]: acao.valor }));
        break;
      case 'naHora':
        this.alternarNaHora(acao.valor);
        break;
      case 'sucata':
        this.sucataEntregue.update((m) => ({ ...m, [acao.tipoCascoId]: acao.valor }));
        break;
      case 'sucataValor':
        this.sucataValores.update((m) => ({ ...m, [acao.tipoCascoId]: acao.valor }));
        break;
      case 'vasilhame':
        this.alterarVasilhame(acao.tipoCascoId, acao.mudanca);
        break;
      case 'pagamentos':
        this.pagamentos.set(
          limitarPagamentos(acao.valor, this.creditoDisponivel(), this.totais().liquido),
        );
        break;
      case 'atalho':
        this.aplicarAtalho(acao);
        break;
      case 'tudoFiado':
        this.pagamentos.set([]);
        break;
      case 'registrar':
        void this.registrar();
        break;
    }
  }

  // Cascos

  protected alternarNaHora(ligado: boolean): void {
    // Marcado, o devolvido de cada tipo é o vendido em troca (travado); ao desmarcar, o campo
    // fica editável a partir do valor que tinha.
    if (!ligado && this.cascosNaHora()) {
      this.cascosDevolvidos.set(
        Object.fromEntries(this.cascos().map((c) => [c.tipoCascoId, c.devolvidos])),
      );
    }
    this.cascosNaHora.set(ligado);
  }

  // Pagamento

  protected aplicarAtalho({ indice, qual }: { indice: number; qual: 'tudo' | 'metade' }): void {
    const valor = valorDoAtalho(qual, this.totais().liquido, this.pagamentos(), indice);
    this.pagamentos.update((atual) =>
      limitarPagamentos(
        indice < atual.length
          ? atual.map((p, i) => (i === indice ? { ...p, valor } : p))
          : [...atual, { forma: 'DINHEIRO', valor }],
        this.creditoDisponivel(),
        this.totais().liquido,
      ),
    );
  }

  // Registro

  protected async registrar(): Promise<void> {
    const original = this.vendaCarregada();
    const funcionarioId = original?.funcionarioId ?? this.operador.operator()?.id;
    const cliente = this.clienteSelecionado();
    const edicaoBloqueada = this.id() !== undefined && (!original || original.cupomEmitido);
    if (this.enviando() || !funcionarioId || !cliente || edicaoBloqueada) {
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    try {
      const request = paraCreateVendaRequest(
        {
          clienteId: cliente.id,
          funcionarioId,
          enderecoEntregaId: this.enderecoId(),
          itens: this.itens(),
          vasilhames: this.vasilhames(),
          pagamentos: this.pagamentos(),
          cascosDevolvidos: this.cascosDevolvidos(),
          cascosNaHora: this.cascosNaHora(),
          sucataEntregue: this.sucataEntregue(),
          sucataValores: this.sucataValores(),
        },
        this.tiposCasco(),
      );
      if (original) {
        // O PUT sobrescreve a observação: reenvia a da venda carregada.
        await this.vendaStore.editar(original.id, { ...request, observacao: original.observacao });
        await this.router.navigateByUrl(`/vendas/detalhe/${original.id}`);
      } else {
        const caixaId = this.caixaDeLancamento();
        this.venda.set(await this.vendaStore.criar(caixaId ? { ...request, caixaId } : request));
        this.carregarSaldos(cliente.id); // Regra 8.6: saldos novos vêm do servidor
      }
      this.passo.set(0);
    } catch (e) {
      // Rede/5xx já viraram toast no interceptor; 4xx (CAIXA_FECHADO, 400/422) fica inline.
      if (!(e instanceof ApiError)) {
        throw e;
      }
      if (e.status >= 400 && e.status < 500) {
        this.erro.set(e.userMessage);
      }
      if (e.code === 'CREDITO_INSUFICIENTE') {
        this.carregarSaldos(cliente.id); // o crédito mudou fora desta tela: o teto vem do servidor
      }
    } finally {
      this.enviando.set(false);
    }
  }

  protected voltarAoHoje(): void {
    const caixa = this.caixaDeLancamento();
    void this.router.navigateByUrl(caixa ? `/financeiro/caixas/${caixa}` : '/home');
  }

  protected async emitirCupom(vendaId: string): Promise<void> {
    this.emitindoCupom.set(true);
    this.erroCupom.set(null);
    try {
      this.cupom.set(await this.vendaStore.emitirCupom(vendaId));
    } catch (e) {
      if (!(e instanceof ApiError)) {
        throw e;
      }
      if (e.status === 409 && e.code === 'CUPOM_JA_EMITIDO') {
        this.cupom.set(await this.vendaStore.cupomExistente(vendaId));
      } else {
        this.erroCupom.set(e.userMessage);
      }
    } finally {
      this.emitindoCupom.set(false);
    }
  }

  // Não há endpoint de cancelamento: cancelar é só descartar o rascunho local.
  protected async cancelar(): Promise<void> {
    const confirmado = await this.sheet.confirmar({
      titulo: 'Cancelar venda',
      mensagem: 'Descartar o rascunho desta venda? Nada foi registrado ainda.',
      confirmarLabel: 'Descartar',
      perigo: true,
    });
    if (confirmado) {
      this.reiniciar();
    }
  }

  protected reiniciar(): void {
    this.clienteSelecionado.set(null);
    this.enderecoId.set(null);
    this.itens.set([]);
    this.vasilhames.set([]);
    this.creditoEdicao.set({});
    this.sucataValores.set({});
    this.cascosDevolvidos.set({});
    this.cascosNaHora.set(false);
    this.sucataEntregue.set({});
    this.pagamentos.set(PAGAMENTO_PADRAO);
    this.erro.set(null);
    this.venda.set(null);
    this.cupom.set(null);
    this.erroCupom.set(null);
    this.clientes.set([]);
    this.buscaClientes = null;
    this.saldos.set(null);
    this.categoria.set(null);
    this.filtroSugestao.set(null);
    this.cascosAbertos.set(false);
    this.repetir.set({ estado: 'ocioso' });
  }
}
