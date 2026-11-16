import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { rotuloDaMarca } from '../../core/api/produto-leitura';
import { EmptyState } from '../../ui/molecules/empty-state';
import { AppHeader } from '../../ui/organisms/app-header';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { EstadoRelatorio } from './estado-relatorio';
import { FiltroPeriodo } from './filtro-periodo';
import { MSG_PERIODO_INVERTIDO, periodoInvertido, periodoPadrao } from './periodo';
import { RelatoriosStore } from './relatorios-store';

/** Todos os números vêm do servidor; a linha pendente chega sem custo, frete e lucro. */
@Component({
  selector: 'ce-lucro-relatorio-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeader, EmptyState, EstadoRelatorio, FiltroPeriodo, PrecoPipe],
  styleUrl: './relatorio.scss',
  template: `
    <ce-app-header titulo="Lucro por produto" [mostrarVoltar]="true" (voltar)="voltar()" />

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
        @if (r.linhas.length === 0) {
          <ce-empty-state icone="alerta" titulo="Nenhuma venda no período" />
        } @else {
          @if (r.totais.linhasPendentes > 0) {
            <p class="aviso" role="status">
              {{ r.totais.linhasPendentes }} linha(s) com custo pendente: custo e lucro do total não
              as incluem.
            </p>
          }
          <dl class="totais">
            <div class="total">
              <dt>Receita</dt>
              <dd>{{ r.totais.receita | cePreco }}</dd>
            </div>
            <div class="total">
              <dt>Custo dos produtos</dt>
              <dd>{{ r.totais.custoProdutos | cePreco }}</dd>
            </div>
            <div class="total">
              <dt>Frete</dt>
              <dd>{{ r.totais.frete | cePreco }}</dd>
            </div>
            <div class="total">
              <dt>Lucro</dt>
              <dd>{{ r.totais.lucro | cePreco }}</dd>
            </div>
          </dl>
          <ul class="cards">
            @for (l of r.linhas; track l.produtoMarcaId) {
              <li class="card" [attr.data-pendente]="l.custoPendente ? '' : null">
                <dl>
                  <dt class="card__titulo">
                    {{ l.produtoNome }} — {{ rotulo(l.marcaNome) }}
                    @if (l.custoPendente) {
                      <span class="pendente">custo pendente</span>
                    }
                  </dt>
                  <dt>Quantidade</dt>
                  <dd>{{ l.quantidadeVendida }}</dd>
                  <dt>Receita</dt>
                  <dd>{{ l.receita | cePreco }}</dd>
                  <dt>Vasilhame</dt>
                  <dd>{{ l.receitaVasilhame | cePreco }}</dd>
                  <dt>Custo</dt>
                  <dd>{{ l.custoProdutos === null ? '—' : (l.custoProdutos | cePreco) }}</dd>
                  <dt>Frete</dt>
                  <dd>{{ l.frete === null ? '—' : (l.frete | cePreco) }}</dd>
                  <dt>Lucro</dt>
                  <dd>{{ l.lucro === null ? '—' : (l.lucro | cePreco) }}</dd>
                </dl>
              </li>
            }
          </ul>
          <div class="tabela">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th class="num">Qtd.</th>
                  <th class="num">Receita</th>
                  <th class="num">Vasilhame</th>
                  <th class="num">Custo</th>
                  <th class="num">Frete</th>
                  <th class="num">Lucro</th>
                </tr>
              </thead>
              <tbody>
                @for (l of r.linhas; track l.produtoMarcaId) {
                  <tr [attr.data-pendente]="l.custoPendente ? '' : null">
                    <td>
                      {{ l.produtoNome }} — {{ rotulo(l.marcaNome) }}
                      @if (l.custoPendente) {
                        <span class="pendente">custo pendente</span>
                      }
                    </td>
                    <td class="num">{{ l.quantidadeVendida }}</td>
                    <td class="num">{{ l.receita | cePreco }}</td>
                    <td class="num">{{ l.receitaVasilhame | cePreco }}</td>
                    <td class="num">
                      {{ l.custoProdutos === null ? '—' : (l.custoProdutos | cePreco) }}
                    </td>
                    <td class="num">{{ l.frete === null ? '—' : (l.frete | cePreco) }}</td>
                    <td class="num">{{ l.lucro === null ? '—' : (l.lucro | cePreco) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </div>
  `,
  styles: `
    .aviso {
      margin: 0;
      padding: var(--ce-space-3) var(--ce-space-4);
      border-radius: 20px;
      background: var(--ce-warning-soft);
    }

    .pendente {
      margin-left: var(--ce-space-2);
      font-size: var(--ce-font-sm);
      font-weight: 700;
    }
  `,
})
export class LucroRelatorioPage {
  private readonly store = inject(RelatoriosStore);
  private readonly router = inject(Router);

  protected readonly estado = this.store.lucro;
  protected readonly inicio = signal(periodoPadrao().inicio);
  protected readonly fim = signal(periodoPadrao().fim);
  protected readonly rotulo = rotuloDaMarca;

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
    void this.store.carregarLucro(this.inicio(), this.fim());
  }

  protected voltar(): void {
    void this.router.navigateByUrl('/relatorios');
  }
}
