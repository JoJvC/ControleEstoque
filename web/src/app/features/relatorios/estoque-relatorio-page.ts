import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { EmptyState } from '../../ui/molecules/empty-state';
import { AppHeader } from '../../ui/organisms/app-header';
import { EstadoRelatorio } from './estado-relatorio';
import { RelatoriosStore } from './relatorios-store';

/** O destaque vem da lista de alertas do servidor; o front não compara quantidade com mínimo (§8 regra 6). */
@Component({
  selector: 'ce-estoque-relatorio-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeader, EmptyState, EstadoRelatorio],
  styleUrl: './relatorio.scss',
  template: `
    <ce-app-header titulo="Estoque" [mostrarVoltar]="true" (voltar)="voltar()" />

    <div class="conteudo">
      <ce-estado-relatorio
        [carregando]="estado().carregando"
        [erro]="estado().erro"
        [temDados]="!!estado().dados"
        (recarregar)="carregar()"
      />
      @if (estado().dados; as rel) {
        @if (rel.itens.length === 0) {
          <ce-empty-state icone="alerta" titulo="Nenhum item em estoque" />
        } @else {
          <ul class="cards">
            @for (c of rel.itens; track c.produtoId) {
              <li class="card" [class.abaixo-minimo]="abaixo(c.produtoId)">
                <dl>
                  <dt class="card__titulo">{{ c.nome }}</dt>
                  <dt>Quantidade</dt>
                  <dd>{{ c.quantidade }}</dd>
                  <dt>Estoque mínimo</dt>
                  <dd>{{ c.estoqueMinimo }}</dd>
                </dl>
              </li>
            }
          </ul>
          <div class="tabela">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th class="num">Quantidade</th>
                  <th class="num">Estoque mínimo</th>
                </tr>
              </thead>
              <tbody>
                @for (c of rel.itens; track c.produtoId) {
                  <tr [class.abaixo-minimo]="abaixo(c.produtoId)">
                    <td>{{ c.nome }}</td>
                    <td class="num">{{ c.quantidade }}</td>
                    <td class="num">{{ c.estoqueMinimo }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </div>
  `,
})
export class EstoqueRelatorioPage {
  private readonly store = inject(RelatoriosStore);
  private readonly router = inject(Router);

  protected readonly estado = this.store.estoque;

  constructor() {
    this.carregar();
  }

  protected abaixo(produtoId: string): boolean {
    return !!this.estado().dados?.alertasEstoqueMinimo.some((a) => a.produtoId === produtoId);
  }

  protected carregar(): void {
    void this.store.carregarEstoque();
  }

  protected voltar(): void {
    void this.router.navigateByUrl('/relatorios');
  }
}
