import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Checkbox } from '../../ui/atoms/checkbox';
import { Icon } from '../../ui/atoms/icon';
import { FormField } from '../../ui/molecules/form-field';
import { MoneyInput } from '../../ui/molecules/money-input';
import { QuantityStepper } from '../../ui/molecules/quantity-stepper';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { ModoCreditoVasilhame } from '../../core/api/models/vendas';
import { VasilhameCarrinho, rotuloCascoNaRua } from './carrinho';
import { CobrarAcao, CobrarEstado } from './cobrar-estado';

/**
 * Cascos devolvidos, sucata entregue e vasilhames comprados, por tipo de casco.
 * Sem estado próprio: lê o `estado` da página e devolve `acao` (o desktop e o passo do celular usam este).
 */
@Component({
  selector: 'ce-passo-cascos',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Checkbox, FormField, Icon, MoneyInput, PrecoPipe, QuantityStepper],
  template: `
    @let e = estado();
    @if (e.cascos.length > 0) {
      <section class="casco" aria-label="Cascos">
        <h3 class="titulo">
          <ce-icon nome="casco-na-rua" [tamanho]="20" /> Cascos devolvidos agora
        </h3>
        <ce-checkbox
          [ngModel]="e.cascosNaHora"
          (ngModelChange)="acao.emit({ tipo: 'naHora', valor: $event })"
        >
          Devolveu todos na hora
        </ce-checkbox>
        @for (c of e.cascos; track c.tipoCascoId) {
          <ce-form-field [rotulo]="'Cascos devolvidos — ' + c.nome">
            <ce-quantity-stepper
              [rotulo]="'Cascos devolvidos de ' + c.nome"
              [ngModel]="c.devolvidos"
              [disabled]="c.travado"
              (ngModelChange)="
                acao.emit({ tipo: 'cascos', tipoCascoId: c.tipoCascoId, valor: $event })
              "
            />
          </ce-form-field>
          <p class="casco__rua" role="status">
            {{ c.nome }}: {{ rotuloCascoNaRua(c.naRua, c.aMais, e.clienteNome) }}
          </p>
        }
      </section>
      @if (temSucata()) {
        <section class="sucata" aria-label="Sucata">
          <h3 class="titulo"><ce-icon nome="sucata" [tamanho]="20" /> Sucata entregue agora</h3>
          @for (c of e.cascos; track c.tipoCascoId) {
            @if (c.aceitaSucata) {
              <ce-form-field
                [rotulo]="'Sucata entregue — ' + c.nome"
                dica="Contagem própria, em separado dos cascos. Desconto por unidade em R$."
              >
                <ce-quantity-stepper
                  [rotulo]="'Sucata entregue de ' + c.nome"
                  [ngModel]="c.sucata"
                  (ngModelChange)="
                    acao.emit({ tipo: 'sucata', tipoCascoId: c.tipoCascoId, valor: $event })
                  "
                />
                <ce-money-input
                  [rotulo]="'Desconto por unidade de sucata de ' + c.nome"
                  [ngModel]="c.valorSucata"
                  (ngModelChange)="
                    acao.emit({
                      tipo: 'sucataValor',
                      tipoCascoId: c.tipoCascoId,
                      valor: $event ?? 0,
                    })
                  "
                />
              </ce-form-field>
            }
          }
          <p class="sucata__total">Desconto da sucata: {{ e.descontoSucata | cePreco }}</p>
          @if (e.sucataExcede) {
            <p class="erro" role="alert">
              O desconto da sucata passa do total da venda. Reduza o valor ou a quantidade.
            </p>
          }
          <p class="sucata__aviso">
            <ce-icon nome="info" [tamanho]="18" /> Sucata não abate o débito de casco.
          </p>
        </section>
      }
    }

    @if (e.vasilhames.length > 0) {
      <section class="vasilhame" aria-label="Vasilhames">
        <h3 class="titulo"><ce-icon nome="casco" [tamanho]="20" /> Vasilhames comprados agora</h3>
        @for (v of e.vasilhames; track v.tipoCascoId) {
          <ce-form-field [rotulo]="'Vasilhame ' + v.nome">
            <ce-quantity-stepper
              [rotulo]="'Quantidade de Vasilhame ' + v.nome"
              [item]="'Vasilhame ' + v.nome"
              [ngModel]="v.quantidade"
              (ngModelChange)="mudarVasilhame(v.tipoCascoId, { quantidade: $event })"
            />
            <ce-money-input
              [rotulo]="'Valor unitário de Vasilhame ' + v.nome"
              [ngModel]="v.precoUnitario"
              [disabled]="v.quantidade === 0"
              (ngModelChange)="mudarVasilhame(v.tipoCascoId, { precoUnitario: $event ?? 0 })"
            />
          </ce-form-field>
          @if (v.escolhaModo) {
            <div class="modos" role="group" [attr.aria-label]="'Crédito de ' + v.nome">
              @for (m of modos; track m.valor) {
                <button
                  type="button"
                  class="forma"
                  [class.forma--ativa]="v.modo === m.valor"
                  [attr.aria-pressed]="v.modo === m.valor"
                  [disabled]="v.quantidade === 0"
                  (click)="mudarVasilhame(v.tipoCascoId, { modo: m.valor })"
                >
                  {{ m.rotulo }}
                </button>
              }
            </div>
          }
          <p class="vasilhame__total">
            {{ v.nome }}: {{ v.total | cePreco }}
            @if (v.abatida > 0) {
              <span class="dica">· {{ v.abatida }} abatido(s) do crédito</span>
            }
          </p>
        }
        <p class="vasilhame__total">Total dos vasilhames: {{ e.totalVasilhames | cePreco }}</p>
      </section>
    }
  `,
  styles: `
    @use 'mixins';

    :host {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
    }

    .titulo {
      display: flex;
      align-items: center;
      gap: var(--ce-space-2);
      font-size: var(--ce-font-md);
    }

    .casco,
    .sucata,
    .vasilhame {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
      padding: var(--ce-space-3);
      border-radius: 20px;
    }

    .casco {
      border: 2px dashed var(--ce-casco);
      background: var(--ce-casco-soft);

      .titulo,
      .casco__rua {
        color: var(--ce-casco);
      }
    }

    .casco__rua {
      font-weight: 600;
    }

    .sucata {
      border: 1px solid var(--ce-sucata);
      background: var(--ce-sucata-soft);

      .titulo {
        color: var(--ce-sucata);
      }
    }

    .vasilhame {
      border: 1px solid var(--ce-border);
      background: var(--ce-surface-muted);
    }

    .vasilhame__total,
    .sucata__total {
      font-weight: 700;
    }

    .modos {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ce-space-2);
    }

    .forma {
      @include mixins.touch-target;

      padding-inline: var(--ce-space-3);
      border: 1px solid var(--ce-borda-campo);
      border-radius: var(--ce-radius-controle);
      background: var(--ce-surface);
      font-weight: 600;
    }

    .forma--ativa {
      border-color: var(--ce-primary);
      background: var(--ce-primary-soft);
      color: var(--ce-primary-strong);
    }

    .sucata__aviso {
      display: flex;
      align-items: center;
      gap: var(--ce-space-2);
      font-size: var(--ce-font-sm);
      font-weight: 600;
    }

    .dica {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class PassoCascos {
  readonly estado = input.required<CobrarEstado>();
  readonly acao = output<CobrarAcao>();

  protected readonly rotuloCascoNaRua = rotuloCascoNaRua;
  protected readonly modos: readonly { valor: ModoCreditoVasilhame; rotulo: string }[] = [
    { valor: 'ABATER_CREDITO', rotulo: 'Abater do crédito' },
    { valor: 'COMPRAR', rotulo: 'Comprar' },
  ];

  protected mudarVasilhame(
    tipoCascoId: string,
    mudanca: Partial<Pick<VasilhameCarrinho, 'quantidade' | 'precoUnitario' | 'modo'>>,
  ): void {
    this.acao.emit({ tipo: 'vasilhame', tipoCascoId, mudanca });
  }

  protected temSucata(): boolean {
    return this.estado().cascos.some((c) => c.aceitaSucata);
  }
}
