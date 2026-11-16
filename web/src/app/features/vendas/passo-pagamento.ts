import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { FormaPagamento } from '../../core/api/models/vendas';
import { Button } from '../../ui/atoms/button';
import { Icon } from '../../ui/atoms/icon';
import { MoneyInput } from '../../ui/molecules/money-input';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { situacaoPagamento, valorDoAtalho } from './carrinho';
import { CobrarAcao, CobrarEstado } from './cobrar-estado';
import { FORMA_CREDITO, formasDaVenda, limitarCredito } from './pagamento-credito';
import { rotuloForma } from './venda-rotulos';

/**
 * Formas de pagamento, Tudo/Metade/Tudo fiado, crédito do cliente e a mensagem de fiado/sobra.
 * Sem estado próprio e sem botão de confirmar: quem usa põe o seu (painel do desktop, moldura do celular).
 */
@Component({
  selector: 'ce-passo-pagamento',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Button, Icon, MoneyInput, PrecoPipe],
  template: `
    @let e = estado();
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
      <button type="button" class="atalho atalho--fiado" (click)="acao.emit({ tipo: 'tudoFiado' })">
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

    .erro {
      color: var(--ce-danger);
      font-size: var(--ce-font-sm);
    }
  `,
})
export class PassoPagamento {
  readonly estado = input.required<CobrarEstado>();
  readonly acao = output<CobrarAcao>();

  protected readonly formas = computed(() => formasDaVenda(this.estado().creditoDisponivel));
  protected readonly formaCredito = FORMA_CREDITO;
  protected readonly situacaoPagamento = situacaoPagamento;

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
