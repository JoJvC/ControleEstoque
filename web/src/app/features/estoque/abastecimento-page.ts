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

import { TipoFrete } from '../../core/api/models/estoque';
import { ApiError } from '../../core/http/api-error';
import { OperatorStore } from '../../core/operator/operator-store';
import { ToastService } from '../../core/toast/toast-service';
import { Button } from '../../ui/atoms/button';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { MoneyInput } from '../../ui/molecules/money-input';
import { QuantityStepper } from '../../ui/molecules/quantity-stepper';
import { AppHeader } from '../../ui/organisms/app-header';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { ProdutosStore } from '../produtos/produtos-store';
import { EstoqueStore } from './estoque-store';

interface Linha {
  qtd: FormControl<number>;
  custo: FormControl<number | null>;
}

/** Sugestão do protótipo para "Repor" (js/app.js:111): só preenche, editável. */
const QTD_SUGERIDA = 12;

const FRETES: { value: TipoFrete; label: string }[] = [
  { value: 'TERCEIRIZADO', label: 'Fornecedor entrega' },
  { value: 'PROPRIO', label: 'Retirada nossa' },
];

@Component({
  selector: 'ce-abastecimento-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    AppHeader,
    Button,
    TextInput,
    FormField,
    MoneyInput,
    QuantityStepper,
    PrecoPipe,
  ],
  template: `
    <ce-app-header titulo="Chegou mercadoria" [mostrarVoltar]="true" (voltar)="voltar()" />

    <form class="form" (submit)="$event.preventDefault(); salvar()">
      <section class="itens">
        <h2 class="itens__titulo">Itens recebidos</h2>
        <p class="itens__dica">
          Itens abaixo do mínimo vêm primeiro. Informe a quantidade do que chegou.
        </p>

        @for (l of linhas(); track l.id) {
          <div class="item" [class.item--sel]="ctl(l.id).qtd.value > 0">
            <div class="item__info">
              <b>{{ l.nome }}</b>
              <span class="item__estoque">
                tem {{ l.estoque }}
                @if (l.abaixo) {
                  · <span class="item__alerta">abaixo do mínimo ({{ l.minimo }})</span>
                }
              </span>
            </div>
            <ce-quantity-stepper [formControl]="ctl(l.id).qtd" [min]="0" [item]="l.nome" />
            @if (ctl(l.id).qtd.value > 0) {
              <div class="item__custo">
                <ce-form-field rotulo="Custo unitário" [obrigatorio]="true">
                  <ce-money-input [formControl]="ctl(l.id).custo" />
                </ce-form-field>
              </div>
            }
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

        <ce-form-field
          rotulo="Custo total da carga (R$)"
          [obrigatorio]="true"
          dica="Produtos + frete — vai para o financeiro."
        >
          <ce-money-input [formControl]="custoTotal" />
        </ce-form-field>

        @if (somaItens() > 0) {
          <ce-button variante="ghost" (click)="usarSomaDosItens()">
            Usar soma dos itens ({{ somaItens() | cePreco }})
          </ce-button>
        }

        <ce-form-field rotulo="Observação">
          <ce-input placeholder="Opcional" [formControl]="observacao" />
        </ce-form-field>

        @if (erroForm(); as erro) {
          <p class="form__erro" role="alert">{{ erro }}</p>
        }

        <div class="resumo">
          <span>{{ totalProdutos() }} {{ totalProdutos() === 1 ? 'produto' : 'produtos' }}</span>
          <b>{{ totalUnidades() }} un</b>
        </div>
        <ce-button tipo="submit" [block]="true" [loading]="salvando()">
          Chegou mercadoria
        </ce-button>
      </div>
    </form>
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

    .item__custo {
      grid-column: 1 / -1;
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
  private readonly produtosStore = inject(ProdutosStore);
  private readonly operatorStore = inject(OperatorStore);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly produtoIdInicial =
    inject(ActivatedRoute).snapshot.queryParamMap.get('produtoId');

  protected readonly fretes = FRETES;

  private readonly controles = new Map<string, Linha>();
  private readonly versao = signal(0);

  protected readonly tipoFrete = new FormControl<TipoFrete | null>(null, Validators.required);
  protected readonly custoTotal = new FormControl<number | null>(null);
  protected readonly observacao = new FormControl('', { nonNullable: true });

  protected readonly salvando = signal(false);
  protected readonly erroForm = signal<string | null>(null);

  /** Abaixo do mínimo vem primeiro; o flag é do servidor, sem conta no front. */
  protected readonly linhas = computed(() => {
    const saldos = new Map(this.estoqueStore.itens().map((i) => [i.produtoId, i]));
    return this.produtosStore
      .produtos()
      .map((p) => ({
        id: p.id,
        nome: [p.nome, p.tamanho].filter(Boolean).join(' '),
        estoque: saldos.get(p.id)?.quantidade ?? 0,
        minimo: saldos.get(p.id)?.estoqueMinimo ?? p.estoqueMinimo,
        abaixo: saldos.get(p.id)?.abaixoMinimo ?? false,
      }))
      .sort((a, b) => Number(b.abaixo) - Number(a.abaixo));
  });

  private readonly selecionados = computed(() => {
    this.versao();
    return this.linhas().filter((l) => this.ctl(l.id).qtd.value > 0);
  });
  protected readonly totalProdutos = computed(() => this.selecionados().length);
  protected readonly totalUnidades = computed(() =>
    this.selecionados().reduce((s, l) => s + this.ctl(l.id).qtd.value, 0),
  );
  protected readonly somaItens = computed(() =>
    this.selecionados().reduce((s, l) => {
      const c = this.ctl(l.id);
      return s + c.qtd.value * (c.custo.value ?? 0);
    }, 0),
  );

  constructor() {
    this.produtosStore.carregar();
    this.estoqueStore.carregar();
    // Repor (Hoje) abre com o item; id desconhecido deixa tudo vazio.
    let preenchido = this.produtoIdInicial === null;
    effect(() => {
      const produtos = this.produtosStore.produtos();
      if (preenchido || produtos.length === 0) return;
      preenchido = true;
      if (produtos.some((p) => p.id === this.produtoIdInicial)) {
        this.ctl(this.produtoIdInicial as string).qtd.setValue(QTD_SUGERIDA);
      }
    });
  }

  protected ctl(id: string): Linha {
    let c = this.controles.get(id);
    if (!c) {
      c = {
        qtd: new FormControl(0, { nonNullable: true }),
        custo: new FormControl<number | null>(null),
      };
      c.qtd.valueChanges.subscribe(() => this.versao.update((v) => v + 1));
      c.custo.valueChanges.subscribe(() => this.versao.update((v) => v + 1));
      this.controles.set(id, c);
    }
    return c;
  }

  protected usarSomaDosItens(): void {
    this.custoTotal.setValue(this.somaItens());
  }

  protected async salvar(): Promise<void> {
    this.erroForm.set(null);

    const itens = this.selecionados().map((l) => ({ l, c: this.ctl(l.id) }));
    if (itens.length === 0) {
      this.erroForm.set('Informe a quantidade de ao menos um produto.');
      return;
    }
    if (itens.some(({ c }) => c.custo.value === null)) {
      this.erroForm.set('Informe o custo unitário de todos os itens.');
      return;
    }
    if (this.tipoFrete.value === null) {
      this.erroForm.set('Informe o tipo de frete.');
      return;
    }
    if (this.custoTotal.value === null) {
      this.erroForm.set('Informe o custo total do abastecimento.');
      return;
    }

    this.salvando.set(true);
    try {
      await this.estoqueStore.abastecer({
        tipoFrete: this.tipoFrete.value,
        custoTotal: this.custoTotal.value,
        funcionarioId: this.operatorStore.operator()?.id ?? null,
        observacao: this.observacao.value.trim() || null,
        itens: itens.map(({ l, c }) => ({
          produtoId: l.id,
          quantidade: c.qtd.value,
          custoUnitario: c.custo.value as number,
        })),
      });
      this.toast.success('Abastecimento registrado!');
      this.router.navigateByUrl('/estoque');
    } catch (erro: unknown) {
      this.erroForm.set(
        erro instanceof ApiError ? erro.userMessage : 'Erro ao registrar o abastecimento.',
      );
    } finally {
      this.salvando.set(false);
    }
  }

  protected voltar(): void {
    this.router.navigateByUrl('/estoque');
  }
}
