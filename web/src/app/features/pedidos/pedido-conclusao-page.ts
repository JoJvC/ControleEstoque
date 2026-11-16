import { BreakpointObserver } from '@angular/cdk/layout';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom, map } from 'rxjs';

import { ClientesApi } from '../../core/api/clientes-api';
import { EstoqueApi } from '../../core/api/estoque-api';
import { EnderecoResponse, SaldosResponse } from '../../core/api/models/clientes';
import { ProdutoResponse, TipoCascoResponse } from '../../core/api/models/estoque';
import { rotuloDaMarca } from '../../core/api/produto-leitura';
import { ApiError } from '../../core/http/api-error';
import { OperatorStore } from '../../core/operator/operator-store';
import { SheetService } from '../../core/overlay/sheet-service';
import { Spinner } from '../../ui/atoms/spinner';
import { EmptyState } from '../../ui/molecules/empty-state';
import { AppHeader } from '../../ui/organisms/app-header';
import { ItemVendaCard } from '../../ui/organisms/item-venda-card';
import { PagamentoEdicao } from '../../ui/organisms/pagamento-lista';
import { PassoAPasso } from '../../ui/organisms/passo-a-passo';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { ItemCarrinho, VasilhameCarrinho, totalItemDe, valorDescontoDe } from '../vendas/carrinho';
import { QuantidadesPorTipo } from '../vendas/cascos-por-tipo';
import { CobrarAcao, CobrarEstado } from '../vendas/cobrar-estado';
import { CobrarPainel } from '../vendas/cobrar-painel';
import { PAGAMENTO_PADRAO, criarCobranca } from '../vendas/cobranca';
import {
  ItemVendaSheet,
  ItemVendaSheetDados,
  ItemVendaSheetResultado,
} from '../vendas/item-venda-sheet';
import { limitarPagamentos } from '../vendas/pagamento-credito';
import { PassoCascos } from '../vendas/passo-cascos';
import { PassoPagamento } from '../vendas/passo-pagamento';
import { itensDoPedido, paraConcluirPedidoRequest } from './conclusao-pedido';
import { PassoPerdas } from './passo-perdas';
import {
  PassoConclusao,
  ROTULO_PASSO_CONCLUSAO,
  passosDaConclusao,
  podeAvancarConclusao,
} from './passos-conclusao';
import { Ocorrencia, perdasProntas } from './perdas-form';
import { PedidosStore } from './pedidos-store';

const SEM_CREDITO: QuantidadesPorTipo = {};

/**
 * Conclusão do pedido EM_ANDAMENTO: o passo a passo da venda (itens do pedido editáveis, cascos e
 * pagamento) com o passo extra 'Perdas e quebras'. O Confirmar faz a conclusão e, só depois dela, as perdas.
 */
@Component({
  selector: 'ce-pedido-conclusao-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    AppHeader,
    CobrarPainel,
    EmptyState,
    ItemVendaCard,
    PassoAPasso,
    PassoCascos,
    PassoPagamento,
    PassoPerdas,
    PrecoPipe,
    Spinner,
  ],
  template: `
    <ce-app-header titulo="Concluir pedido" [mostrarVoltar]="true" (voltar)="voltar()" />

    <div class="conteudo">
      @switch (store.statusPedido()) {
        @case ('error') {
          <ce-empty-state
            icone="alerta"
            titulo="Não foi possível carregar o pedido"
            [descricao]="store.erroPedido() ?? 'Verifique a conexão e tente novamente.'"
          />
        }
        @case ('ok') {
          @if (store.pedido(); as pedido) {
            @if (pedido.status !== 'EM_ANDAMENTO' && !enviando()) {
              <section class="bloco" data-testid="conclusao-indisponivel">
                <p role="alert">Este pedido não está em andamento: não dá para concluir.</p>
                @if (erro(); as mensagem) {
                  <p class="erro" role="alert">{{ mensagem }}</p>
                }
                <a [routerLink]="'/pedidos/' + pedido.id">Ver o pedido</a>
              </section>
            } @else if (catalogo() === 'carregando') {
              <div class="carregando" aria-busy="true"><ce-spinner /></div>
            } @else if (catalogo() === 'erro') {
              <ce-empty-state
                icone="alerta"
                titulo="Não foi possível carregar o catálogo"
                descricao="Verifique a conexão e volte ao pedido."
              />
            } @else {
              <div class="grade" [class.grade--desktop]="desktop()">
                @if (emPassos()) {
                  <ce-passo-a-passo
                    [passos]="rotulosDosPassos()"
                    [atual]="passoAtual()"
                    [podeAvancar]="podeAvancarNoPasso()"
                    rotuloFinal="Concluir pedido"
                    [carregando]="enviando()"
                    (voltar)="voltarPasso()"
                    (avancar)="avancarPasso()"
                    (concluir)="registrar()"
                  >
                    <ng-container resumo>
                      <small>{{ rotuloItens() }}</small>
                      <strong>{{ estado().totais.liquido | cePreco }}</strong>
                    </ng-container>
                    @switch (passosAtivos()[passoAtual()]) {
                      @case ('cascos') {
                        <ce-passo-cascos [estado]="estado()" (acao)="agir($event)" />
                      }
                      @case ('perdas') {
                        <ng-container *ngTemplateOutlet="tplPerdas" />
                      }
                      @case ('pagamento') {
                        <ce-passo-pagamento [estado]="estado()" (acao)="agir($event)" />
                      }
                      @default {
                        <ng-container *ngTemplateOutlet="tplItens" />
                      }
                    }
                  </ce-passo-a-passo>
                } @else {
                  <div class="coluna">
                    <ng-container *ngTemplateOutlet="tplItens" />
                    <h2>Perdas e quebras</h2>
                    <ng-container *ngTemplateOutlet="tplPerdas" />
                  </div>
                  <aside class="grade__venda" aria-label="Cobrança do pedido">
                    <ce-cobrar-painel [estado]="estado()" (acao)="agir($event)" />
                  </aside>
                }
              </div>
            }

            <ng-template #tplItens>
              <section class="bloco" aria-label="Cliente do pedido">
                <p class="cliente">{{ store.cliente()?.nome ?? 'Carregando cliente…' }}</p>
                @if (enderecoTexto(pedido); as endereco) {
                  <p class="meta">Entrega: {{ endereco }}</p>
                }
              </section>
              <section class="bloco" aria-label="Itens do pedido">
                <h2>Itens</h2>
                @if (foraDoCatalogo() > 0) {
                  <p class="erro" role="alert" data-testid="itens-fora-do-catalogo">
                    {{ foraDoCatalogo() }} item(ns) do pedido não está(ão) mais no catálogo: não dá
                    para concluir.
                  </p>
                }
                @for (item of itens(); track item.produto.id + item.marca.marcaId; let i = $index) {
                  <ce-item-venda-card
                    [nome]="item.produto.nome + ' — ' + rotuloMarca(item.marca.marcaNome)"
                    [quantidade]="item.quantidade"
                    [precoUnitario]="item.precoUnitario"
                    [valorDesconto]="descontoDe(item)"
                    [motivoDesconto]="item.desconto?.motivo || null"
                    [totalItem]="totalDe(item)"
                    (editar)="editarItem(i)"
                    (remover)="removerItem(i)"
                  />
                } @empty {
                  <p class="meta">Nenhum item no pedido.</p>
                }
              </section>
            </ng-template>

            <ng-template #tplPerdas>
              <ce-passo-perdas
                [(ocorrencias)]="ocorrencias"
                [funcionarios]="pedido.funcionarios"
                [produtos]="produtos()"
                [tiposCasco]="tiposCasco()"
              />
            </ng-template>
          }
        }
        @default {
          <div class="carregando" aria-busy="true"><ce-spinner /></div>
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

      @include mixins.from-desktop {
        max-width: 1200px;
      }
    }

    .bloco,
    .coluna,
    .grade__venda {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    h2 {
      font-size: var(--ce-font-md);
      font-weight: 600;
    }

    .cliente {
      font-size: var(--ce-font-lg);
      font-weight: 600;
    }

    .meta {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }

    .carregando {
      display: flex;
      justify-content: center;
    }

    // ≥960 px: itens e perdas à esquerda, a cobrança (com o Confirmar sempre à vista) à direita
    .grade {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--ce-space-4);
      align-items: start;
    }

    .grade--desktop {
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    }

    .grade__venda {
      position: sticky;
      top: calc(56px + env(safe-area-inset-top, 0px) + var(--ce-space-4));
      max-height: calc(100dvh - 56px - env(safe-area-inset-top, 0px) - 2 * var(--ce-space-4));
    }
  `,
})
export class PedidoConclusaoPage {
  /** Route param (:id). */
  readonly id = input.required<string>();

  protected readonly store = inject(PedidosStore);
  private readonly clientesApi = inject(ClientesApi);
  private readonly estoqueApi = inject(EstoqueApi);
  private readonly operador = inject(OperatorStore);
  private readonly router = inject(Router);
  private readonly sheet = inject(SheetService);
  private readonly breakpoints = inject(BreakpointObserver);

  // A partir de 960 px a cobrança é o painel à direita (como na venda); abaixo, o passo a passo.
  protected readonly desktop = toSignal(
    this.breakpoints.observe('(min-width: 960px)').pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  // Catálogo e saldos do cliente (alimentam os itens, os cascos e o crédito)
  protected readonly produtos = signal<readonly ProdutoResponse[]>([]);
  protected readonly tiposCasco = signal<readonly TipoCascoResponse[]>([]);
  protected readonly catalogo = signal<'carregando' | 'ok' | 'erro'>('carregando');
  private readonly saldos = signal<SaldosResponse | null>(null);

  // Rascunho: os itens começam nos do pedido; os vasilhames não fazem parte do pedido
  protected readonly itens = signal<readonly ItemCarrinho[]>([]);
  protected readonly foraDoCatalogo = signal(0);
  private readonly vasilhames = signal<readonly VasilhameCarrinho[]>([]);
  private readonly cascosDevolvidos = signal<QuantidadesPorTipo>({});
  private readonly cascosNaHora = signal(false);
  private readonly sucataEntregue = signal<QuantidadesPorTipo>({});
  private readonly sucataValores = signal<QuantidadesPorTipo>({});
  private readonly pagamentos = signal<readonly PagamentoEdicao[]>(PAGAMENTO_PADRAO);
  protected readonly ocorrencias = signal<readonly Ocorrencia[]>([]);

  // Fluxo
  protected readonly erro = signal<string | null>(null);
  protected readonly enviando = signal(false);

  private readonly cobranca = criarCobranca(
    {
      itens: this.itens,
      vasilhames: this.vasilhames,
      cascosDevolvidos: this.cascosDevolvidos,
      cascosNaHora: this.cascosNaHora,
      sucataEntregue: this.sucataEntregue,
      sucataValores: this.sucataValores,
      pagamentos: this.pagamentos,
      tiposCasco: this.tiposCasco,
      saldos: this.saldos,
    },
    {
      edicao: () => false,
      creditoEdicao: () => SEM_CREDITO,
      vendaCarregada: () => null,
      rotuloConfirmar: () => 'Concluir pedido',
      enderecoOk: () => true, // o endereço vem do pedido
      nomeDoCliente: () => this.store.cliente()?.nome ?? '',
      erro: this.erro,
      enviando: this.enviando,
    },
  );

  private readonly perdasOk = computed(() =>
    perdasProntas(this.ocorrencias(), this.store.pedido()?.funcionarios.length ?? 0),
  );
  private readonly podeRegistrar = computed(
    () =>
      this.cobranca.podeRegistrar() &&
      this.perdasOk() &&
      this.foraDoCatalogo() === 0 &&
      this.store.pedido()?.status === 'EM_ANDAMENTO',
  );
  protected readonly estado = computed<CobrarEstado>(() => ({
    ...this.cobranca.estado(),
    podeRegistrar: this.podeRegistrar(),
  }));
  protected readonly rotuloItens = computed(() => {
    const n = this.itens().reduce((soma, i) => soma + i.quantidade, 0);
    return `${n} ${n === 1 ? 'item' : 'itens'}`;
  });

  // Passo a passo do celular: o índice é a única coisa que ele guarda
  private readonly passo = signal(0);
  protected readonly emPassos = computed(() => !this.desktop());
  protected readonly passosAtivos = computed<PassoConclusao[]>(() =>
    passosDaConclusao(this.itens(), this.vasilhames()),
  );
  protected readonly rotulosDosPassos = computed(() =>
    this.passosAtivos().map((p) => ROTULO_PASSO_CONCLUSAO[p]),
  );
  protected readonly passoAtual = computed(() =>
    Math.min(this.passo(), this.passosAtivos().length - 1),
  );
  protected readonly podeAvancarNoPasso = computed(() =>
    podeAvancarConclusao(this.passosAtivos()[this.passoAtual()], {
      carrinhoVazio: this.cobranca.carrinhoVazio(),
      sucataExcede: this.cobranca.sucataPassaDoTotal(),
      itemForaDoCatalogo: this.foraDoCatalogo() > 0,
      perdasProntas: this.perdasOk(),
    }),
  );

  protected readonly rotuloMarca = rotuloDaMarca;
  protected readonly descontoDe = valorDescontoDe;
  protected readonly totalDe = totalItemDe;

  /** O pedido do qual os itens e os saldos já foram carregados. */
  private pedidoInicial: string | null = null;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.pedidoInicial = null;
        this.erro.set(null);
        this.store.carregar(id);
      });
    });
    this.carregarCatalogo();
    // Itens e saldos entram quando o pedido e o catálogo chegam, uma vez por pedido: depois disso o
    // operador é o dono dos itens (recarregar o pedido em PEDIDO_STATUS_INVALIDO não os sobrescreve).
    effect(() => {
      const pedido = this.store.pedido();
      const catalogo = this.catalogo();
      untracked(() => {
        if (
          !pedido ||
          pedido.status !== 'EM_ANDAMENTO' ||
          catalogo !== 'ok' ||
          this.pedidoInicial === pedido.id
        ) {
          return;
        }
        this.pedidoInicial = pedido.id;
        const { itens, foraDoCatalogo } = itensDoPedido(pedido.itens, this.produtos());
        this.itens.set(itens);
        this.foraDoCatalogo.set(foraDoCatalogo);
        this.carregarSaldos(pedido.clienteId);
      });
    });
  }

  private async carregarCatalogo(): Promise<void> {
    try {
      const [produtos, tipos] = await Promise.all([
        firstValueFrom(this.estoqueApi.listarProdutos()),
        firstValueFrom(this.estoqueApi.listarTiposCasco()),
      ]);
      this.produtos.set(produtos);
      this.tiposCasco.set(tipos);
      this.catalogo.set('ok');
    } catch {
      this.catalogo.set('erro');
    }
  }

  private carregarSaldos(clienteId: string): void {
    this.clientesApi.obterSaldos(clienteId).subscribe({
      next: (saldos) => {
        if (this.store.pedido()?.clienteId !== clienteId) {
          return;
        }
        this.saldos.set(saldos);
        // O crédito pode ter mudado: a linha de crédito não passa do que o servidor diz agora.
        this.pagamentos.update((atual) =>
          limitarPagamentos(
            atual,
            this.cobranca.creditoDisponivel(),
            this.cobranca.totais().liquido,
          ),
        );
      },
      error: () => undefined, // sem saldo, não há crédito nem prévia de casco; o resto segue
    });
  }

  protected voltar(): void {
    void this.router.navigateByUrl(`/pedidos/${this.id()}`);
  }

  protected enderecoTexto(pedido: { enderecoEntregaId: string | null }): string | null {
    const e: EnderecoResponse | undefined = this.store
      .cliente()
      ?.enderecos.find((x) => x.id === pedido.enderecoEntregaId);
    return e ? [e.logradouro, e.numero, e.bairro].filter((p) => !!p).join(', ') : null;
  }

  // Itens: só edita e remove os do pedido

  protected async editarItem(indice: number): Promise<void> {
    const existente = this.itens()[indice];
    const ref = this.sheet.abrir<ItemVendaSheetResultado, ItemVendaSheetDados>(ItemVendaSheet, {
      produto: existente.produto,
      marca: existente.marca,
      existente,
      clienteId: this.store.pedido()?.clienteId ?? null,
    });
    const resultado = await firstValueFrom(ref.closed);
    if (resultado === 'remover') {
      this.removerItem(indice);
    } else if (resultado !== undefined) {
      this.itens.update((atual) => atual.map((item, i) => (i === indice ? resultado : item)));
    }
  }

  protected removerItem(indice: number): void {
    this.itens.update((atual) => atual.filter((_, i) => i !== indice));
  }

  // Cobrança

  protected avancarPasso(): void {
    this.passo.set(Math.min(this.passoAtual() + 1, this.passosAtivos().length - 1));
  }

  protected voltarPasso(): void {
    this.passo.set(Math.max(this.passoAtual() - 1, 0));
  }

  protected agir(acao: CobrarAcao): void {
    if (acao.tipo === 'registrar') {
      void this.registrar();
    } else {
      this.cobranca.agir(acao);
    }
  }

  /** Conclusão primeiro; as perdas só depois do 201 (o servidor só as aceita em pedido CONCLUIDO). */
  protected async registrar(): Promise<void> {
    const pedido = this.store.pedido();
    const operador = this.operador.operator();
    if (this.enviando() || !pedido || !operador || !this.podeRegistrar()) {
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    const ocorrencias = this.ocorrencias();
    try {
      await this.store.concluir(
        pedido.id,
        paraConcluirPedidoRequest(
          {
            funcionarioId: operador.id,
            itens: this.itens(),
            vasilhames: this.vasilhames(),
            pagamentos: this.pagamentos(),
            cascosDevolvidos: this.cascosDevolvidos(),
            cascosNaHora: this.cascosNaHora(),
            sucataEntregue: this.sucataEntregue(),
            sucataValores: this.sucataValores(),
          },
          this.tiposCasco(),
        ),
      );
    } catch (e) {
      // Rede/5xx já viraram toast no interceptor; 4xx fica inline.
      if (!(e instanceof ApiError)) {
        this.enviando.set(false);
        throw e;
      }
      if (e.status >= 400 && e.status < 500) {
        this.erro.set(e.userMessage);
      }
      if (e.code === 'CREDITO_INSUFICIENTE') {
        this.carregarSaldos(pedido.clienteId); // o crédito mudou fora desta tela: o teto vem do servidor
      }
      this.enviando.set(false);
      return;
    }
    if (ocorrencias.length > 0) {
      try {
        await this.store.registrarPerdas(pedido.id, ocorrencias);
      } catch {
        // A venda já foi registrada e não se reenvia: o detalhe avisa e deixa registrar as perdas de novo.
        this.store.guardarPerdasPendentes(pedido.id, ocorrencias);
      }
    }
    // Só baixa o enviando depois de navegar: a store já gravou o pedido como CONCLUIDO e a tela não
    // pode piscar o aviso de 'não está em andamento' logo após o sucesso.
    try {
      await this.router.navigateByUrl(`/pedidos/${pedido.id}`);
    } finally {
      this.enviando.set(false);
    }
  }
}
