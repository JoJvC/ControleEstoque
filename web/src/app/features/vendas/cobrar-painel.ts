import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  Signal,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import { rotuloDaMarca } from '../../core/api/produto-leitura';
import { Button } from '../../ui/atoms/button';
import { Checkbox } from '../../ui/atoms/checkbox';
import { Icon } from '../../ui/atoms/icon';
import { FormField } from '../../ui/molecules/form-field';
import { MoneyInput } from '../../ui/molecules/money-input';
import { QuantityStepper } from '../../ui/molecules/quantity-stepper';
import { PagamentoEdicao } from '../../ui/organisms/pagamento-lista';
import { SheetShell } from '../../ui/organisms/sheet-shell';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import {
  ItemCarrinho,
  TotaisCarrinho,
  VasilhameCarrinho,
  situacaoPagamento,
  rotuloCascoNaRua,
  totalItemDe,
  valorDescontoDe,
  valorDoAtalho,
} from './carrinho';
import { TipoCascoDoCarrinho } from './cascos-por-tipo';
import { FORMA_CREDITO, formasDaVenda, limitarCredito } from './pagamento-credito';
import { rotuloForma } from './venda-rotulos';
import { FormaPagamento, ModoCreditoVasilhame } from '../../core/api/models/vendas';

/** Um tipo de casco do carrinho, com o que já foi lançado e o feedback de casco na rua. */
export interface CascoTipoEstado extends TipoCascoDoCarrinho {
  /** Valor efetivo: com 'na hora' é o vendido em troca; senão o digitado. */
  readonly devolvidos: number;
  readonly travado: boolean;
  readonly sucata: number;
  /** Desconto por unidade da sucata, em reais. */
  readonly valorSucata: number;
  readonly naRua: number;
  readonly aMais: number;
}

/** Uma linha do quadro 'Vasilhames comprados agora'. */
export interface VasilhameEstado extends VasilhameCarrinho {
  readonly nome: string;
  /** Vasilhames cobertos pelo crédito de galão e total cobrado da linha. */
  readonly abatida: number;
  readonly total: number;
  /** Só tipos com crédito (ou já em Comprar) mostram a escolha Abater/Comprar. */
  readonly escolhaModo: boolean;
}

/** Tudo o que o painel mostra; a página é dona do estado (rascunho, regras e API). */
export interface CobrarEstado {
  readonly itens: readonly ItemCarrinho[];
  /** Bruto com os vasilhames cobrados; desconto com o da sucata. */
  readonly totais: TotaisCarrinho;
  readonly vasilhames: readonly VasilhameEstado[];
  readonly totalVasilhames: number;
  readonly descontoSucata: number;
  /** O desconto da sucata passa do total da venda: o servidor recusaria. */
  readonly sucataExcede: boolean;
  /** Só os tipos de casco das linhas retornáveis do carrinho. */
  readonly cascos: readonly CascoTipoEstado[];
  readonly cascosNaHora: boolean;
  /** Primeiro nome do cliente; null quando o número de casco só conta o que vai nesta venda. */
  readonly clienteNome: string | null;
  readonly pagamentos: readonly PagamentoEdicao[];
  /** Crédito do cliente da venda; null sem cliente ou sem saldos carregados. */
  readonly creditoDisponivel: number | null;
  /** Nome do cliente da venda: a sobra do pagamento vira crédito dele. */
  readonly nomeDoCliente: string;
  readonly erro: string | null;
  readonly enviando: boolean;
  readonly podeRegistrar: boolean;
  readonly rotuloConfirmar: string;
}

export type CobrarAcao =
  | { readonly tipo: 'cascos'; readonly tipoCascoId: string; readonly valor: number }
  | { readonly tipo: 'naHora'; readonly valor: boolean }
  | { readonly tipo: 'sucata'; readonly tipoCascoId: string; readonly valor: number }
  | { readonly tipo: 'sucataValor'; readonly tipoCascoId: string; readonly valor: number }
  | {
      readonly tipo: 'vasilhame';
      readonly tipoCascoId: string;
      readonly mudanca: Partial<Pick<VasilhameCarrinho, 'quantidade' | 'precoUnitario' | 'modo'>>;
    }
  | { readonly tipo: 'pagamentos'; readonly valor: readonly PagamentoEdicao[] }
  | { readonly tipo: 'atalho'; readonly indice: number; readonly qual: 'tudo' | 'metade' }
  | { readonly tipo: 'tudoFiado' }
  | { readonly tipo: 'registrar' };

/** Cascos, sucata e pagamento da venda: sheet no celular, painel à direita no desktop. */
@Component({
  selector: 'ce-cobrar-painel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Button, Checkbox, FormField, Icon, MoneyInput, PrecoPipe, QuantityStepper],
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

        @if (e.vasilhames.length > 0) {
          <section class="vasilhame" aria-label="Vasilhames">
            <h3 class="titulo">
              <ce-icon nome="casco" [tamanho]="20" /> Vasilhames comprados agora
            </h3>
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
          @if (temSucata(e)) {
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

        <h3 class="titulo">Pagamento</h3>
        <div class="formas" role="group" aria-label="Formas de pagamento">
          @for (forma of formas(); track forma.value) {
            <button
              type="button"
              class="forma"
              [class.forma--ativa]="selecionada(forma.value)"
              [attr.aria-pressed]="selecionada(forma.value)"
              (click)="alternarForma(forma.value)"
            >
              {{ forma.label }}
            </button>
          }
        </div>
        @for (pagamento of e.pagamentos; track pagamento.forma; let indice = $index) {
          <div class="forma-linha">
            <span class="forma-linha__rotulo">{{ rotuloDe(pagamento.forma) }}</span>
            <ce-money-input
              class="forma-linha__campo"
              [rotulo]="'Valor em ' + rotuloDe(pagamento.forma)"
              [ngModel]="pagamento.valor"
              [maximo]="pagamento.forma === formaCredito ? (e.creditoDisponivel ?? 0) : null"
              (ngModelChange)="mudarValor(indice, $event)"
            />
          </div>
        }
        <ce-button variante="ghost" [disabled]="!temOutraForma()" (click)="outraForma()">
          <ce-icon nome="mais" [tamanho]="18" /> Outra forma
        </ce-button>
        <div class="atalhos">
          <button type="button" class="atalho" (click)="atalhoDe('tudo')">Tudo</button>
          <button type="button" class="atalho" (click)="atalhoDe('metade')">Metade</button>
          <button
            type="button"
            class="atalho atalho--fiado"
            (click)="acao.emit({ tipo: 'tudoFiado' })"
          >
            Tudo fiado
          </button>
        </div>
        @let situacao = situacaoPagamento(e.totais.liquido, e.pagamentos);
        @if (situacao.tipo === 'fiado') {
          <p class="resumo resumo--fiado" role="status">
            Vai para fiado: {{ situacao.valor | cePreco }}
          </p>
        } @else if (situacao.tipo === 'credito') {
          <p class="resumo resumo--pago" role="status">
            Sobra de {{ situacao.valor | cePreco }} vira crédito de {{ e.nomeDoCliente }}
          </p>
        } @else if (e.totais.liquido > 0) {
          <p class="resumo resumo--pago" role="status">Pago por completo</p>
        }
        @if (e.erro; as mensagem) {
          <p class="erro" role="alert">{{ mensagem }}</p>
        }
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

    .sucata__aviso {
      display: flex;
      align-items: center;
      gap: var(--ce-space-2);
      font-size: var(--ce-font-sm);
      font-weight: 600;
    }

    .formas,
    .atalhos {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ce-space-2);
    }

    .forma,
    .atalho {
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

    .atalho--fiado {
      border-color: var(--ce-fiado);
      background: var(--ce-fiado-soft);
      color: var(--ce-fiado);
    }

    .forma-linha {
      display: flex;
      align-items: center;
      gap: var(--ce-space-2);
    }

    .forma-linha__rotulo {
      min-width: 76px;
      font-weight: 600;
    }

    .forma-linha__campo {
      flex: 1;
      min-width: 0;
    }

    .resumo {
      padding: var(--ce-space-3);
      border-radius: 20px;
      font-weight: 700;
    }

    .resumo--fiado {
      background: var(--ce-fiado-soft);
      color: var(--ce-fiado);
    }

    .resumo--pago {
      background: var(--ce-pago-soft);
      color: var(--ce-pago);
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
export class CobrarPainel {
  readonly estado = input.required<CobrarEstado>();
  readonly acao = output<CobrarAcao>();

  protected readonly formas = computed(() => formasDaVenda(this.estado().creditoDisponivel));
  protected readonly formaCredito = FORMA_CREDITO;
  protected readonly situacaoPagamento = situacaoPagamento;
  protected readonly rotuloCascoNaRua = rotuloCascoNaRua;
  protected readonly rotuloMarca = rotuloDaMarca;
  protected readonly descontoDe = valorDescontoDe;
  protected readonly totalDe = totalItemDe;

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

  protected temSucata(e: CobrarEstado): boolean {
    return e.cascos.some((c) => c.aceitaSucata);
  }

  protected rotuloDe(forma: string): string {
    return rotuloForma(forma as FormaPagamento);
  }

  protected selecionada(forma: string): boolean {
    return this.estado().pagamentos.some((p) => p.forma === forma);
  }

  /** Pílula liga/desliga a forma; ligada, já vem com o que falta pagar (protótipo). */
  protected alternarForma(forma: string): void {
    const { pagamentos, totais } = this.estado();
    if (this.selecionada(forma)) {
      this.acao.emit({ tipo: 'pagamentos', valor: pagamentos.filter((p) => p.forma !== forma) });
      return;
    }
    // Forma padrão ainda sem valor: a escolha troca de forma, não divide o pagamento.
    const base = pagamentos.length === 1 && pagamentos[0].valor === null ? [] : pagamentos;
    const restante = valorDoAtalho('tudo', totais.liquido, base);
    this.acao.emit({
      tipo: 'pagamentos',
      valor: [...base, { forma, valor: restante > 0 ? restante : null }],
    });
  }

  protected temOutraForma(): boolean {
    return this.estado().pagamentos.length < this.formas().length;
  }

  /** Divide o pagamento: acrescenta a primeira forma livre já com o que falta pagar. */
  protected outraForma(): void {
    const { pagamentos, totais } = this.estado();
    const livre = this.formas().find((f) => !pagamentos.some((p) => p.forma === f.value));
    if (!livre) {
      return;
    }
    const restante = valorDoAtalho('tudo', totais.liquido, pagamentos);
    this.acao.emit({
      tipo: 'pagamentos',
      valor: [...pagamentos, { forma: livre.value, valor: restante > 0 ? restante : null }],
    });
  }

  protected mudarValor(indice: number, valor: number | null): void {
    const { pagamentos, creditoDisponivel, totais } = this.estado();
    this.acao.emit({
      tipo: 'pagamentos',
      valor: pagamentos.map((p, i) => {
        if (i !== indice) {
          return p;
        }
        if (p.forma !== FORMA_CREDITO || valor === null) {
          return { ...p, valor };
        }
        return {
          ...p,
          valor: limitarCredito(valor, Math.min(creditoDisponivel ?? 0, totais.liquido), 0),
        };
      }),
    });
  }

  protected atalhoDe(qual: 'tudo' | 'metade'): void {
    this.acao.emit({ tipo: 'atalho', indice: 0, qual });
  }
}

export interface CobrarSheetDados {
  readonly estado: Signal<CobrarEstado>;
  readonly agir: (acao: CobrarAcao) => void;
}

/** O painel dentro do sheet do celular: o estado segue vivo na página, o sheet só o espelha. */
@Component({
  selector: 'ce-cobrar-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetShell, CobrarPainel],
  template: `
    <ce-sheet-shell titulo="Fechar venda" (fechar)="ref.close()">
      <ce-cobrar-painel [estado]="dados.estado()" (acao)="dados.agir($event)" />
    </ce-sheet-shell>
  `,
})
export class CobrarSheet {
  protected readonly ref = inject(DialogRef<void>);
  protected readonly dados = inject<CobrarSheetDados>(DIALOG_DATA);
}
