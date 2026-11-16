import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ClientesApi } from '../../core/api/clientes-api';
import { EstoqueApi } from '../../core/api/estoque-api';
import { ClienteResponse, EnderecoResponse } from '../../core/api/models/clientes';
import { ProdutoMarcaResponse, ProdutoResponse } from '../../core/api/models/estoque';
import { rotuloDaMarca } from '../../core/api/produto-leitura';
import { ApiError } from '../../core/http/api-error';
import { OperatorStore } from '../../core/operator/operator-store';
import { Button } from '../../ui/atoms/button';
import { Icon } from '../../ui/atoms/icon';
import { Spinner } from '../../ui/atoms/spinner';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { SearchBox } from '../../ui/molecules/search-box';
import { AppHeader } from '../../ui/organisms/app-header';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { ItemCarrinho } from '../vendas/carrinho';
import {
  SugestaoBusca,
  filtrarPorSugestao,
  filtrarPorTexto,
  linhasDoCatalogo,
  sugestoesDaBusca,
} from '../vendas/busca-produto';
import { SeletorFuncionarios } from '../rh/seletor-funcionarios';
import { adicionarItem, alterarQuantidade, paraCriarPedidoRequest } from './pedido-form';
import { PedidosStore } from './pedidos-store';

@Component({
  selector: 'ce-pedido-novo-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    AppHeader,
    Button,
    FormField,
    Icon,
    PrecoPipe,
    SearchBox,
    SeletorFuncionarios,
    Spinner,
    TextInput,
  ],
  template: `
    <ce-app-header titulo="Novo pedido" [mostrarVoltar]="true" (voltar)="voltar()" />

    <div class="conteudo">
      <section class="bloco" aria-label="Cliente do pedido">
        <h2>Cliente</h2>
        @if (cliente(); as c) {
          <div class="escolhido">
            <span class="nome">{{ c.nome }}</span>
            <ce-button variante="ghost" (click)="trocarCliente()">Trocar</ce-button>
          </div>
        } @else {
          <ce-search-box
            rotulo="Buscar cliente"
            placeholder="Buscar cliente por nome…"
            (buscar)="buscarClientes($event)"
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
      </section>

      @if (cliente(); as c) {
        <section class="bloco" aria-label="Endereço de entrega">
          <h2>Endereço de entrega</h2>
          <div class="pilulas" role="group" aria-label="Endereço de entrega">
            <button
              type="button"
              class="pilula"
              [attr.aria-pressed]="enderecoId() === null"
              (click)="enderecoId.set(null)"
            >
              Sem endereço
            </button>
            @for (e of c.enderecos; track e.id) {
              <button
                type="button"
                class="pilula"
                [attr.aria-pressed]="enderecoId() === e.id"
                (click)="enderecoId.set(e.id)"
              >
                {{ enderecoTexto(e) }}
              </button>
            }
          </div>
        </section>
      }

      <ce-form-field rotulo="Observação">
        <ce-input placeholder="Ex.: entregar depois das 14h" [formControl]="observacao" />
      </ce-form-field>

      <section class="bloco" aria-label="Itens do pedido">
        <h2>Itens</h2>
        @if (itens().length > 0) {
          <ul class="itens">
            @for (item of itens(); track item.produto.id + item.marca.marcaId) {
              <li class="item">
                <span class="item__nome">
                  {{ item.produto.nome }} — {{ rotuloDaMarca(item.marca.marcaNome) }}
                  <span class="dica">{{ item.precoUnitario | cePreco }}</span>
                </span>
                <span class="item__qtd">
                  <button
                    type="button"
                    class="icone"
                    [attr.aria-label]="'Diminuir ' + item.produto.nome"
                    (click)="mudar(item, -1)"
                  >
                    <ce-icon nome="menos" [tamanho]="18" />
                  </button>
                  <span class="qtd">{{ item.quantidade }}</span>
                  <button
                    type="button"
                    class="icone"
                    [attr.aria-label]="'Aumentar ' + item.produto.nome"
                    (click)="mudar(item, 1)"
                  >
                    <ce-icon nome="mais" [tamanho]="18" />
                  </button>
                  <button
                    type="button"
                    class="icone"
                    [attr.aria-label]="'Remover ' + item.produto.nome"
                    (click)="mudar(item, -item.quantidade)"
                  >
                    <ce-icon nome="lixeira" [tamanho]="18" />
                  </button>
                </span>
              </li>
            }
          </ul>
        } @else {
          <p class="dica">Busque e toque nos produtos para adicionar.</p>
        }

        <ce-search-box
          rotulo="Buscar produto"
          placeholder="Buscar produto, marca ou categoria…"
          [valor]="termo()"
          (buscar)="buscarProduto($event)"
        />
        @if (sugestoes().length > 0) {
          <div class="pilulas">
            @for (s of sugestoes(); track s.tipo + s.valor) {
              <button type="button" class="pilula" (click)="escolherSugestao(s)">
                {{ s.valor }}
              </button>
            }
          </div>
        }
        @if (sugestao(); as s) {
          <div class="escolhido">
            <span class="dica">Filtro: {{ s.valor }}</span>
            <ce-button variante="ghost" (click)="sugestao.set(null)">Limpar filtro</ce-button>
          </div>
        }
        @if (statusCatalogo() === 'loading') {
          <div class="carregando"><ce-spinner [tamanho]="20" /></div>
        } @else if (statusCatalogo() === 'error') {
          <p class="erro" role="alert">Não foi possível carregar os produtos.</p>
        } @else {
          <div class="lista">
            @for (l of linhas(); track l.produto.id + l.marca.marcaId) {
              <button type="button" class="opcao" (click)="adicionar(l.produto, l.marca)">
                {{ l.produto.nome }} — {{ rotuloDaMarca(l.marca.marcaNome) }}
                <span class="dica">{{ l.marca.precoReferencia | cePreco }}</span>
              </button>
            } @empty {
              <p class="dica">Nenhum produto encontrado.</p>
            }
          </div>
        }
      </section>

      <section class="bloco" aria-label="Funcionários do pedido">
        <h2>Funcionários <span class="dica">(opcional)</span></h2>
        <ce-seletor-funcionarios [(selecionados)]="funcionarios" />
      </section>

      @if (erro(); as mensagem) {
        <p class="erro" role="alert">{{ mensagem }}</p>
      }

      <ce-button [block]="true" [disabled]="!podeCriar()" [loading]="salvando()" (click)="criar()">
        Criar pedido
      </ce-button>
    </div>
  `,
  styles: `
    @use 'mixins';

    .conteudo {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-4);
      padding: var(--ce-space-4);
    }

    .bloco {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    h2 {
      font-size: var(--ce-font-md);
      font-weight: 600;
    }

    .dica {
      font-size: var(--ce-font-sm);
      font-weight: 400;
      color: var(--ce-text-muted);
    }

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }

    .nome {
      font-weight: 600;
    }

    .escolhido {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ce-space-3);
    }

    .lista,
    .itens {
      list-style: none;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    .opcao {
      @include mixins.touch-target;

      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--ce-space-3);
      padding-inline: var(--ce-space-4);
      border: 1px solid var(--ce-border);
      border-radius: var(--ce-radius-controle);
      background: var(--ce-surface);
      text-align: left;
    }

    .pilulas {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ce-space-2);
    }

    .pilula {
      @include mixins.touch-target;

      padding-inline: var(--ce-space-4);
      border: 1px solid var(--ce-border);
      border-radius: 999px;
      background: var(--ce-surface);
      font-weight: 600;

      &[aria-pressed='true'] {
        border-color: var(--ce-primary);
        background: var(--ce-primary-soft);
        color: var(--ce-primary-strong);
      }
    }

    .item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--ce-space-3);
    }

    .item__nome {
      display: flex;
      flex-direction: column;
    }

    .item__qtd {
      display: inline-flex;
      align-items: center;
      gap: var(--ce-space-1);
    }

    .qtd {
      min-width: 2ch;
      text-align: center;
      font-weight: 600;
    }

    .icone {
      @include mixins.touch-target;

      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      color: inherit;
    }

    .carregando {
      display: flex;
      justify-content: center;
    }
  `,
})
export class PedidoNovoPage implements OnInit {
  private readonly router = inject(Router);
  private readonly store = inject(PedidosStore);
  private readonly clientesApi = inject(ClientesApi);
  private readonly estoqueApi = inject(EstoqueApi);
  private readonly operador = inject(OperatorStore);

  protected readonly rotuloDaMarca = rotuloDaMarca;

  protected readonly clientes = signal<readonly ClienteResponse[]>([]);
  protected readonly erroClientes = signal<string | null>(null);
  protected readonly cliente = signal<ClienteResponse | null>(null);
  protected readonly enderecoId = signal<string | null>(null);
  protected readonly observacao = new FormControl('', { nonNullable: true });

  protected readonly itens = signal<readonly ItemCarrinho[]>([]);
  protected readonly funcionarios = signal<ReadonlySet<string>>(new Set());

  private readonly produtos = signal<readonly ProdutoResponse[]>([]);
  protected readonly statusCatalogo = signal<'loading' | 'ok' | 'error'>('loading');
  protected readonly termo = signal('');
  protected readonly sugestao = signal<SugestaoBusca | null>(null);
  private readonly catalogo = computed(() => linhasDoCatalogo(this.produtos()));
  protected readonly sugestoes = computed(() =>
    this.sugestao() ? [] : sugestoesDaBusca(this.catalogo(), this.termo()),
  );
  protected readonly linhas = computed(() => {
    const s = this.sugestao();
    return s
      ? filtrarPorSugestao(this.catalogo(), s)
      : filtrarPorTexto(this.catalogo(), this.termo());
  });

  protected readonly salvando = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly podeCriar = computed(() => this.cliente() !== null && this.itens().length > 0);

  ngOnInit(): void {
    this.estoqueApi.listarProdutos().subscribe({
      next: (produtos) => {
        this.produtos.set(produtos);
        this.statusCatalogo.set('ok');
      },
      error: () => this.statusCatalogo.set('error'),
    });
  }

  protected voltar(): void {
    this.router.navigateByUrl('/pedidos');
  }

  protected enderecoTexto(e: EnderecoResponse): string {
    return [e.logradouro, e.numero, e.bairro].filter((parte) => !!parte).join(', ');
  }

  protected async buscarClientes(nome: string): Promise<void> {
    this.erroClientes.set(null);
    if (nome === '') {
      this.clientes.set([]);
      return;
    }
    try {
      this.clientes.set(await firstValueFrom(this.clientesApi.listar(nome, 1)));
    } catch (e) {
      this.erroClientes.set(e instanceof ApiError ? e.userMessage : 'Erro ao buscar clientes.');
    }
  }

  protected async selecionarCliente(resumo: ClienteResponse): Promise<void> {
    this.cliente.set(resumo);
    this.enderecoId.set(null);
    this.clientes.set([]);
    this.erro.set(null);
    // A lista de clientes não traz endereços: só o detalhe os devolve.
    let cliente: ClienteResponse;
    try {
      cliente = await firstValueFrom(this.clientesApi.obter(resumo.id));
    } catch (e) {
      this.erro.set(e instanceof ApiError ? e.userMessage : 'Erro ao carregar o cliente.');
      return;
    }
    if (this.cliente()?.id !== resumo.id) {
      return; // trocou de cliente enquanto o detalhe carregava
    }
    this.cliente.set(cliente);
    // O principal (ou o único) vem pré-selecionado.
    const padrao =
      cliente.enderecos.find((e) => e.principal) ??
      (cliente.enderecos.length === 1 ? cliente.enderecos[0] : null);
    this.enderecoId.set(padrao?.id ?? null);
  }

  protected trocarCliente(): void {
    this.cliente.set(null);
    this.enderecoId.set(null);
  }

  protected buscarProduto(termo: string): void {
    this.termo.set(termo);
    this.sugestao.set(null);
  }

  protected escolherSugestao(s: SugestaoBusca): void {
    this.sugestao.set(s);
  }

  protected adicionar(produto: ProdutoResponse, marca: ProdutoMarcaResponse): void {
    this.itens.update((itens) => adicionarItem(itens, produto, marca));
  }

  protected mudar(item: ItemCarrinho, delta: number): void {
    this.itens.update((itens) => alterarQuantidade(itens, item.produto, item.marca, delta));
  }

  protected async criar(): Promise<void> {
    const cliente = this.cliente();
    const operador = this.operador.operator();
    if (!cliente || !operador || this.itens().length === 0) {
      return;
    }
    this.erro.set(null);
    this.salvando.set(true);
    try {
      const pedido = await this.store.criar(
        paraCriarPedidoRequest({
          funcionarioId: operador.id,
          clienteId: cliente.id,
          enderecoEntregaId: this.enderecoId(),
          itens: this.itens(),
          funcionariosIds: [...this.funcionarios()],
          observacao: this.observacao.value,
        }),
      );
      await this.router.navigateByUrl('/pedidos/' + pedido.id);
    } catch (e: unknown) {
      this.erro.set(e instanceof ApiError ? e.userMessage : 'Erro ao criar o pedido.');
    } finally {
      this.salvando.set(false);
    }
  }
}
