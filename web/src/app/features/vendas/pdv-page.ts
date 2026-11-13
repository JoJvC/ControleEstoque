import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ClientesApi } from '../../core/api/clientes-api';
import { EstoqueApi } from '../../core/api/estoque-api';
import { ClienteResponse, EnderecoResponse } from '../../core/api/models/clientes';
import { ProdutoResponse } from '../../core/api/models/estoque';
import { VendaDetalheResponse, VendaResponse } from '../../core/api/models/vendas';
import { VendasApi } from '../../core/api/vendas-api';
import { ApiError } from '../../core/http/api-error';
import { mensagemDoErro } from '../../core/http/error-messages';
import { OperatorStore } from '../../core/operator/operator-store';
import { SheetService } from '../../core/overlay/sheet-service';
import { Badge } from '../../ui/atoms/badge';
import { Button } from '../../ui/atoms/button';
import { Checkbox } from '../../ui/atoms/checkbox';
import { FormField } from '../../ui/molecules/form-field';
import { QuantityStepper } from '../../ui/molecules/quantity-stepper';
import { SearchBox } from '../../ui/molecules/search-box';
import { AppHeader } from '../../ui/organisms/app-header';
import { DataList, DataListStatus } from '../../ui/organisms/data-list';
import { ItemVendaCard } from '../../ui/organisms/item-venda-card';
import { PagamentoEdicao, PagamentoLista } from '../../ui/organisms/pagamento-lista';
import { ProdutoCard } from '../../ui/organisms/produto-card';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import {
  ItemCarrinho,
  fiadoDe,
  pagamentoExcede,
  paraCreateVendaRequest,
  quantidadeAgua,
  rascunhoDeVenda,
  temAgua,
  totaisDe,
  totalItemDe,
  totalPagoDe,
  valorDescontoDe,
} from './carrinho';
import { ItemVendaSheet, ItemVendaSheetDados, ItemVendaSheetResultado } from './item-venda-sheet';
import { VendaStore } from './venda-store';

type Passo = 'cliente' | 'itens' | 'cascos' | 'pagamento' | 'revisao';

const ROTULOS: Record<Passo, string> = {
  cliente: 'Cliente',
  itens: 'Itens',
  cascos: 'Cascos',
  pagamento: 'Pagamento',
  revisao: 'Revisão',
};

const semAcento = (texto: string): string =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

@Component({
  selector: 'ce-pdv-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    AppHeader,
    Badge,
    Button,
    Checkbox,
    DataList,
    FormField,
    ItemVendaCard,
    PagamentoLista,
    PrecoPipe,
    ProdutoCard,
    QuantityStepper,
    SearchBox,
  ],
  template: `
    <ce-app-header [titulo]="id() ? 'Editar venda' : 'Nova venda'" />

    <div class="conteudo">
      @if (venda(); as v) {
        <section class="sucesso" aria-label="Venda registrada">
          <h2>Venda registrada!</h2>
          <dl class="resumo">
            <div class="resumo__linha">
              <dt>Status do pagamento</dt>
              <dd>
                <ce-badge [cor]="v.statusPagamento === 'PAGA' ? 'success' : 'warning'">{{
                  v.statusPagamento
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
        <ol class="passos" [attr.inert]="somenteLeitura() ? '' : null">
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
                {{ rotulo(p) }}
              </button>

              @if (p === passo()) {
                <div class="passo__corpo">
                  @switch (p) {
                    @case ('cliente') {
                      @if (cliente(); as c) {
                        <div class="selecionado">
                          <span>{{ c.nome }}</span>
                          <ce-button variante="ghost" (click)="trocarCliente()">Trocar</ce-button>
                        </div>
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
                    }
                    @case ('itens') {
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
                      <h3>Produtos</h3>
                      <ce-search-box
                        placeholder="Buscar produto por nome…"
                        (buscar)="termoProduto.set($event)"
                        (keydown.enter)="enterProduto($event)"
                      />
                      <ce-data-list
                        [itens]="produtosFiltrados()"
                        [status]="produtosStatus()"
                        vazioTitulo="Nenhum produto encontrado"
                        (recarregar)="carregarProdutos()"
                      >
                        <ng-template let-produto>
                          <ce-produto-card
                            [nome]="produto.nome"
                            [detalhe]="detalheDe(produto)"
                            [precoReferencia]="produto.precoReferencia"
                            [fotoSrc]="produto.fotoUrl"
                            (click)="adicionarProduto(produto)"
                          />
                        </ng-template>
                      </ce-data-list>
                    }
                    @case ('cascos') {
                      <ce-form-field rotulo="Cascos devolvidos">
                        <ce-quantity-stepper
                          [ngModel]="cascosDevolvidos()"
                          (ngModelChange)="cascosDevolvidos.set($event)"
                        />
                      </ce-form-field>
                      <ce-checkbox
                        [ngModel]="cascosNaHora()"
                        (ngModelChange)="alternarNaHora($event)"
                      >
                        Todos devolvidos na hora
                      </ce-checkbox>
                      <ce-form-field
                        rotulo="Sucata entregue"
                        dica="Sucata entregue não abate o débito de casco."
                      >
                        <ce-quantity-stepper
                          [ngModel]="sucataEntregue()"
                          (ngModelChange)="sucataEntregue.set($event)"
                        />
                      </ce-form-field>
                    }
                    @case ('pagamento') {
                      <ce-pagamento-lista [total]="totais().liquido" [(pagamentos)]="pagamentos" />
                      @if (excede()) {
                        <p class="erro" role="alert">{{ mensagemExcede }}</p>
                      }
                    }
                    @case ('revisao') {
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
                    }
                  }
                </div>
              }
            </li>
          }
        </ol>

        @if (!id()) {
          <ce-button variante="ghost" (click)="cancelar()">Cancelar venda</ce-button>
        }
      }
    </div>

    <div class="acoes">
      @if (venda()) {
        <ce-button [block]="true" (click)="reiniciar()">Nova venda</ce-button>
      } @else if (carga() === 'ok' && !somenteLeitura()) {
        @if (indice() > 0) {
          <ce-button variante="ghost" (click)="voltar()">Voltar</ce-button>
        }
        @if (passo() === 'revisao') {
          <ce-button
            [block]="true"
            [loading]="enviando()"
            [disabled]="excede()"
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
    }

    .passos {
      list-style: none;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    .passo__cabecalho {
      @include mixins.touch-target;

      display: flex;
      align-items: center;
      gap: var(--ce-space-3);
      width: 100%;
      font-weight: 600;
      color: var(--ce-text-muted);
      text-align: left;
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
      color: #fff;
    }

    .passo__corpo {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
      margin-left: 14px;
      padding: var(--ce-space-2) 0 var(--ce-space-4) var(--ce-space-5);
      border-left: 2px solid var(--ce-border);
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
  protected readonly produtosFiltrados = computed(() => {
    const termo = semAcento(this.termoProduto());
    return this.produtos().filter((p) => semAcento(p.nome).includes(termo));
  });

  protected readonly totais = computed(() => totaisDe(this.itens()));
  protected readonly pago = computed(() => totalPagoDe(this.pagamentos()));
  protected readonly fiado = computed(() => fiadoDe(this.totais().liquido, this.pagamentos()));
  protected readonly excede = computed(() =>
    pagamentoExcede(this.totais().liquido, this.pagamentos()),
  );
  protected readonly comCascos = computed(() => temAgua(this.itens()));

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
  }

  protected trocarCliente(): void {
    this.cliente.set(null);
    this.enderecoId.set(null);
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
    this.passo.set('cliente');
  }
}
