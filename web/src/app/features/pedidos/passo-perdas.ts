import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ProdutoResponse, TipoCascoResponse } from '../../core/api/models/estoque';
import { FuncionarioPedidoResponse } from '../../core/api/models/pedidos';
import { rotuloDaMarca } from '../../core/api/produto-leitura';
import { Button } from '../../ui/atoms/button';
import { Icon } from '../../ui/atoms/icon';
import { Select, SelectOpcao } from '../../ui/atoms/select';
import { FormField } from '../../ui/molecules/form-field';
import { QuantityStepper } from '../../ui/molecules/quantity-stepper';
import { MENSAGEM_SEM_RESPONSAVEL, Ocorrencia, ocorrenciaNova } from './perdas-form';

const GALOES: readonly SelectOpcao[] = [
  { value: 'CHEIO', label: 'Cheio' },
  { value: 'VAZIO', label: 'Vazio' },
];
const MOTIVOS: readonly SelectOpcao[] = [
  { value: 'PERDIDO', label: 'Perdido' },
  { value: 'QUEBRADO', label: 'Quebrado' },
];

/**
 * Perdas e quebras de galão do pedido: usado no passo da conclusão e na folha do detalhe.
 * A lista é do dono (`[(ocorrencias)]`); os responsáveis são só leitura.
 */
@Component({
  selector: 'ce-passo-perdas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Button, FormField, Icon, QuantityStepper, Select],
  template: `
    <section class="perdas" aria-label="Perdas e quebras">
      @if (funcionarios().length > 0) {
        <p class="dica" data-testid="perdas-responsaveis">
          Responsáveis: {{ nomesDosResponsaveis() }}
        </p>
      } @else {
        <p class="aviso" role="alert" data-testid="perdas-sem-responsavel">
          {{ semResponsavel }}
        </p>
      }

      @for (o of ocorrencias(); track $index; let i = $index) {
        <div class="ocorrencia" data-testid="ocorrencia">
          <div class="ocorrencia__topo">
            <strong>Ocorrência {{ i + 1 }}</strong>
            <button
              type="button"
              class="ocorrencia__remover"
              [attr.aria-label]="'Remover ocorrência ' + (i + 1)"
              (click)="remover(i)"
            >
              <ce-icon nome="lixeira" [tamanho]="20" />
            </button>
          </div>
          <ce-form-field rotulo="Galão">
            <ce-select
              [rotulo]="'Galão da ocorrência ' + (i + 1)"
              [opcoes]="galoes"
              [ngModel]="o.galao"
              (ngModelChange)="mudar(i, { galao: $event })"
            />
          </ce-form-field>
          @if (o.galao === 'CHEIO') {
            <ce-form-field rotulo="Produto e marca">
              <ce-select
                [rotulo]="'Produto da ocorrência ' + (i + 1)"
                placeholder="Escolha o produto"
                [opcoes]="opcoesProduto()"
                [ngModel]="chave(o)"
                (ngModelChange)="escolherProduto(i, $event)"
              />
            </ce-form-field>
          } @else {
            <ce-form-field rotulo="Tipo de casco">
              <ce-select
                [rotulo]="'Tipo de casco da ocorrência ' + (i + 1)"
                placeholder="Escolha o tipo"
                [opcoes]="opcoesTipo()"
                [ngModel]="o.tipoCascoId"
                (ngModelChange)="mudar(i, { tipoCascoId: $event })"
              />
            </ce-form-field>
          }
          <div class="ocorrencia__linha">
            <ce-form-field rotulo="Quantidade">
              <ce-quantity-stepper
                [rotulo]="'Quantidade da ocorrência ' + (i + 1)"
                [item]="'ocorrência ' + (i + 1)"
                [min]="1"
                [ngModel]="o.quantidade"
                (ngModelChange)="mudar(i, { quantidade: $event })"
              />
            </ce-form-field>
            <ce-form-field rotulo="Motivo">
              <ce-select
                [rotulo]="'Motivo da ocorrência ' + (i + 1)"
                [opcoes]="motivos"
                [ngModel]="o.motivo"
                (ngModelChange)="mudar(i, { motivo: $event })"
              />
            </ce-form-field>
          </div>
        </div>
      }

      <ce-button
        variante="claro"
        data-testid="perdas-adicionar"
        [block]="true"
        [disabled]="funcionarios().length === 0"
        (click)="adicionar()"
      >
        Adicionar ocorrência
      </ce-button>
    </section>
  `,
  styles: `
    @use 'mixins';

    :host {
      display: block;
    }

    .perdas {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .dica {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    .aviso {
      font-size: var(--ce-font-sm);
      color: var(--ce-danger);
    }

    .ocorrencia {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
      padding: var(--ce-space-3);
      background: var(--ce-surface);
      border: 1px solid var(--ce-border);
      border-radius: 20px;
    }

    .ocorrencia__topo {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .ocorrencia__linha {
      display: flex;
      gap: var(--ce-space-3);
      align-items: flex-end;
    }

    .ocorrencia__remover {
      @include mixins.touch-target;

      display: grid;
      place-items: center;
      background: none;
      border: 0;
      color: var(--ce-danger);
    }
  `,
})
export class PassoPerdas {
  readonly ocorrencias = model.required<readonly Ocorrencia[]>();
  readonly funcionarios = input.required<readonly FuncionarioPedidoResponse[]>();
  readonly produtos = input.required<readonly ProdutoResponse[]>();
  readonly tiposCasco = input.required<readonly TipoCascoResponse[]>();

  protected readonly galoes = GALOES;
  protected readonly motivos = MOTIVOS;
  protected readonly semResponsavel = MENSAGEM_SEM_RESPONSAVEL;

  protected readonly nomesDosResponsaveis = computed(() =>
    this.funcionarios()
      .map((f) => f.nome)
      .join(', '),
  );
  // Só marcas com tipo de casco resolvido: o servidor recusa a perda de galão cheio sem ele.
  protected readonly opcoesProduto = computed<SelectOpcao[]>(() =>
    this.produtos().flatMap((p) =>
      p.marcas
        .filter((m) => m.tipoCascoResolvidoId)
        .map((m) => ({
          value: `${p.id}|${m.marcaId}`,
          label: `${p.nome} — ${rotuloDaMarca(m.marcaNome)}`,
        })),
    ),
  );
  protected readonly opcoesTipo = computed<SelectOpcao[]>(() =>
    this.tiposCasco().map((t) => ({ value: t.id, label: t.nome })),
  );

  protected chave(o: Ocorrencia): string | null {
    return o.produtoId && o.marcaId ? `${o.produtoId}|${o.marcaId}` : null;
  }

  protected adicionar(): void {
    this.ocorrencias.update((lista) => [...lista, ocorrenciaNova()]);
  }

  protected remover(indice: number): void {
    this.ocorrencias.update((lista) => lista.filter((_, i) => i !== indice));
  }

  protected escolherProduto(indice: number, chave: string | null): void {
    const [produtoId, marcaId] = chave?.split('|') ?? [null, null];
    this.mudar(indice, { produtoId, marcaId });
  }

  protected mudar(indice: number, mudanca: Partial<Ocorrencia>): void {
    this.ocorrencias.update((lista) =>
      lista.map((o, i) => (i === indice ? { ...o, ...mudanca } : o)),
    );
  }
}
