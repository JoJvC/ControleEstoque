import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { Select } from '../../ui/atoms/select';
import { AppHeader } from '../../ui/organisms/app-header';
import { EmptyState } from '../../ui/molecules/empty-state';
import { FormField } from '../../ui/molecules/form-field';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { ProdutosStore } from '../produtos/produtos-store';
import { EstadoRelatorio } from './estado-relatorio';
import { FiltroPeriodo } from './filtro-periodo';
import { MSG_PERIODO_INVERTIDO, periodoInvertido, periodoPadrao } from './periodo';
import { RelatoriosStore } from './relatorios-store';

@Component({
  selector: 'ce-faturamento-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    AppHeader,
    EmptyState,
    EstadoRelatorio,
    FiltroPeriodo,
    FormField,
    PrecoPipe,
    Select,
  ],
  styleUrl: './relatorio.scss',
  template: `
    <ce-app-header titulo="Faturamento" [mostrarVoltar]="true" (voltar)="voltar()" />

    <ce-filtro-periodo
      [inicio]="inicio()"
      [fim]="fim()"
      [erro]="erroPeriodo()"
      [carregando]="estado().carregando"
      (inicioChange)="inicio.set($event)"
      (fimChange)="fim.set($event)"
      (buscar)="buscar()"
    >
      <ce-form-field rotulo="Produto">
        <ce-select
          [opcoes]="opcoesProduto()"
          [ngModel]="produtoId()"
          (ngModelChange)="produtoId.set($event ?? '')"
        />
      </ce-form-field>
    </ce-filtro-periodo>

    <div class="conteudo">
      <ce-estado-relatorio
        [carregando]="estado().carregando"
        [erro]="estado().erro"
        [temDados]="!!estado().dados"
        (recarregar)="buscar()"
      />
      @if (estado().dados; as r) {
        <dl class="totais">
          <div class="total">
            <dt>Total bruto</dt>
            <dd>{{ r.totalBruto | cePreco }}</dd>
          </div>
          <div class="total">
            <dt>Desconto</dt>
            <dd>{{ r.totalDesconto | cePreco }}</dd>
          </div>
          <div class="total">
            <dt>Total líquido</dt>
            <dd>{{ r.totalLiquido | cePreco }}</dd>
          </div>
        </dl>

        <h2>Por produto</h2>
        @if (r.porProduto.length === 0) {
          <ce-empty-state icone="alerta" titulo="Nenhuma venda no período" />
        } @else {
          <ul class="cards">
            @for (p of r.porProduto; track p.produtoId) {
              <li class="card">
                <dl>
                  <dt class="card__titulo">{{ p.nome }}</dt>
                  <dt>Quantidade</dt>
                  <dd>{{ p.quantidade }}</dd>
                  <dt>Total líquido</dt>
                  <dd>{{ p.totalLiquido | cePreco }}</dd>
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
                  <th class="num">Total líquido</th>
                </tr>
              </thead>
              <tbody>
                @for (p of r.porProduto; track p.produtoId) {
                  <tr>
                    <td>{{ p.nome }}</td>
                    <td class="num">{{ p.quantidade }}</td>
                    <td class="num">{{ p.totalLiquido | cePreco }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <h2>Por dia</h2>
        @if (r.porDia.length > 0) {
          <ul class="cards">
            @for (d of r.porDia; track d.dia) {
              <li class="card">
                <dl>
                  <dt>{{ d.dia | date: 'dd/MM/yyyy' }}</dt>
                  <dd>{{ d.totalLiquido | cePreco }}</dd>
                </dl>
              </li>
            }
          </ul>
          <div class="tabela">
            <table>
              <thead>
                <tr>
                  <th>Dia</th>
                  <th class="num">Total líquido</th>
                </tr>
              </thead>
              <tbody>
                @for (d of r.porDia; track d.dia) {
                  <tr>
                    <td>{{ d.dia | date: 'dd/MM/yyyy' }}</td>
                    <td class="num">{{ d.totalLiquido | cePreco }}</td>
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
export class FaturamentoPage {
  private readonly store = inject(RelatoriosStore);
  private readonly produtos = inject(ProdutosStore);
  private readonly router = inject(Router);

  protected readonly estado = this.store.faturamento;
  protected readonly inicio = signal(periodoPadrao().inicio);
  protected readonly fim = signal(periodoPadrao().fim);
  /** '' = todos os produtos (produtoId não vai na query). */
  protected readonly produtoId = signal('');

  protected readonly erroPeriodo = computed(() =>
    periodoInvertido(this.inicio(), this.fim()) ? MSG_PERIODO_INVERTIDO : null,
  );

  protected readonly opcoesProduto = computed(() => [
    { value: '', label: 'Todos os produtos' },
    ...this.produtos.produtos().map((p) => ({ value: p.id, label: p.nome })),
  ]);

  constructor() {
    this.produtos.carregar();
    this.buscar();
  }

  protected buscar(): void {
    if (this.erroPeriodo()) {
      return;
    }
    void this.store.carregarFaturamento(this.inicio(), this.fim(), this.produtoId() || undefined);
  }

  protected voltar(): void {
    void this.router.navigateByUrl('/relatorios');
  }
}
