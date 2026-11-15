import { ChangeDetectionStrategy, Component, inject, signal, WritableSignal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ClientesApi } from '../../core/api/clientes-api';
import { EstoqueApi } from '../../core/api/estoque-api';
import { FinanceiroApi } from '../../core/api/financeiro-api';
import { VendasApi } from '../../core/api/vendas-api';
import { OperatorStore } from '../../core/operator/operator-store';
import { CePermissao } from '../../core/permissions/ce-permissao';
import { hojeLocal } from '../../core/util/data-local';
import { Button } from '../../ui/atoms/button';
import { Icon } from '../../ui/atoms/icon';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { CaixaStore } from '../financeiro/caixa-store';
import { AcabandoLinha, HojeAcabando, modeloAcabando, rotaRepor } from './hoje-acabando';
import { HojeCartao, rotaClientes } from './hoje-cartao';
import { dataExtenso, HeroModelo, HojeHero, modeloHero, saudacao } from './hoje-hero';
import { HojeStatus } from './hoje-status';
import { HojeUltimas, modeloUltimas, rotaVenda, UltimaVenda } from './hoje-ultimas';

@Component({
  selector: 'ce-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, CePermissao, HojeAcabando, HojeCartao, HojeHero, HojeUltimas, Icon, PrecoPipe],
  template: `
    <section class="home">
      <ce-hoje-hero
        class="home__hero"
        [modelo]="hero()"
        [status]="heroStatus()"
        [data]="data"
        [saudacao]="primeiroNome() + ', ' + saudacao"
      >
        <ce-button
          *cePermissao="'vendas.registrar'"
          class="home__nova"
          [block]="true"
          (click)="ir('/vendas/nova')"
          >Nova venda</ce-button
        >
        <button
          type="button"
          class="home__caixa"
          [attr.aria-label]="'Caixa: ' + rotuloCaixa()"
          (click)="ir('/financeiro/caixa')"
        >
          <ce-icon nome="dinheiro" [tamanho]="20" />
          {{ rotuloCaixa() }}
        </button>
      </ce-hoje-hero>

      <div class="home__tiles">
        <ce-hoje-cartao
          variante="casco"
          [valor]="'' + totalCascos()"
          [status]="cascosStatus()"
          (abrir)="ir(rotaClientes('casco'))"
        />
        <ce-hoje-cartao
          variante="fiado"
          [valor]="totalFiado() === 0 ? 'Em dia' : (totalFiado() | cePreco)"
          [zerado]="totalFiado() === 0"
          [status]="fiadoStatus()"
          (abrir)="ir(rotaClientes('fiado'))"
        />
      </div>

      <ce-hoje-acabando
        class="home__acabando"
        [itens]="alertas()"
        [status]="alertasStatus()"
        (repor)="ir(rotaRepor($event))"
      />

      <ce-hoje-ultimas
        class="home__ultimas"
        [itens]="ultimas()"
        [status]="ultimasStatus()"
        (abrir)="ir(rotaVenda($event))"
        (verTodas)="ir('/vendas')"
        (primeira)="ir('/vendas/nova')"
      />
    </section>
  `,
  styles: `
    .home {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--ce-space-3);
      padding: var(--ce-space-5) var(--ce-space-4);
    }

    .home__tiles {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--ce-space-3);
    }

    .home__nova {
      flex: 1;
      min-width: 0;
      min-height: 44px;
    }

    .home__caixa {
      display: inline-flex;
      align-items: center;
      gap: var(--ce-space-2);
      min-height: 44px;
      padding: 0 var(--ce-space-4);
      border: 0;
      border-radius: var(--ce-radius-controle);
      background: var(--ce-topo-cartao);
      color: var(--ce-texto-sobre-topo);
      font: inherit;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    @media (min-width: 960px) {
      .home {
        grid-template-columns: 1fr 1fr;
      }

      .home__hero {
        grid-column: 1 / -1;
      }

      .home__ultimas {
        grid-column: 1;
        grid-row: 2 / span 2;
      }

      .home__tiles,
      .home__acabando {
        grid-column: 2;
      }
    }
  `,
})
export class HomePage {
  private readonly operatorStore = inject(OperatorStore);

  private readonly router = inject(Router);
  private readonly vendasApi = inject(VendasApi);
  private readonly estoqueApi = inject(EstoqueApi);
  private readonly clientesApi = inject(ClientesApi);
  private readonly financeiroApi = inject(FinanceiroApi);
  protected readonly caixa = inject(CaixaStore);

  private readonly hoje = hojeLocal();
  protected readonly heroStatus = signal<HojeStatus>('loading');
  protected readonly hero = signal<HeroModelo | null>(null);
  protected readonly cascosStatus = signal<HojeStatus>('loading');
  protected readonly totalCascos = signal(0);
  protected readonly fiadoStatus = signal<HojeStatus>('loading');
  protected readonly totalFiado = signal(0);
  protected readonly alertasStatus = signal<HojeStatus>('loading');
  protected readonly alertas = signal<AcabandoLinha[]>([]);
  protected readonly ultimasStatus = signal<HojeStatus>('loading');
  protected readonly ultimas = signal<UltimaVenda[]>([]);
  protected readonly data = dataExtenso(new Date());
  protected readonly saudacao = saudacao(new Date().getHours());

  constructor() {
    // seis cargas em paralelo; cada uma trata o próprio erro
    void this.carregarCaixa();
    void this.carregar(
      firstValueFrom(this.vendasApi.relatorioFaturamento(this.hoje, this.hoje)),
      this.heroStatus,
      (r) => this.hero.set(modeloHero(r)),
    );
    void this.carregar(firstValueFrom(this.clientesApi.totalCascos()), this.cascosStatus, (r) =>
      this.totalCascos.set(r.totalCascos),
    );
    void this.carregar(firstValueFrom(this.financeiroApi.totalFiado()), this.fiadoStatus, (r) =>
      this.totalFiado.set(r.totalAReceber),
    );
    void this.carregar(
      firstValueFrom(this.estoqueApi.relatorioEstoque()),
      this.alertasStatus,
      (r) => this.alertas.set(modeloAcabando(r.alertasEstoqueMinimo)),
    );
    void this.carregar(this.carregarUltimas(), this.ultimasStatus, (r) => this.ultimas.set(r));
  }

  /** Cinco mais recentes do dia; o servidor ordena por data desc. Nome falho cai em 'Cliente'. */
  private async carregarUltimas(): Promise<UltimaVenda[]> {
    const vendas = await firstValueFrom(
      this.vendasApi.listar({ inicio: this.hoje, fim: this.hoje, page: 1, pageSize: 5 }),
    );
    const nomes = new Map<string, string>();
    await Promise.all(
      [...new Set(vendas.map((v) => v.clienteId))].map(async (id) => {
        try {
          nomes.set(id, (await firstValueFrom(this.clientesApi.obter(id))).nome);
        } catch {
          // fica sem nome
        }
      }),
    );
    return modeloUltimas(vendas, nomes);
  }

  protected carregarCaixa(): Promise<void> {
    return this.caixa.carregar(this.hoje);
  }

  private async carregar<T>(
    p: Promise<T>,
    status: WritableSignal<HojeStatus>,
    aplicar: (r: T) => void,
  ): Promise<void> {
    try {
      aplicar(await p);
      status.set('ok');
    } catch {
      status.set('error');
    }
  }

  /** Saldo só com caixa aberto (valor do servidor); o resto segue o protótipo. */
  protected rotuloCaixa(): string {
    switch (this.caixa.status()) {
      case 'ok': {
        const r = this.caixa.resumo();
        return r?.caixa.status === 'ABERTO' ? new PrecoPipe().transform(r.saldoParcial) : 'Fechado';
      }
      case 'nao-aberto':
        return 'Fechado';
      case 'error':
        return 'Caixa';
      default:
        return '…';
    }
  }

  protected readonly rotaRepor = rotaRepor;
  protected readonly rotaClientes = rotaClientes;
  protected readonly rotaVenda = rotaVenda;

  protected ir(rota: string): void {
    void this.router.navigateByUrl(rota);
  }

  protected primeiroNome(): string {
    return this.operatorStore.operator()?.nome.split(' ')[0] ?? '';
  }
}
