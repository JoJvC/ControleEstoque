import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { StatusCaixa } from '../../core/api/models/financeiro';
import { EmptyState } from '../../ui/molecules/empty-state';
import { AppHeader } from '../../ui/organisms/app-header';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { EstadoRelatorio } from './estado-relatorio';
import { FiltroPeriodo } from './filtro-periodo';
import { MSG_PERIODO_INVERTIDO, periodoInvertido, periodoPadrao } from './periodo';
import { RelatoriosStore } from './relatorios-store';

@Component({
  selector: 'ce-caixa-relatorio-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, AppHeader, EmptyState, EstadoRelatorio, FiltroPeriodo, PrecoPipe],
  styleUrl: './relatorio.scss',
  template: `
    <ce-app-header titulo="Caixa" [mostrarVoltar]="true" (voltar)="voltar()" />

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
      @if (estado().dados; as r) {
        <h2>Dias</h2>
        @if (r.dias.length === 0) {
          <ce-empty-state icone="alerta" titulo="Nenhum caixa no período" />
        } @else {
          <ul class="cards">
            @for (d of r.dias; track d.data) {
              <li class="card">
                <dl>
                  <dt class="card__titulo">
                    {{ d.data | date: 'dd/MM/yyyy' }} · {{ rotuloStatus(d.status) }}
                  </dt>
                  <dt>Saldo inicial</dt>
                  <dd>{{ d.saldoInicial | cePreco }}</dd>
                  <dt>Entradas</dt>
                  <dd>{{ d.entradas | cePreco }}</dd>
                  <dt>Saídas</dt>
                  <dd>{{ d.saidas | cePreco }}</dd>
                  <dt>Saldo final</dt>
                  <dd>{{ d.saldoFinal | cePreco }}</dd>
                </dl>
              </li>
            }
          </ul>
          <div class="tabela">
            <table>
              <thead>
                <tr>
                  <th>Dia</th>
                  <th>Situação</th>
                  <th class="num">Saldo inicial</th>
                  <th class="num">Entradas</th>
                  <th class="num">Saídas</th>
                  <th class="num">Saldo final</th>
                </tr>
              </thead>
              <tbody>
                @for (d of r.dias; track d.data) {
                  <tr>
                    <td>{{ d.data | date: 'dd/MM/yyyy' }}</td>
                    <td>{{ rotuloStatus(d.status) }}</td>
                    <td class="num">{{ d.saldoInicial | cePreco }}</td>
                    <td class="num">{{ d.entradas | cePreco }}</td>
                    <td class="num">{{ d.saidas | cePreco }}</td>
                    <td class="num">{{ d.saldoFinal | cePreco }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <h2>Despesas por tipo</h2>
        @if (r.despesasPorTipo.length === 0) {
          <ce-empty-state icone="alerta" titulo="Nenhuma despesa no período" />
        } @else {
          <ul class="cards">
            @for (t of r.despesasPorTipo; track t.tipoDespesa) {
              <li class="card">
                <dl>
                  <dt>{{ t.tipoDespesa }}</dt>
                  <dd>{{ t.total | cePreco }}</dd>
                </dl>
              </li>
            }
          </ul>
          <div class="tabela">
            <table>
              <thead>
                <tr>
                  <th>Tipo de despesa</th>
                  <th class="num">Total</th>
                </tr>
              </thead>
              <tbody>
                @for (t of r.despesasPorTipo; track t.tipoDespesa) {
                  <tr>
                    <td>{{ t.tipoDespesa }}</td>
                    <td class="num">{{ t.total | cePreco }}</td>
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
export class CaixaRelatorioPage {
  private readonly store = inject(RelatoriosStore);
  private readonly router = inject(Router);

  protected readonly estado = this.store.caixa;
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
    void this.store.carregarCaixa(this.inicio(), this.fim());
  }

  protected rotuloStatus(status: StatusCaixa): string {
    return status === 'ABERTO' ? 'Aberto' : 'Fechado';
  }

  protected voltar(): void {
    void this.router.navigateByUrl('/relatorios');
  }
}
