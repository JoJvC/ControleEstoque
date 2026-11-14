import { BreakpointObserver } from '@angular/cdk/layout';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';

import { ClientesApi } from '../../core/api/clientes-api';
import { EstoqueApi } from '../../core/api/estoque-api';
import { ClienteResponse, EnderecoResponse } from '../../core/api/models/clientes';
import { SaldosResponse } from '../../core/api/models/clientes';
import { EstoqueItemResponse, ProdutoResponse } from '../../core/api/models/estoque';
import { StatusPagamento, VendaDetalheResponse, VendaResponse } from '../../core/api/models/vendas';
import { VendasApi } from '../../core/api/vendas-api';
import { ApiError } from '../../core/http/api-error';
import { mensagemDoErro } from '../../core/http/error-messages';
import { OperatorStore } from '../../core/operator/operator-store';
import { SheetService } from '../../core/overlay/sheet-service';
import { semAcento } from '../../core/util/sem-acento';
import { Badge } from '../../ui/atoms/badge';
import { Button } from '../../ui/atoms/button';
import { Checkbox } from '../../ui/atoms/checkbox';
import { Chip } from '../../ui/atoms/chip';
import { Icon } from '../../ui/atoms/icon';
import { FormField } from '../../ui/molecules/form-field';
import { QuantityStepper } from '../../ui/molecules/quantity-stepper';
import { SearchBox } from '../../ui/molecules/search-box';
import { AppHeader } from '../../ui/organisms/app-header';
import { DataList, DataListStatus } from '../../ui/organisms/data-list';
import { ItemVendaCard } from '../../ui/organisms/item-venda-card';
import { PagamentoEdicao, PagamentoLista } from '../../ui/organisms/pagamento-lista';
import { ProdutoLinha } from '../../ui/organisms/produto-linha';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import {
  ItemCarrinho,
  cascosNaRua,
  categoriasDe,
  fiadoDe,
  filtrarPorCategoria,
  pagamentoExcede,
  paraCreateVendaRequest,
  produtosComEstoque,
  quantidadeAgua,
  rascunhoDeVenda,
  temAgua,
  totaisDe,
  totalItemDe,
  totalPagoDe,
  valorDoAtalho,
  valorDescontoDe,
} from './carrinho';
import { ItemVendaSheet, ItemVendaSheetDados, ItemVendaSheetResultado } from './item-venda-sheet';
import { VendaStore } from './venda-store';
import { rotuloStatusPagamento } from './venda-rotulos';

type Passo = 'cliente' | 'itens' | 'cascos' | 'pagamento' | 'revisao';

const ROTULOS: Record<Passo, string> = {
  cliente: 'Cliente',
  itens: 'Itens',
  cascos: 'Cascos',
  pagamento: 'Pagamento',
  revisao: 'Revisão',
};

@Component({
  selector: 'ce-pdv-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    AppHeader,
    Badge,
    Button,
    Checkbox,
    Chip,
    DataList,
    FormField,
    Icon,
    ItemVendaCard,
    NgTemplateOutlet,
    PagamentoLista,
    PrecoPipe,
    ProdutoLinha,
    QuantityStepper,
    SearchBox,
  ],
  template: `
    <ce-app-header [titulo]="id() ? 'Editar venda' : 'Nova venda'" [onda]="true" />

    <div class="conteudo">
      @if (venda(); as v) {
        <section class="sucesso" aria-label="Venda registrada">
          <h2>Venda registrada!</h2>
          <dl class="resumo">
            <div class="resumo__linha">
              <dt>Status do pagamento</dt>
              <dd>
                <ce-badge [cor]="v.statusPagamento === 'PAGA' ? 'success' : 'warning'">{{
                  rotuloStatus(v.statusPagamento)
                }}</ce-badge>
              </dd>
            </div>
            <div class="resumo__linha resumo__linha--fiado">
              <dt>Fiado gerado</dt>
              <dd>{{ v.saldoFiadoGerado | cePreco }}</dd>
            </div>
            <div class="resumo__linha">
              <dt>Saldo de cascos do cliente</dt>
              <dd>{{ v.saldoCascoCliente }}</dd>
            </div>
          </dl>
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
          @if (!desktop()) {
            <nav class="trilho" aria-label="Etapas da venda">
              <p class="trilho__texto" data-testid="trilho-texto">
                {{ indice() + 1 }} de {{ passos().length }}
              </p>
              <ol class="passos">
                @for (p of passos(); track p; let i = $index) {
                  <li class="passo" [class.passo--ativo]="p === passo()">
                    <button
                      type="button"
                      class="passo__cabecalho"
                      [disabled]="i >= indice()"
                      [attr.aria-current]="p === passo() ? 'step' : null"
                      (click)="passo.set(p)"
                    >
                      <span class="passo__numero">{{ i + 1 }}</span>
                      <span class="passo__rotulo">{{ rotulo(p) }}</span>
                    </button>
                  </li>
                }
              </ol>
            </nav>
            @if (passo() === 'cliente') {
              <ng-container *ngTemplateOutlet="tplCliente" />
            } @else {
              <ng-container *ngTemplateOutlet="tplBarraCliente" />
            }
            @switch (passo()) {
              @case ('itens') {
                <ng-container *ngTemplateOutlet="tplProdutos" />
                <ng-container *ngTemplateOutlet="tplCarrinho" />
              }
              @case ('cascos') {
                <ng-container *ngTemplateOutlet="tplCascos" />
              }
              @case ('pagamento') {
                <ng-container *ngTemplateOutlet="tplPagamento" />
              }
              @case ('revisao') {
                <ng-container *ngTemplateOutlet="tplRevisao" />
              }
            }
          } @else {
            <div class="grade">
              <div class="grade__produtos">
                <ng-container *ngTemplateOutlet="tplProdutos" />
              </div>
              <div class="grade__venda">
                <ng-container *ngTemplateOutlet="tplCliente" />
                <ng-container *ngTemplateOutlet="tplCarrinho" />
                @if (comCascos()) {
                  <ng-container *ngTemplateOutlet="tplCascos" />
                }
                <ng-container *ngTemplateOutlet="tplPagamento" />
                <ng-container *ngTemplateOutlet="tplRevisao" />
              </div>
            </div>
          }
        </div>

        @if (!id()) {
          <ce-button variante="ghost" (click)="cancelar()">Cancelar venda</ce-button>
        }
      }
    </div>

    <ng-template #tplBarraCliente>
      @if (cliente(); as c) {
        <section class="cliente-fixo" aria-label="Cliente da venda">
          <div class="cliente-fixo__linha">
            <strong class="cliente-fixo__nome">{{ c.nome }}</strong>
            <ce-button variante="ghost" (click)="trocarCliente()">Trocar</ce-button>
          </div>
          @if (saldos(); as s) {
            <div class="cliente-fixo__chips">
              <ce-chip tom="casco" icone="casco">Casco {{ s.saldoCascos }}</ce-chip>
              <ce-chip tom="fiado" icone="dinheiro">Fiado {{ s.saldoFiado | cePreco }}</ce-chip>
            </div>
          }
        </section>
      }
    </ng-template>

    <ng-template #tplCliente>
      @if (cliente(); as c) {
        <ng-container *ngTemplateOutlet="tplBarraCliente" />
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
      }
    </ng-template>

    <ng-template #tplProdutos>
      <h3>Produtos</h3>
      <div class="pilulas" role="group" aria-label="Filtrar por categoria">
        <button
          type="button"
          class="pilula"
          [class.pilula--ativa]="categoria() === null"
          [attr.aria-pressed]="categoria() === null"
          (click)="categoria.set(null)"
        >
          Todas
        </button>
        @for (c of categorias(); track c) {
          <button
            type="button"
            class="pilula"
            [class.pilula--ativa]="categoria() === c"
            [attr.aria-pressed]="categoria() === c"
            (click)="categoria.set(c)"
          >
            {{ c }}
          </button>
        }
      </div>
      <ce-search-box
        rotulo="Buscar produto"
        placeholder="Buscar produto por nome…"
        (buscar)="termoProduto.set($event)"
        (keydown.enter)="enterProduto($event)"
      />
      <ce-data-list
        [itens]="linhasDeProduto()"
        [status]="produtosStatus()"
        vazioTitulo="Nenhum produto encontrado"
        (recarregar)="carregarProdutos()"
      >
        <ng-template let-linha>
          <ce-produto-linha
            [nome]="linha.produto.nome"
            [detalhe]="detalheDe(linha.produto)"
            [tipo]="linha.produto.tipo"
            [categoria]="linha.produto.categoria"
            [preco]="precoDe(linha.produto)"
            [estoque]="linha.estoque"
            [quantidade]="quantidadeDe(linha.produto)"
            (quantidadeChange)="mudarQuantidade(linha.produto, $event)"
            (editarPreco)="editarPreco(linha.produto)"
          />
        </ng-template>
      </ce-data-list>
    </ng-template>

    <ng-template #tplCarrinho>
      @if (itens().length > 0) {
        <h3>Carrinho ({{ itens().length }})</h3>
        <div class="lista">
          @for (item of itens(); track $index; let n = $index) {
            <ce-item-venda-card
              [nome]="item.produto.nome"
              [quantidade]="item.quantidade"
              [precoUnitario]="item.precoUnitario"
              [valorDesconto]="descontoDe(item)"
              [motivoDesconto]="item.desconto?.motivo ?? null"
              [totalItem]="totalDe(item)"
              (editar)="editarItem(n)"
              (remover)="removerItem(n)"
            />
          }
        </div>
      }
    </ng-template>

    <ng-template #tplCascos>
      <ce-checkbox [ngModel]="cascosNaHora()" (ngModelChange)="alternarNaHora($event)">
        Devolveu todos na hora
      </ce-checkbox>
      <ce-form-field rotulo="Cascos devolvidos">
        <ce-quantity-stepper
          [ngModel]="cascosDevolvidos()"
          (ngModelChange)="cascosDevolvidos.set($event)"
        />
      </ce-form-field>
      <p class="casco-na-rua" role="status">
        <ce-icon nome="casco-na-rua" [tamanho]="20" />
        Fica {{ cascoNaRua() }} casco na rua
      </p>
      <section class="sucata" aria-label="Sucata">
        <ce-form-field rotulo="Sucata entregue">
          <ce-quantity-stepper
            [ngModel]="sucataEntregue()"
            (ngModelChange)="sucataEntregue.set($event)"
          />
        </ce-form-field>
        <p class="sucata__aviso">Sucata não abate o débito de casco</p>
      </section>
    </ng-template>

    <ng-template #tplPagamento>
      <ce-pagamento-lista
        [total]="totais().liquido"
        [(pagamentos)]="pagamentos"
        (atalho)="aplicarAtalho($event)"
      />
      @if (excede()) {
        <p class="erro" role="alert">{{ mensagemExcede }}</p>
      }
    </ng-template>

    <ng-template #tplRevisao>
      <dl class="resumo">
        <div class="resumo__linha">
          <dt>Cliente</dt>
          <dd>{{ cliente()?.nome }}</dd>
        </div>
        <div class="resumo__linha">
          <dt>Bruto</dt>
          <dd>{{ totais().bruto | cePreco }}</dd>
        </div>
        <div class="resumo__linha">
          <dt>Desconto</dt>
          <dd>− {{ totais().desconto | cePreco }}</dd>
        </div>
        <div class="resumo__linha resumo__linha--total">
          <dt>Líquido</dt>
          <dd>{{ totais().liquido | cePreco }}</dd>
        </div>
        <div class="resumo__linha">
          <dt>Pago</dt>
          <dd>{{ pago() | cePreco }}</dd>
        </div>
        <div class="resumo__linha resumo__linha--fiado">
          <dt>Vai para fiado</dt>
          <dd>{{ fiado() | cePreco }}</dd>
        </div>
        @if (comCascos()) {
          <div class="resumo__linha">
            <dt>Cascos devolvidos</dt>
            <dd>{{ cascosDevolvidos() }}</dd>
          </div>
          <div class="resumo__linha">
            <dt>Sucata entregue</dt>
            <dd>{{ sucataEntregue() }}</dd>
          </div>
        }
      </dl>
      @if (erro(); as mensagem) {
        <p class="erro" role="alert">{{ mensagem }}</p>
      }
    </ng-template>

    <div class="acoes">
      @if (venda()) {
        <ce-button [block]="true" (click)="reiniciar()">Nova venda</ce-button>
      } @else if (carga() === 'ok' && !somenteLeitura()) {
        @if (!desktop() && indice() > 0) {
          <ce-button variante="ghost" (click)="voltar()">Voltar</ce-button>
        }
        @if (desktop() || passo() === 'revisao') {
          <ce-button
            [block]="true"
            [loading]="enviando()"
            [disabled]="desktop() ? !podeRegistrar() : excede()"
            (click)="registrar()"
          >
            {{ id() ? 'Salvar alterações' : 'Registrar venda' }}
          </ce-button>
        } @else {
          <ce-button [block]="true" [disabled]="!podeAvancar()" (click)="avancar()">
            Avançar
          </ce-button>
        }
      }
    </div>
  `,
  styles: `
    @use 'mixins';

    :host {
      display: block;
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
    .trilho {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .trilho__texto {
      font-size: var(--ce-font-sm);
      font-weight: 600;
      color: var(--ce-text-muted);
    }

    .passos {
      list-style: none;
      padding: 0;
      display: flex;
      gap: var(--ce-space-1);
    }

    .passo {
      flex: 1;
      min-width: 0;
    }

    .passo__cabecalho {
      @include mixins.touch-target;

      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--ce-space-1);
      width: 100%;
      font-size: var(--ce-font-sm);
      font-weight: 600;
      color: var(--ce-text-muted);
    }

    .passo--ativo .passo__cabecalho {
      color: var(--ce-text);
    }

    .passo__numero {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--ce-surface-muted);
      border: 1px solid var(--ce-border);
    }

    .passo--ativo .passo__numero {
      background: var(--ce-primary);
      border-color: var(--ce-primary);
      color: var(--ce-text-on-primary);
    }

    // abaixo do header fixo do shell (56 px), que não rola
    .cliente-fixo {
      position: sticky;
      top: calc(56px + env(safe-area-inset-top, 0px));
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
      padding: var(--ce-space-3);
      border: 1px solid var(--ce-border);
      border-radius: var(--ce-radius-lg);
      background: var(--ce-surface);
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

    .pilula {
      @include mixins.touch-target;

      flex-shrink: 0;
      padding-inline: var(--ce-space-4);
      border: 1px solid var(--ce-borda-campo);
      border-radius: 999px;
      background: var(--ce-surface);
      font-weight: 600;
    }

    .pilula--ativa {
      border-color: var(--ce-primary);
      background: var(--ce-primary);
      color: var(--ce-text-on-primary);
    }

    .casco-na-rua {
      display: flex;
      align-items: center;
      gap: var(--ce-space-2);
      font-weight: 600;
      color: var(--ce-casco);
    }

    .sucata {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
      padding: var(--ce-space-3);
      border: 1px solid var(--ce-sucata);
      border-radius: var(--ce-radius-lg);
      background: var(--ce-sucata-soft);
    }

    .sucata__aviso {
      font-size: var(--ce-font-sm);
      font-weight: 600;
    }

    // ≥960 px: produtos à esquerda, a venda à direita, numa tela só
    .grade {
      display: grid;
      gap: var(--ce-space-4);
      align-items: start;
    }

    .grade__produtos,
    .grade__venda {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    @include mixins.from-desktop {
      .grade {
        grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      }

      .grade__venda {
        position: sticky;
        top: calc(56px + env(safe-area-inset-top, 0px) + var(--ce-space-4));
      }
    }

    .lista {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    .opcao,
    .selecionado {
      @include mixins.touch-target;

      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ce-space-2);
      padding: var(--ce-space-2) var(--ce-space-3);
      border: 1px solid var(--ce-border);
      border-radius: var(--ce-radius-md);
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
      border-radius: var(--ce-radius-md);
      background: var(--ce-surface-muted);
      border: 1px solid var(--ce-border);
    }

    .resumo__linha {
      display: flex;
      justify-content: space-between;
      gap: var(--ce-space-2);

      dd {
        @include mixins.tabular-numbers;

        font-weight: 700;
      }
    }

    .resumo__linha--total {
      font-size: var(--ce-font-lg);
    }

    .resumo__linha--fiado {
      color: var(--ce-warning);
      font-weight: 600;
    }

    .sucesso {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .acoes {
      position: sticky;
      bottom: calc(var(--ce-nav-height) + env(safe-area-inset-bottom, 0px));
      display: flex;
      gap: var(--ce-space-3);
      padding: var(--ce-space-3) var(--ce-space-4);
      background: var(--ce-bg);
      border-top: 1px solid var(--ce-border);

      @include mixins.from-desktop {
        bottom: 0;
      }
    }
  `,
})
export class PdvPage implements OnInit {
  private readonly vendaStore = inject(VendaStore);
  private readonly clientesApi = inject(ClientesApi);
  private readonly estoqueApi = inject(EstoqueApi);
  private readonly operador = inject(OperatorStore);
  private readonly sheet = inject(SheetService);
  private readonly vendasApi = inject(VendasApi);
  private readonly router = inject(Router);
  private readonly breakpoints = inject(BreakpointObserver);

  // PDV numa tela só a partir de 960 px (DESIGN.md §5); abaixo disso, etapas.
  protected readonly desktop = toSignal(
    this.breakpoints.observe('(min-width: 960px)').pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  protected readonly mensagemExcede = mensagemDoErro('PAGAMENTO_EXCEDE_TOTAL', 422);

  // Rascunho
  protected readonly cliente = signal<ClienteResponse | null>(null);
  protected readonly enderecoId = signal<string | null>(null);
  protected readonly itens = signal<readonly ItemCarrinho[]>([]);
  protected readonly cascosDevolvidos = signal(0);
  protected readonly cascosNaHora = signal(false);
  protected readonly sucataEntregue = signal(0);
  protected readonly pagamentos = signal<readonly PagamentoEdicao[]>([]);

  // Edição: com `id` (rota editar/:id) a página pré-carrega a venda e salva por PUT.
  readonly id = input<string>();
  private readonly vendaCarregada = signal<VendaDetalheResponse | null>(null);
  protected readonly carga = signal<'carregando' | 'erro' | 'ok'>('ok');
  protected readonly erroCarga = signal<string | null>(null);
  protected readonly somenteLeitura = computed(() => this.vendaCarregada()?.cupomEmitido === true);

  // Fluxo
  protected readonly passo = signal<Passo>('cliente');
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
  protected readonly produtosStatus = signal<DataListStatus>('idle');
  protected readonly termoProduto = signal('');
  protected readonly estoque = signal<readonly EstoqueItemResponse[]>([]);
  protected readonly categoria = signal<string | null>(null);
  protected readonly categorias = computed(() => categoriasDe(this.produtos()));
  protected readonly produtosFiltrados = computed(() => {
    const termo = semAcento(this.termoProduto());
    return filtrarPorCategoria(this.produtos(), this.categoria()).filter((p) =>
      semAcento(p.nome).includes(termo),
    );
  });
  protected readonly linhasDeProduto = computed(() =>
    produtosComEstoque(this.produtosFiltrados(), this.estoque()),
  );

  protected readonly totais = computed(() => totaisDe(this.itens()));
  protected readonly pago = computed(() => totalPagoDe(this.pagamentos()));
  protected readonly fiado = computed(() => fiadoDe(this.totais().liquido, this.pagamentos()));
  protected readonly excede = computed(() =>
    pagamentoExcede(this.totais().liquido, this.pagamentos()),
  );
  protected readonly comCascos = computed(() => temAgua(this.itens()));
  protected readonly cascoNaRua = computed(() =>
    cascosNaRua(quantidadeAgua(this.itens()), this.cascosDevolvidos()),
  );

  // Saldos do cliente vêm do servidor e são exibidos como chegaram (Regra 8.6): sem soma local.
  protected readonly saldos = signal<SaldosResponse | null>(null);

  protected readonly podeRegistrar = computed(() => {
    const c = this.cliente();
    const enderecoOk = c !== null && (c.enderecos.length <= 1 || this.enderecoId() !== null);
    return enderecoOk && this.itens().length > 0 && !this.excede();
  });

  protected readonly passos = computed<Passo[]>(() =>
    this.comCascos()
      ? ['cliente', 'itens', 'cascos', 'pagamento', 'revisao']
      : ['cliente', 'itens', 'pagamento', 'revisao'],
  );
  protected readonly indice = computed(() => this.passos().indexOf(this.passo()));

  protected readonly podeAvancar = computed(() => {
    switch (this.passo()) {
      case 'cliente': {
        const c = this.cliente();
        return c !== null && (c.enderecos.length <= 1 || this.enderecoId() !== null);
      }
      case 'itens':
        return this.itens().length > 0;
      case 'pagamento':
        return !this.excede();
      default:
        return true;
    }
  });

  private produtosPronto: Promise<void> = Promise.resolve();

  constructor() {
    this.carregarProdutos();
    // Só informativo: sem estoque a linha omite a quantidade.
    this.estoqueApi
      .obterEstoque()
      .subscribe({ next: (lista) => this.estoque.set(lista), error: () => undefined });
  }

  ngOnInit(): void {
    const id = this.id();
    if (id) {
      void this.carregarVenda(id);
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
      this.pagamentos.set(rascunho.pagamentos);
      this.cascosDevolvidos.set(rascunho.cascosDevolvidos);
      this.cascosNaHora.set(rascunho.cascosDevolvidosNaHora);
      this.sucataEntregue.set(rascunho.sucataEntregue);
      this.vendaCarregada.set(venda);
      this.passo.set('revisao');
      this.carga.set('ok');
    } catch (e) {
      this.erroCarga.set(e instanceof ApiError ? e.userMessage : 'Erro ao carregar a venda.');
      this.carga.set('erro');
    }
  }

  protected rotulo(passo: Passo): string {
    return ROTULOS[passo];
  }

  protected rotuloStatus(status: StatusPagamento): string {
    return rotuloStatusPagamento(status);
  }

  protected descontoDe = valorDescontoDe;
  protected totalDe = totalItemDe;

  protected enderecoTexto(e: EnderecoResponse): string {
    return [e.logradouro, e.numero, e.bairro].filter((parte) => !!parte).join(', ');
  }

  protected detalheDe(p: ProdutoResponse): string {
    return [p.marca, p.tamanho].filter((parte) => !!parte).join(' · ');
  }

  // Navegação

  protected avancar(): void {
    const proximo = this.passos()[this.indice() + 1];
    if (this.podeAvancar() && proximo) {
      this.passo.set(proximo);
    }
  }

  protected voltar(): void {
    const anterior = this.passos()[this.indice() - 1];
    if (anterior) {
      this.passo.set(anterior);
    }
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
    this.cliente.set(cliente);
    this.enderecoId.set(cliente.enderecos.length === 1 ? cliente.enderecos[0].id : null);
    this.saldos.set(null);
    this.clientesApi.obterSaldos(cliente.id).subscribe({
      next: (saldos) => {
        if (this.cliente()?.id === cliente.id) {
          this.saldos.set(saldos);
        }
      },
      error: () => undefined, // sem saldo, os chips ficam ocultos; o resto da venda segue
    });
  }

  protected trocarCliente(): void {
    this.cliente.set(null);
    this.enderecoId.set(null);
    this.saldos.set(null);
    this.passo.set('cliente');
  }

  // Itens

  protected carregarProdutos(): void {
    this.produtosStatus.set('loading');
    this.produtosPronto = new Promise((resolve) => {
      this.estoqueApi.listarProdutos().subscribe({
        next: (lista) => {
          this.produtos.set(lista);
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

  protected enterProduto(evento: Event): void {
    this.termoProduto.set((evento.target as HTMLInputElement).value.trim());
    const [primeiro] = this.produtosFiltrados();
    if (primeiro) {
      void this.adicionarProduto(primeiro);
    }
  }

  protected async adicionarProduto(produto: ProdutoResponse): Promise<void> {
    const resultado = await this.abrirItem(produto, null);
    if (resultado !== undefined && resultado !== 'remover') {
      this.mudarItens((atual) => [...atual, resultado]);
    }
  }

  /** Quantidade do produto no carrinho (o contador da linha); 0 se ele não está nele. */
  protected quantidadeDe(produto: ProdutoResponse): number {
    return this.itens().find((i) => i.produto.id === produto.id)?.quantidade ?? 0;
  }

  /** Preço vivo: o do item no carrinho (editável) ou a sugestão do produto. */
  protected precoDe(produto: ProdutoResponse): number {
    return (
      this.itens().find((i) => i.produto.id === produto.id)?.precoUnitario ??
      produto.precoReferencia
    );
  }

  protected mudarQuantidade(produto: ProdutoResponse, quantidade: number): void {
    const indice = this.itens().findIndex((i) => i.produto.id === produto.id);
    if (quantidade <= 0) {
      if (indice >= 0) {
        this.removerItem(indice);
      }
    } else if (indice >= 0) {
      this.mudarItens((atual) => atual.map((i, n) => (n === indice ? { ...i, quantidade } : i)));
    } else {
      const novo: ItemCarrinho = {
        produto,
        quantidade,
        precoUnitario: produto.precoReferencia,
        desconto: null,
      };
      this.mudarItens((atual) => [...atual, novo]);
    }
  }

  /** Link "preço e desconto": abre o sheet do item já no carrinho ou, se não houver, do produto. */
  protected async editarPreco(produto: ProdutoResponse): Promise<void> {
    const indice = this.itens().findIndex((i) => i.produto.id === produto.id);
    await (indice >= 0 ? this.editarItem(indice) : this.adicionarProduto(produto));
  }

  protected async editarItem(indice: number): Promise<void> {
    const existente = this.itens()[indice];
    const resultado = await this.abrirItem(existente.produto, existente);
    if (resultado === 'remover') {
      this.removerItem(indice);
    } else if (resultado !== undefined) {
      this.mudarItens((atual) => atual.map((item, i) => (i === indice ? resultado : item)));
    }
  }

  protected removerItem(indice: number): void {
    this.mudarItens((atual) => atual.filter((_, i) => i !== indice));
  }

  /** Com "todos na hora" ligado e sem edição manual, devolvidos acompanha a quantidade de água. */
  private mudarItens(fn: (atual: readonly ItemCarrinho[]) => readonly ItemCarrinho[]): void {
    const antes = quantidadeAgua(this.itens());
    const acompanha = this.cascosNaHora() && this.cascosDevolvidos() === antes;
    this.itens.update(fn);
    if (acompanha) {
      this.cascosDevolvidos.set(quantidadeAgua(this.itens()));
    }
  }

  private async abrirItem(
    produto: ProdutoResponse,
    existente: ItemCarrinho | null,
  ): Promise<ItemVendaSheetResultado | undefined> {
    const ref = this.sheet.abrir<ItemVendaSheetResultado, ItemVendaSheetDados>(ItemVendaSheet, {
      produto,
      existente,
    });
    return firstValueFrom(ref.closed);
  }

  // Cascos

  protected alternarNaHora(ligado: boolean): void {
    this.cascosNaHora.set(ligado);
    if (ligado) {
      // Atalho, não trava (Regra 8.2): o campo segue editável e desligar não zera.
      this.cascosDevolvidos.set(quantidadeAgua(this.itens()));
    }
  }

  // Pagamento

  protected aplicarAtalho({ indice, qual }: { indice: number; qual: 'tudo' | 'metade' }): void {
    const valor = valorDoAtalho(qual, this.totais().liquido, this.pagamentos(), indice);
    this.pagamentos.update((atual) => atual.map((p, i) => (i === indice ? { ...p, valor } : p)));
  }

  // Registro

  protected async registrar(): Promise<void> {
    const original = this.vendaCarregada();
    const funcionarioId = original?.funcionarioId ?? this.operador.operator()?.id;
    const cliente = this.cliente();
    const edicaoBloqueada = this.id() !== undefined && (!original || original.cupomEmitido);
    if (this.enviando() || this.excede() || !funcionarioId || !cliente || edicaoBloqueada) {
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    try {
      const request = paraCreateVendaRequest({
        clienteId: cliente.id,
        funcionarioId,
        enderecoEntregaId: this.enderecoId(),
        itens: this.itens(),
        pagamentos: this.pagamentos(),
        cascosDevolvidos: this.cascosDevolvidos(),
        cascosDevolvidosNaHora: this.cascosNaHora(),
        sucataEntregue: this.sucataEntregue(),
      });
      if (original) {
        // O PUT sobrescreve a observação: reenvia a da venda carregada.
        await this.vendaStore.editar(original.id, { ...request, observacao: original.observacao });
        await this.router.navigateByUrl(`/vendas/detalhe/${original.id}`);
      } else {
        this.venda.set(await this.vendaStore.criar(request));
      }
    } catch (e) {
      // Rede/5xx já viraram toast no interceptor; 4xx (CAIXA_FECHADO, 400/422) fica inline.
      if (!(e instanceof ApiError)) {
        throw e;
      }
      if (e.status >= 400 && e.status < 500) {
        this.erro.set(e.userMessage);
      }
    } finally {
      this.enviando.set(false);
    }
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
    this.cliente.set(null);
    this.enderecoId.set(null);
    this.itens.set([]);
    this.cascosDevolvidos.set(0);
    this.cascosNaHora.set(false);
    this.sucataEntregue.set(0);
    this.pagamentos.set([]);
    this.erro.set(null);
    this.venda.set(null);
    this.cupom.set(null);
    this.erroCupom.set(null);
    this.clientes.set([]);
    this.buscaClientes = null;
    this.saldos.set(null);
    this.categoria.set(null);
    this.passo.set('cliente');
  }
}
