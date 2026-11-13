import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { EmptyState } from '../../ui/molecules/empty-state';
import { AppHeader } from '../../ui/organisms/app-header';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { EstadoRelatorio } from './estado-relatorio';
import { RelatoriosStore } from './relatorios-store';

/** Fiado é dinheiro: nunca se soma nem se mistura com casco (§8 regra 7). */
@Component({
  selector: 'ce-fiado-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppHeader, EmptyState, EstadoRelatorio, PrecoPipe],
  styleUrl: './relatorio.scss',
  template: `
    <ce-app-header titulo="Fiado" [mostrarVoltar]="true" (voltar)="voltar()" />

    <div class="conteudo">
      <ce-estado-relatorio
        [carregando]="estado().carregando"
        [erro]="estado().erro"
        [temDados]="!!estado().dados"
        (recarregar)="carregar()"
      />
      @if (estado().dados; as linhas) {
        @if (linhas.length === 0) {
          <ce-empty-state icone="alerta" titulo="Nenhum cliente com fiado em aberto" />
        } @else {
          <ul class="cards">
            @for (c of linhas; track c.clienteId) {
              <li class="card">
                <dl>
                  <dt class="card__titulo">{{ c.nome }}</dt>
                  <dt>Saldo devedor</dt>
                  <dd>{{ c.saldoDevedor | cePreco }}</dd>
                </dl>
              </li>
            }
          </ul>
          <div class="tabela">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th class="num">Saldo devedor</th>
                </tr>
              </thead>
              <tbody>
                @for (c of linhas; track c.clienteId) {
                  <tr>
                    <td>{{ c.nome }}</td>
                    <td class="num">{{ c.saldoDevedor | cePreco }}</td>
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
export class FiadoPage {
  private readonly store = inject(RelatoriosStore);
  private readonly router = inject(Router);

  protected readonly estado = this.store.fiado;

  constructor() {
    this.carregar();
  }

  protected carregar(): void {
    void this.store.carregarFiado();
  }

  protected voltar(): void {
    void this.router.navigateByUrl('/relatorios');
  }
}
