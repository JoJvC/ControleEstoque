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
import { AppHeader } from '../../ui/organisms/app-header';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { CaixaStore } from '../financeiro/caixa-store';
import { AcabandoLinha, HojeAcabando, modeloAcabando } from './hoje-acabando';
import { HojeCartao } from './hoje-cartao';
import { HeroModelo, HojeHero, modeloHero } from './hoje-hero';
import { HojeStatus } from './hoje-status';

@Component({
  selector: 'ce-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeader, Button, CePermissao, HojeAcabando, HojeCartao, HojeHero, PrecoPipe],
  template: `
    <ce-app-header [titulo]="'Olá, ' + primeiroNome() + '!'" [onda]="true" />
    <section class="home">
      <ce-hoje-hero class="home__hero" [modelo]="hero()" [status]="heroStatus()" />

      <ce-button
        *cePermissao="'vendas.registrar'"
        class="home__nova"
        [block]="true"
        (click)="ir('/vendas/nova')"
        >Nova venda</ce-button
      >

      <ce-hoje-cartao variante="casco" [valor]="'' + totalCascos()" [status]="cascosStatus()" />
      <ce-hoje-cartao variante="fiado" [valor]="totalFiado() | cePreco" [status]="fiadoStatus()" />

      <ce-hoje-acabando class="home__acabando" [itens]="alertas()" [status]="alertasStatus()" />

      <section class="home__bloco" aria-label="Caixa de hoje">
        <h2>Caixa de hoje</h2>
        @switch (caixa.status()) {
          @case ('ok') {
            <p>Caixa aberto</p>
          }
          @case ('nao-aberto') {
            <p>Caixa não aberto</p>
          }
          @case ('error') {
            <p>Não foi possível carregar o caixa.</p>
            <ce-button variante="ghost" (click)="carregarCaixa()">Tentar novamente</ce-button>
          }
          @default {
            <p aria-busy="true">Carregando…</p>
          }
        }
        <ce-button variante="ghost" (click)="ir('/financeiro/caixa')">Ir para o caixa</ce-button>
      </section>

      <section class="home__bloco" aria-label="Atalhos">
        <h2>Atalhos</h2>
        <ce-button
          *cePermissao="'relatorios.ver'"
          variante="ghost"
          (click)="ir('/relatorios/estoque')"
          >Ver relatório de estoque</ce-button
        >
        <ce-button *cePermissao="'relatorios.ver'" variante="ghost" (click)="ir('/relatorios')"
          >Relatórios</ce-button
        >
      </section>
    </section>
  `,
  styles: `
    .home {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--ce-space-3);
      padding: var(--ce-space-5) var(--ce-space-4);
    }

    .home__bloco {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    .home__nova {
      min-height: 44px;
    }

    @media (min-width: 960px) {
      .home {
        grid-template-columns: 1fr 1fr;
      }

      .home__hero,
      .home__nova,
      .home__acabando,
      .home__bloco {
        grid-column: 1 / -1;
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

  constructor() {
    // cinco cargas em paralelo; cada uma trata o próprio erro
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

  protected ir(rota: string): void {
    void this.router.navigateByUrl(rota);
  }

  protected primeiroNome(): string {
    return this.operatorStore.operator()?.nome.split(' ')[0] ?? '';
  }
}
