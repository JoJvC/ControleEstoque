import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { TipoFrete } from '../../core/api/models/estoque';
import { ApiError } from '../../core/http/api-error';
import { OperatorStore } from '../../core/operator/operator-store';
import { ToastService } from '../../core/toast/toast-service';
import { Button } from '../../ui/atoms/button';
import { Icon } from '../../ui/atoms/icon';
import { Select } from '../../ui/atoms/select';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { MoneyInput } from '../../ui/molecules/money-input';
import { QuantityStepper } from '../../ui/molecules/quantity-stepper';
import { AppHeader } from '../../ui/organisms/app-header';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { ProdutosStore } from '../produtos/produtos-store';
import { EstoqueStore } from './estoque-store';

type ItemForm = FormGroup<{
  produtoId: FormControl<string | null>;
  quantidade: FormControl<number>;
  custoUnitario: FormControl<number | null>;
}>;

const FRETES: { value: TipoFrete; label: string }[] = [
  { value: 'TERCEIRIZADO', label: 'Frete terceirizado' },
  { value: 'PROPRIO', label: 'Caminhão/funcionário próprio' },
];

@Component({
  selector: 'ce-abastecimento-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    AppHeader,
    Button,
    Icon,
    Select,
    TextInput,
    FormField,
    MoneyInput,
    QuantityStepper,
    PrecoPipe,
  ],
  template: `
    <ce-app-header titulo="Abastecimento" [mostrarVoltar]="true" (voltar)="voltar()" />

    <form class="form" (submit)="$event.preventDefault(); salvar()">
      <section class="itens">
        <h2 class="itens__titulo">Itens recebidos</h2>

        @for (item of itens.controls; track item; let indice = $index) {
          <div class="item">
            <ce-form-field rotulo="Produto" [obrigatorio]="true">
              <ce-select
                [opcoes]="produtosOpcoes()"
                placeholder="Selecione…"
                [formControl]="item.controls.produtoId"
              />
            </ce-form-field>
            <div class="item__linha">
              <ce-form-field rotulo="Quantidade">
                <ce-quantity-stepper [formControl]="item.controls.quantidade" [min]="1" />
              </ce-form-field>
              <ce-form-field rotulo="Custo unitário" [obrigatorio]="true">
                <ce-money-input [formControl]="item.controls.custoUnitario" />
              </ce-form-field>
              @if (itens.length > 1) {
                <button
                  type="button"
                  class="item__remover"
                  aria-label="Remover item"
                  (click)="removerItem(indice)"
                >
                  <ce-icon nome="lixeira" [tamanho]="20" />
                </button>
              }
            </div>
          </div>
        }

        <ce-button variante="ghost" (click)="adicionarItem()">
          <ce-icon nome="mais" [tamanho]="18" /> Adicionar item
        </ce-button>
      </section>

      <ce-form-field rotulo="Tipo de frete" [obrigatorio]="true">
        <ce-select [opcoes]="fretes" placeholder="Selecione…" [formControl]="tipoFrete" />
      </ce-form-field>

      <ce-form-field
        rotulo="Custo total"
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

      <ce-button tipo="submit" [block]="true" [loading]="salvando()">
        Registrar abastecimento
      </ce-button>
    </form>
  `,
  styles: `
    @use 'mixins';

    .form {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-4);
      padding: 0 var(--ce-space-4) var(--ce-space-6);
      max-width: 560px;

      @include mixins.from-tablet {
        margin-inline: auto;
        width: 100%;
      }
    }

    .itens {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .itens__titulo {
      font-size: var(--ce-font-lg);
    }

    .item {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
      padding: var(--ce-space-3);
      border: 1px solid var(--ce-border);
      border-radius: var(--ce-radius-md);
      background: var(--ce-surface);
    }

    .item__linha {
      display: flex;
      align-items: flex-end;
      gap: var(--ce-space-3);

      ce-form-field:last-of-type {
        flex: 1;
      }
    }

    .item__remover {
      @include mixins.touch-target;

      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--ce-danger);
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

  protected readonly fretes = FRETES;

  protected readonly itens = new FormArray<ItemForm>([this.novoItem()]);
  protected readonly tipoFrete = new FormControl<TipoFrete | null>(null, Validators.required);
  protected readonly custoTotal = new FormControl<number | null>(null);
  protected readonly observacao = new FormControl('', { nonNullable: true });

  protected readonly salvando = signal(false);
  protected readonly erroForm = signal<string | null>(null);
  protected readonly somaItens = signal(0);

  protected readonly produtosOpcoes = computed(() =>
    this.produtosStore.produtos().map((p) => ({
      value: p.id,
      label: [p.nome, p.tamanho].filter(Boolean).join(' '),
    })),
  );

  constructor() {
    this.produtosStore.carregar();
    this.itens.valueChanges.subscribe(() => this.somaItens.set(this.calcularSoma()));
  }

  protected adicionarItem(): void {
    this.itens.push(this.novoItem());
  }

  protected removerItem(indice: number): void {
    this.itens.removeAt(indice);
  }

  protected usarSomaDosItens(): void {
    this.custoTotal.setValue(this.somaItens());
  }

  protected async salvar(): Promise<void> {
    this.erroForm.set(null);

    const itens = this.itens.controls.map((item) => item.getRawValue());
    if (itens.some((item) => item.produtoId === null)) {
      this.erroForm.set('Selecione o produto de todos os itens.');
      return;
    }
    if (itens.some((item) => item.custoUnitario === null)) {
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
        itens: itens.map((item) => ({
          produtoId: item.produtoId as string,
          quantidade: item.quantidade,
          custoUnitario: item.custoUnitario as number,
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

  private novoItem(): ItemForm {
    return new FormGroup({
      produtoId: new FormControl<string | null>(null),
      quantidade: new FormControl(1, { nonNullable: true }),
      custoUnitario: new FormControl<number | null>(null),
    });
  }

  private calcularSoma(): number {
    return this.itens.controls.reduce((soma, item) => {
      const { quantidade, custoUnitario } = item.getRawValue();
      return soma + quantidade * (custoUnitario ?? 0);
    }, 0);
  }
}
