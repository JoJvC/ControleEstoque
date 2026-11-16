import { BreakpointObserver } from '@angular/cdk/layout';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, map } from 'rxjs';

import { CePermissao } from '../../core/permissions/ce-permissao';
import { Icon, IconeNome } from '../../ui/atoms/icon';
import { AppHeader } from '../../ui/organisms/app-header';

interface CardRelatorio {
  rota: string;
  titulo: string;
  descricao: string;
  icone: IconeNome;
  permissao?: string;
}

@Component({
  selector: 'ce-relatorios-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppHeader,
    NgTemplateOutlet,
    CePermissao,
    Icon,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  template: `
    @if (!temFilho()) {
      <ce-app-header titulo="Relatórios" [mostrarVoltar]="true" (voltar)="voltarParaMais()" />
      <ul class="cards">
        @for (c of cards; track c.rota) {
          <ng-container *ngTemplateOutlet="cardItem; context: { $implicit: c }" />
        }
      </ul>
    }
    <ng-template #cardItem let-c>
      @if (c.permissao) {
        <li *cePermissao="c.permissao">
          <ng-container *ngTemplateOutlet="cardLink; context: { $implicit: c }" />
        </li>
      } @else {
        <li><ng-container *ngTemplateOutlet="cardLink; context: { $implicit: c }" /></li>
      }
    </ng-template>
    <ng-template #cardLink let-c>
      <a class="card" [routerLink]="'/relatorios/' + c.rota">
        <span class="card__icone"><ce-icon [nome]="c.icone" /></span>
        <span class="card__texto">
          <span class="card__titulo">{{ c.titulo }}</span>
          <span class="card__descricao">{{ c.descricao }}</span>
        </span>
      </a>
    </ng-template>
    <ng-template #listaItem let-c>
      @if (c.permissao) {
        <li *cePermissao="c.permissao">
          <ng-container *ngTemplateOutlet="listaLink; context: { $implicit: c }" />
        </li>
      } @else {
        <li><ng-container *ngTemplateOutlet="listaLink; context: { $implicit: c }" /></li>
      }
    </ng-template>
    <ng-template #listaLink let-c>
      <a
        class="lista__item"
        [routerLink]="'/relatorios/' + c.rota"
        routerLinkActive="is-active"
        ariaCurrentWhenActive="page"
      >
        <ce-icon [nome]="c.icone" [tamanho]="20" />
        <span>{{ c.titulo }}</span>
      </a>
    </ng-template>
    <div class="layout" [class.layout--lado]="lado()">
      @if (lado()) {
        <nav class="lista" aria-label="Relatórios">
          <ul>
            @for (c of cards; track c.rota) {
              <ng-container *ngTemplateOutlet="listaItem; context: { $implicit: c }" />
            }
          </ul>
        </nav>
      }
      <div class="relatorio"><router-outlet /></div>
    </div>
  `,
  styles: `
    @use 'mixins';

    .cards {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--ce-space-3);
      margin: 0;
      padding: var(--ce-space-4);
      list-style: none;

      @include mixins.from-tablet {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .card {
      @include mixins.touch-target;

      display: flex;
      align-items: center;
      gap: var(--ce-space-3);
      padding: var(--ce-space-4);
      border-radius: 20px;
      background: var(--ce-surface);
      color: inherit;
      text-decoration: none;
    }

    .card__icone {
      display: inline-flex;
      flex-shrink: 0;
      padding: var(--ce-space-2);
      border-radius: 14px;
      background: var(--ce-primary-soft);
      color: var(--ce-primary);
    }

    .card__texto {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-1);
    }

    .card__titulo {
      font-family: var(--ce-font-family-titulo);
      font-weight: 700;
    }

    .card__descricao {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }

    /* <router-outlet> insere o relatório como irmão: o wrapper .relatorio é o único item da 2ª coluna. */
    .relatorio {
      min-width: 0;
    }

    .layout--lado {
      display: grid;
      grid-template-columns: 300px minmax(0, 1fr);
      align-items: start;
    }

    // 56px = altura do cabeçalho fixo do shell; var(--ce-space-6) = padding-bottom do conteúdo ≥960px.
    .layout--lado .lista {
      position: sticky;
      top: calc(56px + env(safe-area-inset-top, 0px));
      max-height: calc(100dvh - 56px - env(safe-area-inset-top, 0px) - var(--ce-space-6));
      overflow-y: auto;
    }

    .lista {
      padding: var(--ce-space-4);

      ul {
        display: flex;
        flex-direction: column;
        gap: var(--ce-space-1);
        margin: 0;
        padding: 0;
        list-style: none;
      }
    }

    .lista__item {
      @include mixins.touch-target;

      display: flex;
      align-items: center;
      gap: var(--ce-space-2);
      padding: var(--ce-space-2) var(--ce-space-3);
      border-radius: 14px;
      color: inherit;
      font-weight: 600;
      text-decoration: none;

      &:focus-visible {
        outline: 2px solid var(--ce-focus-ring);
        outline-offset: 2px;
      }

      &.is-active {
        background: var(--ce-primary-soft);
        box-shadow: inset 3px 0 0 var(--ce-primary);
      }
    }
  `,
})
export class RelatoriosPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly breakpoints = inject(BreakpointObserver);

  /** Há relatório aberto sob o hub (rota filha ativa). */
  protected readonly temFilho = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => !!this.route.firstChild),
    ),
    { initialValue: !!this.route.firstChild },
  );

  // A partir de 960 px o hub vira coluna ao lado do relatório (mesmo breakpoint de Clientes).
  protected readonly desktop = toSignal(
    this.breakpoints.observe('(min-width: 960px)').pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  protected readonly lado = computed(() => this.temFilho() && this.desktop());

  protected voltarParaMais(): void {
    void this.router.navigateByUrl('/mais');
  }

  protected readonly cards: readonly CardRelatorio[] = [
    {
      rota: 'faturamento',
      titulo: 'Faturamento',
      descricao: 'Totais por produto e por dia no período.',
      icone: 'dinheiro',
    },
    {
      rota: 'vendas-por-funcionario',
      titulo: 'Vendas por funcionário',
      descricao: 'Vendas e total líquido de cada funcionário.',
      icone: 'usuario',
    },
    {
      rota: 'caixa',
      titulo: 'Caixa',
      descricao: 'Dias de caixa e despesas por tipo no período.',
      icone: 'caixa',
    },
    {
      rota: 'fiado',
      titulo: 'Fiado',
      descricao: 'Saldo devedor de cada cliente.',
      icone: 'vale',
    },
    {
      rota: 'cascos',
      titulo: 'Cascos',
      descricao: 'Saldo de cascos de cada cliente.',
      icone: 'casco',
    },
    {
      rota: 'sucata',
      titulo: 'Sucata',
      descricao: 'Sucata entregue por cada cliente.',
      icone: 'sucata',
    },
    {
      rota: 'estoque',
      titulo: 'Estoque',
      descricao: 'Itens em estoque e os abaixo do mínimo.',
      icone: 'galao',
    },
    {
      rota: 'lucro',
      titulo: 'Lucro por produto',
      descricao: 'Receita, custo, frete e lucro por produto e marca.',
      icone: 'grafico',
      permissao: 'estoque.custos',
    },
    {
      rota: 'conta-funcionarios',
      titulo: 'Conta de funcionários',
      descricao: 'Saldo a pagar de cada funcionário.',
      icone: 'usuario',
    },
    {
      rota: 'vendas-por-periodo',
      titulo: 'Vendas por período',
      descricao: 'Recebido e fiado gerado por dia.',
      icone: 'grafico',
    },
  ];
}
