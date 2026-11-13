import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { EmptyState } from '../../ui/molecules/empty-state';
import { AppHeader } from '../../ui/organisms/app-header';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { EstadoRelatorio } from './estado-relatorio';
import { RelatoriosStore } from './relatorios-store';

/** Saldo a pagar vem pronto do servidor (§8 regra 6). */
@Component({
  selector: 'ce-conta-funcionarios-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeader, EmptyState, EstadoRelatorio, PrecoPipe],
  styleUrl: './relatorio.scss',
  template: `
    <ce-app-header titulo="Conta de funcionários" [mostrarVoltar]="true" (voltar)="voltar()" />

    <div class="conteudo">
      <ce-estado-relatorio
        [carregando]="estado().carregando"
        [erro]="estado().erro"
        [temDados]="!!estado().dados"
        (recarregar)="carregar()"
      />
      @if (estado().dados; as linhas) {
        @if (linhas.length === 0) {
          <ce-empty-state icone="alerta" titulo="Nenhum funcionário com saldo" />
        } @else {
          <ul class="cards">
            @for (c of linhas; track c.funcionarioId) {
              <li class="card">
                <dl>
                  <dt class="card__titulo">{{ c.nome }}</dt>
                  <dt>Saldo a pagar</dt>
                  <dd>{{ c.saldoAPagar | cePreco }}</dd>
                </dl>
              </li>
            }
          </ul>
          <div class="tabela">
            <table>
              <thead>
                <tr>
                  <th>Funcionário</th>
                  <th class="num">Saldo a pagar</th>
                </tr>
              </thead>
              <tbody>
                @for (c of linhas; track c.funcionarioId) {
                  <tr>
                    <td>{{ c.nome }}</td>
                    <td class="num">{{ c.saldoAPagar | cePreco }}</td>
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
export class ContaFuncionariosPage {
  private readonly store = inject(RelatoriosStore);
  private readonly router = inject(Router);

  protected readonly estado = this.store.contaFuncionarios;

  constructor() {
    this.carregar();
  }

  protected carregar(): void {
    void this.store.carregarContaFuncionarios();
  }

  protected voltar(): void {
    void this.router.navigateByUrl('/relatorios');
  }
}
