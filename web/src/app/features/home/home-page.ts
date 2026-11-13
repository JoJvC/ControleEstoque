import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { EstoqueApi } from '../../core/api/estoque-api';
import { EstoqueItemResponse } from '../../core/api/models/estoque';
import { VendasApi } from '../../core/api/vendas-api';
import { OperatorStore } from '../../core/operator/operator-store';
import { CePermissao } from '../../core/permissions/ce-permissao';
import { hojeLocal } from '../../core/util/data-local';
import { Button } from '../../ui/atoms/button';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { DataList, DataListStatus } from '../../ui/organisms/data-list';
import { CaixaStore } from '../financeiro/caixa-store';

@Component({
  selector: 'ce-home-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Button, CePermissao, DataList, PrecoPipe],
  template: `
    <section class="home">
      <h1 class="home__titulo">Olá, {{ primeiroNome() }}!</h1>

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

      <section class="home__bloco" aria-label="Total vendido hoje">
        <h2>Vendido hoje</h2>
        @switch (totalStatus()) {
          @case ('ok') {
            <p class="home__total">{{ totalLiquido() | cePreco }}</p>
          }
          @case ('error') {
            <p>Não foi possível carregar o total.</p>
            <ce-button variante="ghost" (click)="carregarTotal()">Tentar novamente</ce-button>
          }
          @default {
            <p aria-busy="true">Carregando…</p>
          }
        }
      </section>

      <section class="home__bloco" aria-label="Estoque mínimo">
        <h2>Estoque abaixo do mínimo</h2>
        <ce-data-list
          [itens]="alertas()"
          [status]="alertasStatus()"
          vazioTitulo="Nenhum produto abaixo do mínimo"
          (recarregar)="carregarAlertas()"
        >
          <ng-template let-item>
            <p>{{ item.nome }}: {{ item.quantidade }} (mínimo {{ item.estoqueMinimo }})</p>
          </ng-template>
        </ce-data-list>
        <ce-button
          *cePermissao="'relatorios.ver'"
          variante="ghost"
          (click)="ir('/relatorios/estoque')"
          >Ver relatório de estoque</ce-button
        >
      </section>

      <section class="home__bloco" aria-label="Atalhos">
        <h2>Atalhos</h2>
        <ce-button *cePermissao="'vendas.registrar'" (click)="ir('/vendas/nova')"
          >Nova venda</ce-button
        >
        <ce-button *cePermissao="'relatorios.ver'" variante="ghost" (click)="ir('/relatorios')"
          >Relatórios</ce-button
        >
      </section>
    </section>
  `,
  styles: `
    .home {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
      padding: var(--ce-space-5) var(--ce-space-4);
    }

    .home__titulo {
      font-size: var(--ce-font-xl);
    }

    .home__bloco {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-2);
    }

    .home__total {
      font-size: var(--ce-font-xl);
    }
  `,
})
export class HomePage {
  private readonly operatorStore = inject(OperatorStore);

  private readonly router = inject(Router);
  private readonly vendasApi = inject(VendasApi);
  private readonly estoqueApi = inject(EstoqueApi);
  protected readonly caixa = inject(CaixaStore);

  private readonly hoje = hojeLocal();
  protected readonly totalStatus = signal<'loading' | 'ok' | 'error'>('loading');
  protected readonly totalLiquido = signal(0);
  protected readonly alertasStatus = signal<DataListStatus>('loading');
  protected readonly alertas = signal<EstoqueItemResponse[]>([]);

  constructor() {
    // três cargas em paralelo; cada uma trata o próprio erro
    void this.carregarCaixa();
    void this.carregarTotal();
    void this.carregarAlertas();
  }

  protected carregarCaixa(): Promise<void> {
    return this.caixa.carregar(this.hoje);
  }

  protected async carregarTotal(): Promise<void> {
    this.totalStatus.set('loading');
    try {
      const r = await firstValueFrom(this.vendasApi.relatorioFaturamento(this.hoje, this.hoje));
      this.totalLiquido.set(r.totalLiquido);
      this.totalStatus.set('ok');
    } catch {
      this.totalStatus.set('error');
    }
  }

  protected async carregarAlertas(): Promise<void> {
    this.alertasStatus.set('loading');
    try {
      const r = await firstValueFrom(this.estoqueApi.relatorioEstoque());
      this.alertas.set(r.alertasEstoqueMinimo);
      this.alertasStatus.set('ok');
    } catch {
      this.alertasStatus.set('error');
    }
  }

  protected ir(rota: string): void {
    void this.router.navigateByUrl(rota);
  }

  protected primeiroNome(): string {
    return this.operatorStore.operator()?.nome.split(' ')[0] ?? '';
  }
}
