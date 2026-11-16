import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { LinhaVendasPorFuncionario } from '../../core/api/models/relatorios';
import { rotuloDaMarca } from '../../core/api/produto-leitura';
import { Icon } from '../../ui/atoms/icon';
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
  imports: [AppHeader, EmptyState, EstadoRelatorio, FiltroPeriodo, Icon, PrecoPipe],
  styleUrl: './relatorio.scss',
  template: `
    <ce-app-header titulo="Vendas por funcionário" [mostrarVoltar]="true" (voltar)="voltar()" />

    <ce-filtro-periodo
      [inicio]="inicio()"
      [fim]="fim()"
      [erro]="erroPeriodo()"
      [carregando]="estado().carregando"
      (inicioChange)="mudarInicio($event)"
      (fimChange)="mudarFim($event)"
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
        @if (r.funcionarios.length === 0) {
          <ce-empty-state icone="alerta" titulo="Nenhuma venda no período" />
        } @else {
          <dl class="totais">
            <div class="total">
              <dt>Vendas</dt>
              <dd>{{ r.totais.quantidadeVendas }}</dd>
            </div>
            <div class="total">
              <dt>Entregas</dt>
              <dd>{{ r.totais.quantidadeEntregas }}</dd>
            </div>
            <div class="total">
              <dt>Total</dt>
              <dd>{{ r.totais.totalLiquido | cePreco }}</dd>
            </div>
          </dl>
          <ul class="funcionarios">
            @for (f of r.funcionarios; track f.funcionarioId) {
              <li class="funcionario">
                <button
                  type="button"
                  class="funcionario__cab"
                  [attr.aria-expanded]="aberto(f.funcionarioId)"
                  (click)="alternar(f.funcionarioId)"
                >
                  <ce-icon
                    class="funcionario__seta"
                    [class.funcionario__seta--aberta]="aberto(f.funcionarioId)"
                    nome="seta-direita"
                    [tamanho]="20"
                  />
                  <span class="funcionario__nome">{{ f.nome }}</span>
                  <span class="funcionario__resumo">
                    {{ f.quantidadeVendas }} vendas · {{ f.quantidadeEntregas }} entregas ·
                    {{ f.totalLiquido | cePreco }}
                  </span>
                </button>
                @if (aberto(f.funcionarioId)) {
                  <ul class="funcionario__detalhe">
                    @for (l of f.itens; track $index) {
                      <li>
                        <span>{{ descricao(l) }}</span>
                        <span class="funcionario__detalhe-qtd">{{ l.quantidade }}</span>
                        <span class="funcionario__detalhe-valor">{{ l.total | cePreco }}</span>
                      </li>
                    }
                    @if (f.descontoSucata > 0) {
                      <li class="funcionario__detalhe-sucata">
                        <span>Desconto por sucata</span>
                        <span class="funcionario__detalhe-valor">{{
                          f.descontoSucata | cePreco
                        }}</span>
                      </li>
                    }
                  </ul>
                }
              </li>
            }
          </ul>
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

  private readonly abertos = signal<ReadonlySet<string>>(new Set());

  constructor() {
    this.buscar();
  }

  protected aberto(id: string): boolean {
    return this.abertos().has(id);
  }

  protected alternar(id: string): void {
    const novo = new Set(this.abertos());
    if (!novo.delete(id)) {
      novo.add(id);
    }
    this.abertos.set(novo);
  }

  protected descricao(l: LinhaVendasPorFuncionario): string {
    return l.tipo === 'VASILHAME'
      ? `Vasilhame ${l.tipoCascoNome}`
      : `${l.produtoNome} ${rotuloDaMarca(l.marcaNome ?? '')}`;
  }

  protected mudarInicio(valor: string): void {
    this.inicio.set(valor);
    this.buscar();
  }

  protected mudarFim(valor: string): void {
    this.fim.set(valor);
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
