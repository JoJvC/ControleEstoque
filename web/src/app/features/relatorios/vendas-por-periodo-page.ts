import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';

import { EmptyState } from '../../ui/molecules/empty-state';
import { AppHeader } from '../../ui/organisms/app-header';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { EstadoRelatorio } from './estado-relatorio';
import { FiltroPeriodo } from './filtro-periodo';
import { MARGEM_PADRAO, montarGraficoEmpilhado, proximoIndice } from './grafico-empilhado';
import { MSG_PERIODO_INVERTIDO, periodoInvertido, periodoPadrao } from './periodo';
import { RelatoriosStore } from './relatorios-store';

const ALTURA_GRAFICO = 240;
/** Sem medida do contêiner (SSR, jsdom) o gráfico nasce com esta largura. */
const LARGURA_INICIAL = 640;
/** Espaço mínimo por dia; abaixo disso o gráfico passa a rolar na horizontal. */
const ESPACO_MINIMO_DIA = 20;
/** Largura aproximada de um rótulo dd/mm a 12 px. */
const LARGURA_ROTULO_DIA = 36;
const TECLAS = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];

@Component({
  selector: 'ce-vendas-por-periodo-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, AppHeader, EmptyState, EstadoRelatorio, FiltroPeriodo, PrecoPipe],
  styleUrl: './relatorio.scss',
  template: `
    <ce-app-header titulo="Vendas por período" [mostrarVoltar]="true" (voltar)="voltar()" />

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
        <dl class="totais">
          <div class="total">
            <dt>Recebido</dt>
            <dd>{{ r.recebido | cePreco }}</dd>
          </div>
          <div class="total">
            <dt>Fiado gerado</dt>
            <dd>{{ r.fiadoGerado | cePreco }}</dd>
          </div>
        </dl>

        @if (r.porDia.length === 0) {
          <ce-empty-state icone="alerta" titulo="Nenhuma venda no período" />
        } @else {
          <section class="grafico" aria-label="Gráfico de vendas por dia">
            <ul class="legenda">
              <li>
                <svg width="16" height="16" aria-hidden="true">
                  <rect width="16" height="16" rx="3" class="amostra amostra--recebido" />
                </svg>
                Recebido
              </li>
              <li>
                <svg width="16" height="16" aria-hidden="true">
                  <rect width="16" height="16" rx="3" class="amostra amostra--fiado" />
                </svg>
                Fiado gerado
              </li>
            </ul>

            <div #caixa class="grafico__caixa">
              @if (modelo(); as m) {
                <svg
                  role="group"
                  aria-labelledby="grafico-titulo grafico-desc"
                  [attr.width]="m.largura"
                  [attr.height]="m.altura"
                  [attr.viewBox]="'0 0 ' + m.largura + ' ' + m.altura"
                >
                  <title id="grafico-titulo">Vendas por dia: recebido e fiado gerado</title>
                  <desc id="grafico-desc">{{ resumo() }}</desc>
                  <defs>
                    <pattern
                      id="ce-listras-fiado"
                      width="6"
                      height="6"
                      patternUnits="userSpaceOnUse"
                      patternTransform="rotate(45)"
                    >
                      <rect width="6" height="6" class="listras__fundo" />
                      <rect width="2.5" height="6" class="listras__listra" />
                    </pattern>
                  </defs>

                  @for (t of m.ticks; track t.valor) {
                    <line
                      class="grade"
                      [attr.x1]="m.margem.esquerda"
                      [attr.x2]="m.largura - m.margem.direita"
                      [attr.y1]="t.y"
                      [attr.y2]="t.y"
                    />
                    <text
                      class="eixo"
                      text-anchor="end"
                      [attr.x]="m.margem.esquerda - 8"
                      [attr.y]="t.y + 4"
                    >
                      {{ t.rotulo }}
                    </text>
                  }

                  <g role="list" aria-label="Dias do período, use as setas para navegar">
                    @for (b of m.barras; track b.dia; let i = $index) {
                      <g
                        class="barra"
                        role="listitem"
                        [class.barra--ativa]="i === indiceAtivo()"
                        [attr.tabindex]="i === indiceAtivo() ? 0 : -1"
                        [attr.aria-label]="b.ariaLabel"
                        (focus)="ativo.set(i)"
                        (click)="ativo.set(i)"
                        (keydown)="teclar($event, i)"
                      >
                        <rect
                          class="barra__area"
                          [attr.x]="b.x"
                          [attr.y]="m.margem.topo"
                          [attr.width]="b.largura"
                          [attr.height]="m.alturaUtil"
                        />
                        <rect
                          class="barra__recebido"
                          [attr.x]="b.x"
                          [attr.y]="b.recebido.y"
                          [attr.width]="b.largura"
                          [attr.height]="b.recebido.altura"
                        />
                        <rect
                          class="barra__fiado"
                          [attr.x]="b.x"
                          [attr.y]="b.fiado.y"
                          [attr.width]="b.largura"
                          [attr.height]="b.fiado.altura"
                        />
                        <rect
                          class="barra__foco"
                          [attr.x]="b.x - 2"
                          [attr.y]="m.margem.topo - 2"
                          [attr.width]="b.largura + 4"
                          [attr.height]="m.alturaUtil + 4"
                        />
                        @if (i % passoRotulo() === 0) {
                          <text
                            class="eixo"
                            text-anchor="middle"
                            [attr.x]="b.x + b.largura / 2"
                            [attr.y]="m.yBase + 18"
                          >
                            {{ b.rotuloDia }}
                          </text>
                        }
                      </g>
                    }
                  </g>
                </svg>
              }
            </div>

            <p class="detalhe" aria-live="polite">{{ barraAtiva()?.ariaLabel }}</p>
          </section>

          <h2>Por dia</h2>
          <ul class="cards">
            @for (d of r.porDia; track d.dia) {
              <li class="card">
                <dl>
                  <dt class="card__titulo">{{ d.dia | date: 'dd/MM/yyyy' }}</dt>
                  <dt>Recebido</dt>
                  <dd>{{ d.recebido | cePreco }}</dd>
                  <dt>Fiado gerado</dt>
                  <dd>{{ d.fiadoGerado | cePreco }}</dd>
                  <dt>Total</dt>
                  <dd>{{ d.recebido + d.fiadoGerado | cePreco }}</dd>
                </dl>
              </li>
            }
          </ul>
          <div class="tabela">
            <table>
              <caption>
                Recebido e fiado gerado por dia
              </caption>
              <thead>
                <tr>
                  <th scope="col">Dia</th>
                  <th scope="col" class="num">Recebido</th>
                  <th scope="col" class="num">Fiado gerado</th>
                  <th scope="col" class="num">Total</th>
                </tr>
              </thead>
              <tbody>
                @for (d of r.porDia; track d.dia) {
                  <tr>
                    <th scope="row">{{ d.dia | date: 'dd/MM/yyyy' }}</th>
                    <td class="num">{{ d.recebido | cePreco }}</td>
                    <td class="num">{{ d.fiadoGerado | cePreco }}</td>
                    <td class="num">{{ d.recebido + d.fiadoGerado | cePreco }}</td>
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
    @use 'mixins';

    .conteudo .totais {
      @include mixins.from-tablet {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .grafico {
      display: flex;
      flex-direction: column;
      gap: var(--ce-space-3);
      padding: var(--ce-space-3) var(--ce-space-4);
      border-radius: 20px;
      background: var(--ce-surface);
      color: var(--ce-text);
    }

    .legenda {
      display: flex;
      flex-wrap: wrap;
      gap: var(--ce-space-3);
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: var(--ce-font-sm);

      li {
        display: flex;
        align-items: center;
        gap: var(--ce-space-1);
      }
    }

    .amostra--recebido {
      fill: var(--ce-pago);
    }

    .amostra--fiado {
      fill: url(#ce-listras-fiado);
      stroke: var(--ce-fiado);
      stroke-width: 1;
    }

    .grafico__caixa {
      @include mixins.scroll-x;
    }

    svg {
      display: block;
    }

    .listras__fundo {
      fill: var(--ce-fiado);
    }

    .listras__listra {
      fill: var(--ce-surface);
    }

    .grade {
      stroke: var(--ce-border);
      stroke-width: 1;
    }

    .eixo {
      fill: var(--ce-text-muted);
      font-size: 12px;
      @include mixins.tabular-numbers;
    }

    .barra {
      cursor: pointer;
      outline: none;
    }

    .barra__area {
      fill: transparent;
    }

    .barra--ativa .barra__area {
      fill: var(--ce-surface-muted);
    }

    .barra__recebido {
      fill: var(--ce-pago);
    }

    .barra__fiado {
      fill: url(#ce-listras-fiado);
      stroke: var(--ce-fiado);
      stroke-width: 1;
    }

    .barra__foco {
      fill: none;
      stroke: none;
      stroke-width: 2;
    }

    .barra:focus-visible .barra__foco {
      stroke: var(--ce-focus-ring);
    }

    .detalhe {
      margin: 0;
      padding-top: var(--ce-space-2);
      border-top: 1px solid var(--ce-border);
      font-weight: 600;
      @include mixins.tabular-numbers;
    }

    caption {
      padding: var(--ce-space-2) var(--ce-space-3);
      font-size: var(--ce-font-sm);
      color: var(--ce-text-muted);
      text-align: left;
    }

    tbody th {
      font-size: inherit;
      font-weight: inherit;
      color: var(--ce-text);
    }
  `,
})
export class VendasPorPeriodoPage {
  private readonly store = inject(RelatoriosStore);
  private readonly router = inject(Router);
  private readonly caixa = viewChild<ElementRef<HTMLElement>>('caixa');

  protected readonly estado = this.store.faturamento;
  protected readonly inicio = signal(periodoPadrao().inicio);
  protected readonly fim = signal(periodoPadrao().fim);
  protected readonly ativo = signal(0);
  /** Largura do contêiner do gráfico (não da janela): no desktop ele divide a tela com o hub. */
  private readonly larguraCaixa = signal(0);

  protected readonly erroPeriodo = computed(() =>
    periodoInvertido(this.inicio(), this.fim()) ? MSG_PERIODO_INVERTIDO : null,
  );

  protected readonly modelo = computed(() => {
    const dados = this.estado().dados;
    if (!dados || dados.porDia.length === 0) {
      return null;
    }
    const minimo =
      dados.porDia.length * ESPACO_MINIMO_DIA + MARGEM_PADRAO.esquerda + MARGEM_PADRAO.direita;
    return montarGraficoEmpilhado(dados.porDia, {
      largura: Math.max(this.larguraCaixa() || LARGURA_INICIAL, minimo),
      altura: ALTURA_GRAFICO,
    });
  });

  /** Mostra um rótulo de dia a cada N barras para o dd/mm não se sobrepor. */
  protected readonly passoRotulo = computed(() => {
    const m = this.modelo();
    const espaco = m
      ? (m.largura - m.margem.esquerda - m.margem.direita) / m.barras.length
      : LARGURA_ROTULO_DIA;
    return Math.max(1, Math.ceil(LARGURA_ROTULO_DIA / espaco));
  });

  protected readonly indiceAtivo = computed(() =>
    Math.min(this.ativo(), Math.max(0, (this.modelo()?.barras.length ?? 1) - 1)),
  );
  protected readonly barraAtiva = computed(() => this.modelo()?.barras[this.indiceAtivo()]);

  protected readonly resumo = computed(() => {
    const d = this.estado().dados;
    if (!d) {
      return '';
    }
    const preco = new PrecoPipe();
    return (
      `${d.porDia.length} dias. Recebido ${preco.transform(d.recebido)}, ` +
      `fiado gerado ${preco.transform(d.fiadoGerado)}.`
    );
  });

  constructor() {
    this.buscar();
    effect((limpar) => {
      const el = this.caixa()?.nativeElement;
      if (!el || typeof ResizeObserver === 'undefined') {
        return;
      }
      const observador = new ResizeObserver(([e]) =>
        this.larguraCaixa.set(Math.floor(e.contentRect.width)),
      );
      observador.observe(el);
      limpar(() => observador.disconnect());
    });
  }

  protected buscar(): void {
    if (this.erroPeriodo()) {
      return;
    }
    void this.store.carregarFaturamento(this.inicio(), this.fim());
  }

  protected teclar(evento: KeyboardEvent, indice: number): void {
    if (!TECLAS.includes(evento.key)) {
      return;
    }
    evento.preventDefault();
    const irmas = (evento.currentTarget as Element).parentElement?.children;
    const novo = proximoIndice(indice, evento.key, irmas?.length ?? 0);
    if (novo !== indice) {
      this.ativo.set(novo);
      (irmas?.[novo] as SVGElement).focus();
    }
  }

  protected voltar(): void {
    void this.router.navigateByUrl('/relatorios');
  }
}
