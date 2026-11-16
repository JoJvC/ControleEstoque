import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ProdutoResponse, TipoFrete } from '../../core/api/models/estoque';
import { rotuloDaMarca } from '../../core/api/produto-leitura';
import { ApiError } from '../../core/http/api-error';
import { CePermissao } from '../../core/permissions/ce-permissao';
import { PermissionService } from '../../core/permissions/permission-service';
import { semAcento } from '../../core/util/sem-acento';
import { ToastService } from '../../core/toast/toast-service';
import { Button } from '../../ui/atoms/button';
import { Icon } from '../../ui/atoms/icon';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { QuantityStepper } from '../../ui/molecules/quantity-stepper';
import { SearchBox } from '../../ui/molecules/search-box';
import { AppHeader } from '../../ui/organisms/app-header';
import { TiposCascoStore } from '../produtos/tipos-casco-store';
import {
  LinhaProduto,
  SugestaoBusca,
  filtrarPorSugestao,
  filtrarPorTexto,
  linhasDoCatalogo,
  sugestoesDaBusca,
} from '../vendas/busca-produto';
import { categoriasDe, filtrarPorCategoria } from '../vendas/carrinho';
import { nomeComTamanho } from './estoque-grupos';
import { FRETES, QuantidadeDigitada, corpoDaCarga } from './abastecimento-linhas';
import { AbastecimentoStore } from './abastecimento-store';
import { EstoqueStore } from './estoque-store';

@Component({
  selector: 'ce-abastecimento-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    CePermissao,
    AppHeader,
    Button,
    Icon,
    TextInput,
    FormField,
    QuantityStepper,
    SearchBox,
  ],
  template: `
    <ce-app-header titulo="Chegou mercadoria" [mostrarVoltar]="true" (voltar)="voltar()" />

    @if (criadoId(); as id) {
      <section class="criado">
        <p role="status">Mercadoria registrada. O custo pode ser lançado agora ou depois.</p>
        <ce-button *cePermissao="'estoque.custos'" [block]="true" (click)="lancarCustos(id)">
          Lançar custos
        </ce-button>
        <ce-button variante="ghost" [block]="true" (click)="voltar()">Voltar ao estoque</ce-button>
      </section>
    } @else {
      <form class="form" (submit)="$event.preventDefault(); salvar()">
        <section class="itens">
          <h2 class="itens__titulo">Itens recebidos</h2>
          <p class="itens__dica">Informe a quantidade do que chegou.</p>

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
          @if (produtoFiltro(); as produto) {
            <span class="filtro" role="group" aria-label="Filtro do produto">
              Produto: {{ nomeDe(produto) }}
              <button type="button" aria-label="Limpar filtro" (click)="produtoFiltro.set(null)">
                <ce-icon nome="fechar" [tamanho]="16" />
              </button>
            </span>
          }
          @if (filtroSugestao(); as filtro) {
            <span class="filtro" role="group" aria-label="Filtro da busca">
              {{ rotuloDaSugestao(filtro) }}
              <button type="button" aria-label="Limpar filtro" (click)="limparSugestao()">
                <ce-icon nome="fechar" [tamanho]="16" />
              </button>
            </span>
          }

          @for (l of linhasVisiveis(); track l.marca.id) {
            <div class="item" [class.item--sel]="ctl('item', l.marca.id).value > 0">
              <div class="item__info">
                <b>{{ rotuloDaLinha(l) }}</b>
                <span class="item__estoque">
                  tem {{ l.marca.quantidade }}
                  @if (l.marca.abaixoMinimo) {
                    ·
                    <span class="item__alerta">abaixo do mínimo ({{ l.marca.estoqueMinimo }})</span>
                  }
                </span>
              </div>
              <ce-quantity-stepper
                [formControl]="ctl('item', l.marca.id)"
                [min]="0"
                [item]="rotuloDaLinha(l)"
              />
            </div>
          }
          @for (c of vasilhamesVisiveis(); track c.id) {
            <div class="item" [class.item--sel]="ctl('casco', c.id).value > 0">
              <div class="item__info">
                <b>Vasilhame {{ c.nome }}</b>
                <span class="item__estoque">tem {{ vaziosDe(c.id) }}</span>
              </div>
              <ce-quantity-stepper
                [formControl]="ctl('casco', c.id)"
                [min]="0"
                [item]="'Vasilhame ' + c.nome"
              />
            </div>
          }
        </section>

        <div class="lateral">
          <div class="frete" role="group" aria-label="Tipo de frete">
            <span class="frete__rotulo">Frete</span>
            <div class="seg">
              @for (f of fretes; track f.value) {
                <button
                  type="button"
                  [attr.aria-pressed]="tipoFrete.value === f.value"
                  (click)="tipoFrete.setValue(f.value)"
                >
                  {{ f.label }}
                </button>
              }
            </div>
          </div>

          <ce-form-field rotulo="Observação">
            <ce-input placeholder="Opcional" [formControl]="observacao" />
          </ce-form-field>

          @if (erroForm(); as erro) {
            <p class="form__erro" role="alert">{{ erro }}</p>
          }

          <div class="resumo">
            <span>{{ totalLinhas() }} {{ totalLinhas() === 1 ? 'item' : 'itens' }}</span>
            <b>{{ totalUnidades() }} un</b>
          </div>
          <ce-button tipo="submit" [block]="true" [loading]="salvando()">
            Chegou mercadoria
          </ce-button>
        </div>
      </form>
    }
  `,
  styles: `
    @use 'mixins';

    .form {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-4);
      padding: 0 var(--ce-space-4) var(--ce-space-6);

      @include mixins.from-desktop {
        display: grid;
        grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
        gap: var(--ce-space-6);
        align-items: start;
      }
    }

    .itens,
    .lateral {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .itens__titulo {
      font-size: var(--ce-font-lg);
    }

    .itens__dica,
    .item__estoque,
    .frete__rotulo {
      color: var(--ce-text-muted);
      font-size: var(--ce-font-sm);
    }

    .item {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: var(--ce-space-2) var(--ce-space-3);
      padding: var(--ce-space-3);
      border: 1px solid var(--ce-border);
      border-radius: 16px;
      background: var(--ce-surface);
    }

    .item--sel {
      border: 2px solid var(--ce-primary);
    }

    .item__info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .item__alerta {
      color: var(--ce-danger);
      font-weight: 600;
    }

    .pilulas,
    .sugestoes {
      display: flex;
      gap: var(--ce-space-2);
    }

    .pilulas {
      overflow-x: auto;
    }

    .sugestoes {
      flex-wrap: wrap;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .pilula,
    .sugestao {
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

    .filtro {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      gap: var(--ce-space-2);
      font-weight: 600;
    }

    .criado {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
      padding: var(--ce-space-4);
    }

    .seg {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: 1fr;
      gap: 4px;
      padding: 4px;
      margin-top: var(--ce-space-1);
      background: var(--ce-surface-muted);
      border: 1px solid var(--ce-border);
      border-radius: 14px;

      button {
        @include mixins.touch-target;

        border-radius: 10px;
        font-weight: 600;
      }

      button[aria-pressed='true'] {
        background: var(--ce-primary);
        color: var(--ce-text-on-primary);
      }
    }

    .resumo {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .form__erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class AbastecimentoPage {
  private readonly estoqueStore = inject(EstoqueStore);
  private readonly tiposCascoStore = inject(TiposCascoStore);
  private readonly store = inject(AbastecimentoStore);
  private readonly permissoes = inject(PermissionService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly produtoIdInicial =
    inject(ActivatedRoute).snapshot.queryParamMap.get('produtoId');

  protected readonly fretes = FRETES;

  private readonly controles = new Map<string, FormControl<number>>();
  private readonly versao = signal(0);

  protected readonly tipoFrete = new FormControl<TipoFrete | null>(null, Validators.required);
  protected readonly observacao = new FormControl('', { nonNullable: true });

  protected readonly salvando = signal(false);
  protected readonly erroForm = signal<string | null>(null);
  protected readonly criadoId = signal<string | null>(null);

  // Busca e filtros iguais aos da venda: a API não filtra por texto, o catálogo inteiro vem de uma vez.
  protected readonly termoProduto = signal('');
  protected readonly textoBusca = signal('');
  protected readonly filtroSugestao = signal<SugestaoBusca | null>(null);
  protected readonly categoria = signal<string | null>(null);
  /** Vem de ?produtoId= (Repor): filtra pelo id, já que o nome se repete entre tamanhos. */
  protected readonly produtoFiltro = signal<ProdutoResponse | null>(null);
  private readonly catalogo = computed(() => linhasDoCatalogo(this.estoqueStore.produtos()));
  protected readonly categorias = computed(() => categoriasDe(this.estoqueStore.produtos()));
  protected readonly sugestoes = computed(() =>
    sugestoesDaBusca(this.catalogo(), this.termoProduto()),
  );

  /** Abaixo do mínimo vem primeiro; o flag é do servidor, sem conta no front. */
  protected readonly linhasVisiveis = computed(() => {
    const porCategoria = filtrarPorCategoria(this.catalogo(), this.categoria());
    const filtro = this.filtroSugestao();
    const porSugestao = filtro === null ? porCategoria : filtrarPorSugestao(porCategoria, filtro);
    const produto = this.produtoFiltro();
    const porProduto =
      produto === null ? porSugestao : porSugestao.filter((l) => l.produto.id === produto.id);
    return [...filtrarPorTexto(porProduto, this.termoProduto())].sort(
      (a, b) => Number(b.marca.abaixoMinimo) - Number(a.marca.abaixoMinimo),
    );
  });

  /** Vasilhame entra na mesma lista; some quando há filtro de produto ou categoria. */
  protected readonly vasilhamesVisiveis = computed(() => {
    if (
      this.categoria() !== null ||
      this.filtroSugestao() !== null ||
      this.produtoFiltro() !== null
    )
      return [];
    const termo = semAcento(this.termoProduto().trim());
    return this.tiposCascoStore
      .tipos()
      .filter((c) => semAcento(`vasilhame ${c.nome}`).includes(termo));
  });

  // Todas as linhas, não só as visíveis: filtrar a lista não descarta o que já foi digitado.
  private readonly selecionadas = computed<QuantidadeDigitada[]>(() => {
    this.versao();
    return [
      ...this.catalogo().map(({ marca }) => ({
        tipo: 'item' as const,
        id: marca.id,
        quantidade: this.ctl('item', marca.id).value,
      })),
      ...this.tiposCascoStore.tipos().map((c) => ({
        tipo: 'casco' as const,
        id: c.id,
        quantidade: this.ctl('casco', c.id).value,
      })),
    ].filter((l) => l.quantidade > 0);
  });
  protected readonly totalLinhas = computed(() => this.selecionadas().length);
  protected readonly totalUnidades = computed(() =>
    this.selecionadas().reduce((s, l) => s + l.quantidade, 0),
  );

  constructor() {
    this.estoqueStore.carregar();
    void this.tiposCascoStore.carregar();
    // Repor (Hoje) abre filtrando o produto; id desconhecido deixa a lista inteira.
    let aplicado = this.produtoIdInicial === null;
    effect(() => {
      const produtos = this.estoqueStore.produtos();
      if (aplicado || produtos.length === 0) return;
      aplicado = true;
      const produto = produtos.find((p) => p.id === this.produtoIdInicial);
      if (produto) this.produtoFiltro.set(produto);
    });
  }

  protected ctl(tipo: 'item' | 'casco', id: string): FormControl<number> {
    const chave = `${tipo}:${id}`;
    let c = this.controles.get(chave);
    if (!c) {
      c = new FormControl(0, { nonNullable: true });
      c.valueChanges.subscribe(() => this.versao.update((v) => v + 1));
      this.controles.set(chave, c);
    }
    return c;
  }

  protected nomeDe(produto: ProdutoResponse): string {
    return nomeComTamanho(produto.nome, produto.tamanho);
  }

  protected rotuloDaLinha({ produto, marca }: LinhaProduto): string {
    return `${nomeComTamanho(produto.nome, produto.tamanho)} — ${rotuloDaMarca(marca.marcaNome)}`;
  }

  protected rotuloDaSugestao(s: SugestaoBusca): string {
    const valor = s.tipo === 'marca' ? rotuloDaMarca(s.valor) : s.valor;
    return `${{ nome: 'Produto', marca: 'Marca', categoria: 'Categoria' }[s.tipo]}: ${valor}`;
  }

  protected vaziosDe(tipoCascoId: string): number {
    return this.estoqueStore.cascos().find((c) => c.tipoCascoId === tipoCascoId)?.vazios ?? 0;
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

  protected async salvar(): Promise<void> {
    this.erroForm.set(null);

    const { itens, cascos } = corpoDaCarga(this.selecionadas());
    if (itens.length + cascos.length === 0) {
      this.erroForm.set('Informe a quantidade de ao menos um item.');
      return;
    }
    if (this.tipoFrete.value === null) {
      this.erroForm.set('Informe o tipo de frete.');
      return;
    }

    this.salvando.set(true);
    try {
      const id = await this.store.registrar({
        tipoFrete: this.tipoFrete.value,
        observacao: this.observacao.value.trim() || null,
        itens,
        cascos,
      });
      this.toast.success('Abastecimento registrado!');
      if (this.permissoes.has('estoque.custos')) {
        this.criadoId.set(id);
      } else {
        this.router.navigateByUrl('/estoque');
      }
    } catch (erro: unknown) {
      this.erroForm.set(
        erro instanceof ApiError ? erro.userMessage : 'Erro ao registrar o abastecimento.',
      );
    } finally {
      this.salvando.set(false);
    }
  }

  protected lancarCustos(id: string): void {
    this.router.navigateByUrl(`/estoque/abastecimento/${id}/custos`);
  }

  protected voltar(): void {
    this.router.navigateByUrl('/estoque');
  }
}
