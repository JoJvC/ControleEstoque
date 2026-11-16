import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { rotuloDaMarca } from '../../core/api/produto-leitura';
import { EmptyState } from '../../ui/molecules/empty-state';
import { AppHeader } from '../../ui/organisms/app-header';
import { cascosComSaldo, nomeComTamanho } from '../estoque/estoque-grupos';
import { EstadoRelatorio } from './estado-relatorio';
import { RelatoriosStore } from './relatorios-store';

/** O alerta é o `abaixoMinimo` do servidor; o front não compara quantidade com mínimo (§8 regra 6). */
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
            @for (c of rel.itens; track c.produtoMarcaId) {
              <li class="card" [class.abaixo-minimo]="c.abaixoMinimo">
                <dl>
                  <dt class="card__titulo">{{ nomeDe(c) }} — {{ rotulo(c.marca) }}</dt>
                  <dt>Quantidade</dt>
                  <dd>{{ c.quantidade }}</dd>
                  <dt>Estoque mínimo</dt>
                  <dd>{{ c.estoqueMinimo }}</dd>
                  <dt>Alerta</dt>
                  <dd>{{ c.abaixoMinimo ? 'Abaixo do mínimo' : 'Ok' }}</dd>
                  <dt>Estoque geral</dt>
                  <dd>{{ geral(c.produtoId) }}</dd>
                </dl>
              </li>
            }
          </ul>
          <div class="tabela">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Marca</th>
                  <th class="num">Quantidade</th>
                  <th class="num">Estoque mínimo</th>
                  <th>Alerta</th>
                  <th class="num">Estoque geral</th>
                </tr>
              </thead>
              <tbody>
                @for (c of rel.itens; track c.produtoMarcaId) {
                  <tr [class.abaixo-minimo]="c.abaixoMinimo">
                    <td>{{ nomeDe(c) }}</td>
                    <td>{{ rotulo(c.marca) }}</td>
                    <td class="num">{{ c.quantidade }}</td>
                    <td class="num">{{ c.estoqueMinimo }}</td>
                    <td>{{ c.abaixoMinimo ? 'Abaixo do mínimo' : 'Ok' }}</td>
                    <td class="num">{{ geral(c.produtoId) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        <section aria-labelledby="rel-vasilhames">
          <h2 id="rel-vasilhames">Vasilhames por tipo</h2>
          @if (vasilhames().length === 0) {
            <ce-empty-state icone="galao" titulo="Nenhum vasilhame em estoque" />
          } @else {
            <ul class="cards">
              @for (v of vasilhames(); track v.tipoCascoId) {
                <li class="card">
                  <dl>
                    <dt class="card__titulo">{{ v.nome }}</dt>
                    <dt>Vazios</dt>
                    <dd>{{ v.vazios }}</dd>
                    <dt>Sucata</dt>
                    <dd>{{ v.sucata }}</dd>
                  </dl>
                </li>
              }
            </ul>
            <div class="tabela">
              <table>
                <thead>
                  <tr>
                    <th>Tipo de casco</th>
                    <th class="num">Vazios</th>
                    <th class="num">Sucata</th>
                  </tr>
                </thead>
                <tbody>
                  @for (v of vasilhames(); track v.tipoCascoId) {
                    <tr>
                      <td>{{ v.nome }}</td>
                      <td class="num">{{ v.vazios }}</td>
                      <td class="num">{{ v.sucata }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
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

  protected readonly vasilhames = computed(() => cascosComSaldo(this.estado().dados?.cascos ?? []));
  private readonly estoqueGeral = computed(
    () => new Map((this.estado().dados?.produtos ?? []).map((p) => [p.id, p.estoqueGeral])),
  );

  /** Estoque geral do produto, como o servidor somou. */
  protected geral(produtoId: string): number | string {
    return this.estoqueGeral().get(produtoId) ?? '—';
  }

  protected nomeDe(c: { nome: string; tamanho: string | null }): string {
    return nomeComTamanho(c.nome, c.tamanho);
  }

  protected rotulo(marca: string | null): string {
    return marca ? rotuloDaMarca(marca) : 'sem marca';
  }

  protected carregar(): void {
    void this.store.carregarEstoque();
  }

  protected voltar(): void {
    void this.router.navigateByUrl('/relatorios');
  }
}
