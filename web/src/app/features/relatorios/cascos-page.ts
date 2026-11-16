import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { EmptyState } from '../../ui/molecules/empty-state';
import { AppHeader } from '../../ui/organisms/app-header';
import { EstadoRelatorio } from './estado-relatorio';
import { RelatoriosStore } from './relatorios-store';

/** Casco é contagem: nunca vira dinheiro nem se soma com sucata (§8 regras 1 e 7). */
@Component({
  selector: 'ce-cascos-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeader, EmptyState, EstadoRelatorio],
  styleUrl: './relatorio.scss',
  template: `
    <ce-app-header titulo="Cascos" [mostrarVoltar]="true" (voltar)="voltar()" />

    <div class="conteudo">
      <ce-estado-relatorio
        [carregando]="estado().carregando"
        [erro]="estado().erro"
        [temDados]="!!estado().dados"
        (recarregar)="carregar()"
      />
      @if (estado().dados; as linhas) {
        @if (linhas.length === 0) {
          <ce-empty-state icone="alerta" titulo="Nenhum cliente com saldo de cascos" />
        } @else {
          <ul class="cards">
            @for (c of linhas; track c.clienteId) {
              <li class="card">
                <dl>
                  <dt class="card__titulo">{{ c.nome }}</dt>
                  <dt>Saldo de cascos</dt>
                  <dd>
                    {{ c.saldoCascos }}
                    @if (c.cascosAFavor) {
                      + {{ c.cascosAFavor }} a favor
                    }
                  </dd>
                </dl>
              </li>
            }
          </ul>
          <div class="tabela">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th class="num">Saldo de cascos</th>
                </tr>
              </thead>
              <tbody>
                @for (c of linhas; track c.clienteId) {
                  <tr>
                    <td>{{ c.nome }}</td>
                    <td class="num">
                      {{ c.saldoCascos }}
                      @if (c.cascosAFavor) {
                        + {{ c.cascosAFavor }} a favor
                      }
                    </td>
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
export class CascosPage {
  private readonly store = inject(RelatoriosStore);
  private readonly router = inject(Router);

  protected readonly estado = this.store.cascos;

  constructor() {
    this.carregar();
  }

  protected carregar(): void {
    void this.store.carregarCascos();
  }

  protected voltar(): void {
    void this.router.navigateByUrl('/relatorios');
  }
}
