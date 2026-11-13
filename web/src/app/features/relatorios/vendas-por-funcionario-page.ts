import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { EmptyState } from '../../ui/molecules/empty-state';
import { AppHeader } from '../../ui/organisms/app-header';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { EstadoRelatorio } from './estado-relatorio';
import { FiltroPeriodo } from './filtro-periodo';
import { MSG_PERIODO_INVERTIDO, periodoInvertido, periodoPadrao } from './periodo';
import { RelatoriosStore } from './relatorios-store';

@Component({
  selector: 'ce-vendas-por-funcionario-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeader, EmptyState, EstadoRelatorio, FiltroPeriodo, PrecoPipe],
  styleUrl: './relatorio.scss',
  template: `
    <ce-app-header titulo="Vendas por funcionário" [mostrarVoltar]="true" (voltar)="voltar()" />

    <ce-filtro-periodo
      [inicio]="inicio()"
      [fim]="fim()"
      [erro]="erroPeriodo()"
      [carregando]="estado().carregando"
      (inicioChange)="inicio.set($event)"
      (fimChange)="fim.set($event)"
      (buscar)="buscar()"
    />

    <div class="conteudo">
      <ce-estado-relatorio
        [carregando]="estado().carregando"
        [erro]="estado().erro"
        [temDados]="!!estado().dados"
        (recarregar)="buscar()"
      />
      @if (estado().dados; as linhas) {
        @if (linhas.length === 0) {
          <ce-empty-state icone="alerta" titulo="Nenhuma venda no período" />
        } @else {
          <ul class="cards">
            @for (f of linhas; track f.funcionarioId) {
              <li class="card">
                <dl>
                  <dt class="card__titulo">{{ f.nome }}</dt>
                  <dt>Vendas</dt>
                  <dd>{{ f.quantidadeVendas }}</dd>
                  <dt>Total líquido</dt>
                  <dd>{{ f.totalLiquido | cePreco }}</dd>
                </dl>
              </li>
            }
          </ul>
          <div class="tabela">
            <table>
              <thead>
                <tr>
                  <th>Funcionário</th>
                  <th class="num">Vendas</th>
                  <th class="num">Total líquido</th>
                </tr>
              </thead>
              <tbody>
                @for (f of linhas; track f.funcionarioId) {
                  <tr>
                    <td>{{ f.nome }}</td>
                    <td class="num">{{ f.quantidadeVendas }}</td>
                    <td class="num">{{ f.totalLiquido | cePreco }}</td>
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
export class VendasPorFuncionarioPage {
  private readonly store = inject(RelatoriosStore);
  private readonly router = inject(Router);

  protected readonly estado = this.store.vendasPorFuncionario;
  protected readonly inicio = signal(periodoPadrao().inicio);
  protected readonly fim = signal(periodoPadrao().fim);

  protected readonly erroPeriodo = computed(() =>
    periodoInvertido(this.inicio(), this.fim()) ? MSG_PERIODO_INVERTIDO : null,
  );

  constructor() {
    this.buscar();
  }

  protected buscar(): void {
    if (this.erroPeriodo()) {
      return;
    }
    void this.store.carregarVendasPorFuncionario(this.inicio(), this.fim());
  }

  protected voltar(): void {
    void this.router.navigateByUrl('/relatorios');
  }
}
