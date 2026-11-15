import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { ProdutoMarcaResponse, ProdutoResponse } from '../../core/api/models/estoque';
import { rotuloDaMarca } from '../../core/api/produto-leitura';
import { TipoDesconto } from '../../core/api/models/vendas';
import { Button } from '../../ui/atoms/button';
import { Checkbox } from '../../ui/atoms/checkbox';
import { TextInput } from '../../ui/atoms/text-input';
import { FormField } from '../../ui/molecules/form-field';
import { MoneyInput } from '../../ui/molecules/money-input';
import { QuantityStepper } from '../../ui/molecules/quantity-stepper';
import { SheetShell } from '../../ui/organisms/sheet-shell';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { ItemCarrinho, brutoDe, totalItemDe, valorDescontoDe } from './carrinho';

export interface ItemVendaSheetDados {
  readonly produto: ProdutoResponse;
  readonly marca: ProdutoMarcaResponse;
  readonly existente: ItemCarrinho | null;
  /** Preço do vasilhame do tipo de casco; null = sem opção (descartável ou sem tipo resolvido). */
  readonly precoVasilhame: number | null;
}

/** Resultado: ItemCarrinho (adicionar/atualizar), 'remover' ou undefined (cancelou). */
export type ItemVendaSheetResultado = ItemCarrinho | 'remover';

@Component({
  selector: 'ce-item-venda-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    SheetShell,
    Button,
    Checkbox,
    TextInput,
    FormField,
    MoneyInput,
    QuantityStepper,
    PrecoPipe,
  ],
  template: `
    <ce-sheet-shell [titulo]="titulo" (fechar)="ref.close()">
      <form class="form" (submit)="$event.preventDefault(); confirmar()">
        <div class="linha">
          <ce-form-field rotulo="Quantidade">
            <ce-quantity-stepper [formControl]="quantidade" [min]="1" />
          </ce-form-field>
          <ce-form-field
            rotulo="Preço unitário"
            dica="Sugestão: {{ precoSugerido | cePreco }} — edite à vontade."
          >
            <ce-money-input [formControl]="preco" />
          </ce-form-field>
        </div>

        @if (dados.precoVasilhame !== null) {
          <ce-checkbox [formControl]="pagouVasilhame">
            Pagou o vasilhame (+ {{ dados.precoVasilhame | cePreco }} por unidade)
          </ce-checkbox>
        }

        <ce-checkbox [formControl]="comDesconto">Aplicar desconto neste item</ce-checkbox>

        @if (comDescontoAtivo()) {
          <div class="desconto">
            <div class="desconto__tipo" role="radiogroup" aria-label="Tipo de desconto">
              <button
                type="button"
                class="desconto__opcao"
                [class.desconto__opcao--ativa]="tipoDesconto() === 'VALOR'"
                role="radio"
                [attr.aria-checked]="tipoDesconto() === 'VALOR'"
                (click)="tipoDesconto.set('VALOR')"
              >
                Valor (R$)
              </button>
              <button
                type="button"
                class="desconto__opcao"
                [class.desconto__opcao--ativa]="tipoDesconto() === 'PERCENTUAL'"
                role="radio"
                [attr.aria-checked]="tipoDesconto() === 'PERCENTUAL'"
                (click)="tipoDesconto.set('PERCENTUAL')"
              >
                Percentual (%)
              </button>
            </div>

            @if (tipoDesconto() === 'VALOR') {
              <ce-form-field rotulo="Valor do desconto" [obrigatorio]="true">
                <ce-money-input [formControl]="descontoValor" />
              </ce-form-field>
            } @else {
              <ce-form-field
                rotulo="Percentual do desconto"
                [obrigatorio]="true"
                dica="De 0 a 100."
              >
                <ce-input placeholder="10" inputmode="decimal" [formControl]="descontoPercentual" />
              </ce-form-field>
            }

            <ce-form-field rotulo="Motivo do desconto" [obrigatorio]="true">
              <ce-input placeholder="Ex.: cliente antigo, promoção…" [formControl]="motivo" />
            </ce-form-field>
          </div>
        }

        <dl class="totais">
          <div class="totais__linha">
            <dt>Bruto</dt>
            <dd>{{ bruto() | cePreco }}</dd>
          </div>
          @if (descontoCalculado() > 0) {
            <div class="totais__linha totais__linha--desconto">
              <dt>Desconto</dt>
              <dd>− {{ descontoCalculado() | cePreco }}</dd>
            </div>
          }
          <div class="totais__linha totais__linha--total">
            <dt>Total do item</dt>
            <dd>{{ totalCalculado() | cePreco }}</dd>
          </div>
        </dl>

        @if (erro(); as mensagem) {
          <p class="erro" role="alert">{{ mensagem }}</p>
        }

        <ce-button tipo="submit" [block]="true">
          {{ dados.existente === null ? 'Adicionar ao carrinho' : 'Atualizar item' }}
        </ce-button>
        @if (dados.existente !== null) {
          <ce-button variante="danger" [block]="true" (click)="remover()">
            Remover do carrinho
          </ce-button>
        }
      </form>
    </ce-sheet-shell>
  `,
  styles: `
    @use 'mixins';

    .form {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .linha {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: var(--ce-space-3);
      align-items: start;
    }

    .linha > * {
      min-width: 0;
    }

    .desconto {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
      padding: var(--ce-space-3);
      border: 1px dashed var(--ce-border);
      border-radius: 20px;
    }

    .desconto__tipo {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--ce-space-2);
    }

    .desconto__opcao {
      @include mixins.touch-target;

      border: 1px solid var(--ce-border);
      border-radius: var(--ce-radius-controle);
      background: var(--ce-surface);
      font-weight: 600;
      color: var(--ce-text-muted);
    }

    .desconto__opcao--ativa {
      border-color: var(--ce-primary);
      background: var(--ce-primary-soft);
      color: var(--ce-primary-strong);
    }

    .totais {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-1);
      padding: var(--ce-space-3);
      border-radius: 20px;
      background: var(--ce-surface-muted);
    }

    .totais__linha {
      display: flex;
      justify-content: space-between;

      dd {
        @include mixins.tabular-numbers;

        font-weight: 600;
      }
    }

    .totais__linha--desconto {
      color: var(--ce-warning);
    }

    .totais__linha--total dd {
      font-weight: 700;
      font-size: var(--ce-font-lg);
    }

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class ItemVendaSheet {
  protected readonly ref = inject(DialogRef<ItemVendaSheetResultado>);
  protected readonly dados = inject<ItemVendaSheetDados>(DIALOG_DATA);
  protected readonly precoSugerido = this.dados.marca.precoReferencia;
  protected readonly titulo = `${this.dados.produto.nome} — ${rotuloDaMarca(this.dados.marca.marcaNome)}`;

  protected readonly quantidade = new FormControl(this.dados.existente?.quantidade ?? 1, {
    nonNullable: true,
  });
  protected readonly preco = new FormControl<number | null>(
    this.dados.existente?.precoUnitario ?? this.precoSugerido,
  );
  protected readonly pagouVasilhame = new FormControl(
    this.dados.precoVasilhame !== null && (this.dados.existente?.pagouVasilhame ?? false),
    { nonNullable: true },
  );
  protected readonly comDesconto = new FormControl(
    this.dados.existente?.desconto !== null && this.dados.existente !== null,
    {
      nonNullable: true,
    },
  );
  protected readonly tipoDesconto = signal<TipoDesconto>(
    this.dados.existente?.desconto?.tipo ?? 'VALOR',
  );
  protected readonly descontoValor = new FormControl<number | null>(
    this.dados.existente?.desconto?.tipo === 'VALOR' ? this.dados.existente.desconto.valor : null,
  );
  protected readonly descontoPercentual = new FormControl(
    this.dados.existente?.desconto?.tipo === 'PERCENTUAL'
      ? String(this.dados.existente.desconto.valor)
      : '',
    { nonNullable: true },
  );
  protected readonly motivo = new FormControl(this.dados.existente?.desconto?.motivo ?? '', {
    nonNullable: true,
  });

  protected readonly erro = signal<string | null>(null);

  // sinais-espelho dos controls para os totais ao vivo
  private readonly quantidadeSig = signal(this.quantidade.value);
  private readonly precoSig = signal(this.preco.value);
  private readonly pagouVasilhameSig = signal(this.pagouVasilhame.value);
  private readonly comDescontoSig = signal(this.comDesconto.value);
  private readonly descontoValorSig = signal(this.descontoValor.value);
  private readonly descontoPercentualSig = signal(this.descontoPercentual.value);

  protected readonly comDescontoAtivo = computed(() => this.comDescontoSig());

  protected readonly bruto = computed(() => {
    const vasilhame = this.pagouVasilhameSig() ? (this.dados.precoVasilhame ?? 0) : 0;
    return this.quantidadeSig() * ((this.precoSig() ?? 0) + vasilhame);
  });

  protected readonly descontoCalculado = computed(() => {
    const item = this.montarItem();
    return item === null ? 0 : valorDescontoDe(item);
  });

  protected readonly totalCalculado = computed(() => {
    const item = this.montarItem();
    return item === null ? this.bruto() : totalItemDe(item);
  });

  constructor() {
    this.quantidade.valueChanges.subscribe((v) => this.quantidadeSig.set(v));
    this.preco.valueChanges.subscribe((v) => this.precoSig.set(v));
    this.pagouVasilhame.valueChanges.subscribe((v) => this.pagouVasilhameSig.set(v));
    this.comDesconto.valueChanges.subscribe((v) => this.comDescontoSig.set(v));
    this.descontoValor.valueChanges.subscribe((v) => this.descontoValorSig.set(v));
    this.descontoPercentual.valueChanges.subscribe((v) => this.descontoPercentualSig.set(v));
  }

  protected confirmar(): void {
    this.erro.set(null);

    if (this.preco.value === null) {
      this.erro.set('Informe o preço unitário.');
      return;
    }

    if (this.comDesconto.value) {
      const valor = this.valorDescontoInformado();
      if (valor === null || valor <= 0) {
        this.erro.set('Informe o valor do desconto.');
        return;
      }
      if (this.tipoDesconto() === 'PERCENTUAL' && valor > 100) {
        this.erro.set('Desconto percentual não pode exceder 100%.');
        return;
      }
      // Espelho client-side de DESCONTO_SEM_MOTIVO (Regra 8.4)
      if (this.motivo.value.trim() === '') {
        this.erro.set('Informe o motivo do desconto.');
        return;
      }
      const item = this.montarItem();
      if (item !== null && valorDescontoDe(item) >= brutoDe(item)) {
        this.erro.set('O desconto não pode zerar ou exceder o valor do item.');
        return;
      }
    }

    const item = this.montarItem();
    if (item !== null) {
      this.ref.close(item);
    }
  }

  protected remover(): void {
    this.ref.close('remover');
  }

  private valorDescontoInformado(): number | null {
    if (this.tipoDesconto() === 'VALOR') {
      return this.descontoValorSig();
    }
    const texto = this.descontoPercentualSig().replace(',', '.').trim();
    const numero = Number.parseFloat(texto);
    return Number.isFinite(numero) ? numero : null;
  }

  private montarItem(): ItemCarrinho | null {
    const preco = this.precoSig();
    if (preco === null) {
      return null;
    }
    const valorDesconto = this.comDescontoSig() ? this.valorDescontoInformado() : null;
    return {
      produto: this.dados.produto,
      marca: this.dados.marca,
      quantidade: this.quantidadeSig(),
      precoUnitario: preco,
      pagouVasilhame: this.pagouVasilhameSig(),
      precoVasilhame: this.dados.precoVasilhame ?? 0,
      desconto:
        valorDesconto === null || valorDesconto <= 0
          ? null
          : {
              tipo: this.tipoDesconto(),
              valor: valorDesconto,
              motivo: this.motivo.value.trim(),
            },
    };
  }
}
