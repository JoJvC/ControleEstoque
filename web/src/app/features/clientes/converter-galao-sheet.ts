import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { CascoClientePorTipo } from '../../core/api/models/clientes';
import { TipoCascoResponse } from '../../core/api/models/estoque';
import { VendaResponse } from '../../core/api/models/vendas';
import { ApiError } from '../../core/http/api-error';
import { OperatorStore } from '../../core/operator/operator-store';
import { Button } from '../../ui/atoms/button';
import { Select } from '../../ui/atoms/select';
import { FormField } from '../../ui/molecules/form-field';
import { MoneyInput } from '../../ui/molecules/money-input';
import { QuantityStepper } from '../../ui/molecules/quantity-stepper';
import { SheetShell } from '../../ui/organisms/sheet-shell';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { tiposConversiveis } from './cascos-cliente';
import { ClientesStore } from './clientes-store';

export interface ConverterGalaoSheetDados {
  readonly clienteId: string;
  readonly tipos: readonly TipoCascoResponse[];
  readonly cascosPorTipo: readonly CascoClientePorTipo[];
}

/** Resultado: a venda criada, ou undefined (cancelou). */
export type ConverterGalaoSheetResultado = VendaResponse;

@Component({
  selector: 'ce-converter-galao-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    SheetShell,
    Button,
    Select,
    FormField,
    MoneyInput,
    QuantityStepper,
    PrecoPipe,
  ],
  template: `
    <ce-sheet-shell titulo="Converter galão em débito" (fechar)="ref.close()">
      <form class="form" (submit)="$event.preventDefault(); confirmar()">
        <ce-form-field rotulo="Tipo de casco" [obrigatorio]="true">
          <ce-select [opcoes]="opcoesTipo" [formControl]="tipo" />
        </ce-form-field>
        <ce-form-field rotulo="Quantidade" [obrigatorio]="true">
          <ce-quantity-stepper [formControl]="quantidade" [min]="1" [max]="saldoDoTipo()" />
        </ce-form-field>
        <ce-form-field rotulo="Valor unitário" [obrigatorio]="true">
          <ce-money-input [formControl]="valorUnitario" />
        </ce-form-field>

        <p class="total">
          Total: <strong>{{ total() | cePreco }}</strong> — vira fiado do cliente
        </p>

        @if (!operador()) {
          <p class="aviso" role="status">Escolha o operador para confirmar.</p>
        }
        @if (erro(); as mensagem) {
          <p class="erro" role="alert">{{ mensagem }}</p>
        }

        <ce-button tipo="submit" [block]="true" [disabled]="!valido()" [loading]="enviando()">
          Confirmar
        </ce-button>
      </form>
    </ce-sheet-shell>
  `,
  styles: `
    .form {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .aviso {
      color: var(--ce-text-muted);
      font-size: var(--ce-font-sm);
    }

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class ConverterGalaoSheet {
  protected readonly ref = inject(DialogRef<ConverterGalaoSheetResultado>);
  private readonly dados = inject<ConverterGalaoSheetDados>(DIALOG_DATA);
  private readonly store = inject(ClientesStore);
  protected readonly operador = inject(OperatorStore).operator;

  private readonly conversiveis = tiposConversiveis(this.dados.tipos, this.dados.cascosPorTipo);
  protected readonly opcoesTipo = this.conversiveis.map((t) => ({
    value: t.tipoCascoId,
    label: `${t.nome} (${t.saldo})`,
  }));

  protected readonly tipo = new FormControl<string | null>(
    this.conversiveis.length === 1 ? this.conversiveis[0].tipoCascoId : null,
  );
  protected readonly quantidade = new FormControl(1, { nonNullable: true });
  protected readonly valorUnitario = new FormControl<number | null>(
    this.conversiveis.length === 1 ? this.conversiveis[0].precoVasilhame : null,
  );

  protected readonly erro = signal<string | null>(null);
  protected readonly enviando = signal(false);

  private readonly tipoSig = toSignal(this.tipo.valueChanges, { initialValue: this.tipo.value });
  private readonly quantidadeSig = toSignal(this.quantidade.valueChanges, { initialValue: 1 });
  private readonly valorSig = toSignal(this.valorUnitario.valueChanges, {
    initialValue: this.valorUnitario.value,
  });

  private readonly selecionado = computed(
    () => this.conversiveis.find((t) => t.tipoCascoId === this.tipoSig()) ?? null,
  );
  protected readonly saldoDoTipo = computed(() => this.selecionado()?.saldo ?? null);
  protected readonly total = computed(() => this.quantidadeSig() * (this.valorSig() ?? 0));

  protected readonly valido = computed(() => {
    const selecionado = this.selecionado();
    const valor = this.valorSig();
    const quantidade = this.quantidadeSig();
    return (
      !this.enviando() &&
      this.operador() !== null &&
      selecionado !== null &&
      quantidade >= 1 &&
      quantidade <= selecionado.saldo &&
      valor !== null &&
      valor > 0
    );
  });

  constructor() {
    // Trocar o tipo traz o preço padrão dele e leva a quantidade para dentro do saldo.
    this.tipo.valueChanges.subscribe((id) => {
      const t = this.conversiveis.find((c) => c.tipoCascoId === id);
      if (t) {
        this.valorUnitario.setValue(t.precoVasilhame);
        this.quantidade.setValue(Math.min(this.quantidade.value, t.saldo));
      }
    });
  }

  protected async confirmar(): Promise<void> {
    const operador = this.operador();
    const valor = this.valorUnitario.value;
    const selecionado = this.selecionado();
    if (!this.valido() || !operador || valor === null || !selecionado) {
      return;
    }
    this.enviando.set(true);
    this.erro.set(null);
    try {
      const venda = await this.store.converterGalao(
        this.dados.clienteId,
        operador.id,
        selecionado.tipoCascoId,
        this.quantidade.value,
        valor,
      );
      this.ref.close(venda);
    } catch (e) {
      // 422 CONVERSAO_MAIOR_QUE_SALDO e demais 4xx ficam inline; rede/5xx já viraram toast.
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
}
