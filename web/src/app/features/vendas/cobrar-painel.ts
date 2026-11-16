import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { rotuloDaMarca } from '../../core/api/produto-leitura';
import { Button } from '../../ui/atoms/button';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { totalItemDe, valorDescontoDe } from './carrinho';
import { CobrarAcao, CobrarEstado } from './cobrar-estado';
import { PassoCascos } from './passo-cascos';
import { PassoPagamento } from './passo-pagamento';

export type { CascoTipoEstado, CobrarAcao, CobrarEstado, VasilhameEstado } from './cobrar-estado';

/** Resumo, cascos, sucata e pagamento da venda: painel à direita no desktop. */
@Component({
  selector: 'ce-cobrar-painel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, PassoCascos, PassoPagamento, PrecoPipe],
  template: `
    @let e = estado();
    <div class="painel">
      <div class="corpo" data-rolagem>
        <div class="linhas">
          @for (item of e.itens; track $index) {
            <div class="linha">
              <span>
                {{ item.quantidade }}× {{ item.produto.nome }} —
                {{ rotuloMarca(item.marca.marcaNome) }}
                @if (item.desconto) {
                  <span class="desconto">
                    desc. {{ descontoDe(item) | cePreco }}
                    @if (item.desconto.motivo) {
                      · {{ item.desconto.motivo }}
                    }
                  </span>
                }
              </span>
              <span class="valor">{{ totalDe(item) | cePreco }}</span>
            </div>
          }
        </div>

        <dl class="totais">
          <div class="totais__linha">
            <dt>Bruto</dt>
            <dd>{{ e.totais.bruto | cePreco }}</dd>
          </div>
          @if (e.totais.desconto - e.descontoSucata > 0) {
            <div class="totais__linha">
              <dt>Desconto (por item)</dt>
              <dd>− {{ e.totais.desconto - e.descontoSucata | cePreco }}</dd>
            </div>
          }
          @if (e.descontoSucata > 0) {
            <div class="totais__linha">
              <dt>Desconto da sucata</dt>
              <dd>− {{ e.descontoSucata | cePreco }}</dd>
            </div>
          }
          <div class="totais__linha totais__linha--total">
            <dt>Total</dt>
            <dd>{{ e.totais.liquido | cePreco }}</dd>
          </div>
        </dl>

        <ce-passo-cascos [estado]="e" (acao)="acao.emit($event)" />
        <ce-passo-pagamento [estado]="e" (acao)="acao.emit($event)" />
      </div>
      <div class="rodape">
        <ce-button
          data-testid="confirmar-venda"
          [block]="true"
          [loading]="e.enviando"
          [disabled]="!e.podeRegistrar"
          (click)="acao.emit({ tipo: 'registrar' })"
        >
          {{ e.rotuloConfirmar }} · {{ e.totais.liquido | cePreco }}
        </ce-button>
      </div>
    </div>
  `,
  styles: `
    @use 'mixins';

    // Em coluna com altura limitada (desktop) só o .corpo rola; o .rodape com o botão fica sempre à vista.
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .painel {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
      min-height: 0;
    }

    .corpo {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
      min-height: 0;
      overflow-y: auto;
    }

    .rodape {
      flex: none;
    }

    .linhas {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-1);
      padding: var(--ce-space-3);
      border: 1px solid var(--ce-border);
      border-radius: 20px;
      background: var(--ce-surface-muted);
    }

    .linha {
      display: flex;
      justify-content: space-between;
      gap: var(--ce-space-2);
    }

    .valor,
    .totais__linha dd {
      @include mixins.tabular-numbers;

      font-weight: 700;
    }

    .desconto {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    .totais {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-1);
    }

    .totais__linha {
      display: flex;
      justify-content: space-between;
    }

    .totais__linha--total {
      padding-top: var(--ce-space-1);
      border-top: 1px solid var(--ce-border);
      font-size: var(--ce-font-lg);
    }
  `,
})
export class CobrarPainel {
  readonly estado = input.required<CobrarEstado>();
  readonly acao = output<CobrarAcao>();

  protected readonly rotuloMarca = rotuloDaMarca;
  protected readonly descontoDe = valorDescontoDe;
  protected readonly totalDe = totalItemDe;
}
