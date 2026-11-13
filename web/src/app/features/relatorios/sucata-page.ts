import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { EmptyState } from '../../ui/molecules/empty-state';
import { AppHeader } from '../../ui/organisms/app-header';
import { EstadoRelatorio } from './estado-relatorio';
import { RelatoriosStore } from './relatorios-store';

/** Sucata é contagem, separada de cascos e nunca somada a eles (§8 regra 1). */
@Component({
  selector: 'ce-sucata-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeader, EmptyState, EstadoRelatorio],
  styleUrl: './relatorio.scss',
  template: `
    <ce-app-header titulo="Sucata" [mostrarVoltar]="true" (voltar)="voltar()" />

    <div class="conteudo">
      <ce-estado-relatorio
        [carregando]="estado().carregando"
        [erro]="estado().erro"
        [temDados]="!!estado().dados"
        (recarregar)="carregar()"
      />
      @if (estado().dados; as linhas) {
        @if (linhas.length === 0) {
          <ce-empty-state icone="alerta" titulo="Nenhuma sucata entregue" />
        } @else {
          <ul class="cards">
            @for (c of linhas; track c.clienteId) {
              <li class="card">
                <dl>
                  <dt class="card__titulo">{{ c.nome }}</dt>
                  <dt>Sucata entregue</dt>
                  <dd>{{ c.totalEntregue }}</dd>
                </dl>
              </li>
            }
          </ul>
          <div class="tabela">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th class="num">Sucata entregue</th>
                </tr>
              </thead>
              <tbody>
                @for (c of linhas; track c.clienteId) {
                  <tr>
                    <td>{{ c.nome }}</td>
                    <td class="num">{{ c.totalEntregue }}</td>
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
export class SucataPage {
  private readonly store = inject(RelatoriosStore);
  private readonly router = inject(Router);

  protected readonly estado = this.store.sucata;

  constructor() {
    this.carregar();
  }

  protected carregar(): void {
    void this.store.carregarSucata();
  }

  protected voltar(): void {
    void this.router.navigateByUrl('/relatorios');
  }
}
