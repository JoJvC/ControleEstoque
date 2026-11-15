import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AppHeader } from '../../ui/organisms/app-header';

interface CardRelatorio {
  rota: string;
  titulo: string;
  descricao: string;
}

@Component({
  selector: 'ce-relatorios-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeader, RouterLink],
  template: `
    <ce-app-header titulo="Relatórios" />
    <ul class="cards">
      @for (c of cards; track c.rota) {
        <li>
          <a class="card" [routerLink]="'/relatorios/' + c.rota">
            <span class="card__titulo">{{ c.titulo }}</span>
            <span class="card__descricao">{{ c.descricao }}</span>
          </a>
        </li>
      }
    </ul>
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
      flex-direction: column;
      gap: var(--ce-space-1);
      padding: var(--ce-space-4);
      border-radius: 20px;
      background: var(--ce-surface);
      color: inherit;
      text-decoration: none;
    }

    .card__titulo {
      font-family: var(--ce-font-family-titulo);
      font-weight: 700;
    }

    .card__descricao {
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
    }
  `,
})
export class RelatoriosPage {
  protected readonly cards: readonly CardRelatorio[] = [
    {
      rota: 'faturamento',
      titulo: 'Faturamento',
      descricao: 'Totais e vendas por produto e por dia, com filtro de período e produto.',
    },
    {
      rota: 'vendas-por-funcionario',
      titulo: 'Vendas por funcionário',
      descricao: 'Quantidade de vendas e total líquido de cada funcionário no período.',
    },
    {
      rota: 'caixa',
      titulo: 'Caixa',
      descricao: 'Dias de caixa e despesas por tipo no período.',
    },
    {
      rota: 'fiado',
      titulo: 'Fiado',
      descricao: 'Saldo devedor de cada cliente.',
    },
    {
      rota: 'cascos',
      titulo: 'Cascos',
      descricao: 'Saldo de cascos de cada cliente.',
    },
    {
      rota: 'sucata',
      titulo: 'Sucata',
      descricao: 'Sucata entregue por cada cliente.',
    },
    {
      rota: 'estoque',
      titulo: 'Estoque',
      descricao: 'Itens em estoque, com os abaixo do mínimo em destaque.',
    },
    {
      rota: 'conta-funcionarios',
      titulo: 'Conta de funcionários',
      descricao: 'Saldo a pagar de cada funcionário.',
    },
  ];
}
