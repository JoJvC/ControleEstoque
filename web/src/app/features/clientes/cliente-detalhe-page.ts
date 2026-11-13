import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ClientesApi } from '../../core/api/clientes-api';
import {
  ClienteResponse,
  ConversaoCascosResponse,
  DevolucaoCascosResponse,
  EntregaSucataResponse,
} from '../../core/api/models/clientes';
import { PagamentoFiadoResponse } from '../../core/api/models/financeiro';
import { SheetService } from '../../core/overlay/sheet-service';
import { CePermissao } from '../../core/permissions/ce-permissao';
import { ToastService } from '../../core/toast/toast-service';
import { Button } from '../../ui/atoms/button';
import { Icon } from '../../ui/atoms/icon';
import { Spinner } from '../../ui/atoms/spinner';
import { EmptyState } from '../../ui/molecules/empty-state';
import { SaldoChip } from '../../ui/molecules/saldo-chip';
import { AppHeader } from '../../ui/organisms/app-header';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { ClientesStore } from './clientes-store';
import { EnderecoSheet, EnderecoSheetDados } from './endereco-sheet';
import { EntregarSucataSheet, EntregarSucataSheetDados } from './entregar-sucata-sheet';
import { PagarCascoSheet, PagarCascoSheetDados } from './pagar-casco-sheet';
import { ReceberFiadoSheet, ReceberFiadoSheetDados } from './receber-fiado-sheet';

const preco = new PrecoPipe();

@Component({
  selector: 'ce-cliente-detalhe-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CePermissao, AppHeader, Button, Icon, Spinner, EmptyState, SaldoChip, PrecoPipe],
  templateUrl: './cliente-detalhe-page.html',
  styleUrl: './cliente-detalhe-page.scss',
})
export class ClienteDetalhePage {
  /** Route param (:id). */
  readonly id = input.required<string>();

  private readonly api = inject(ClientesApi);
  private readonly sheet = inject(SheetService);
  private readonly router = inject(Router);
  private readonly store = inject(ClientesStore);
  private readonly toast = inject(ToastService);

  protected readonly saldos = this.store.saldos;
  protected readonly statusSaldos = this.store.statusSaldos;
  protected readonly erroSaldos = this.store.erroSaldos;

  protected readonly cliente = signal<ClienteResponse | null>(null);
  protected readonly carregando = signal(true);

  constructor() {
    queueMicrotask(() => {
      this.carregar();
      this.carregarSaldos();
    });
  }

  protected carregar(): void {
    this.carregando.set(true);
    this.api.obter(this.id()).subscribe({
      next: (cliente) => {
        this.cliente.set(cliente);
        this.carregando.set(false);
      },
      error: () => this.carregando.set(false),
    });
  }

  protected async novoEndereco(): Promise<void> {
    const ref = this.sheet.abrir<unknown, EnderecoSheetDados>(EnderecoSheet, {
      clienteId: this.id(),
    });
    const criado = await firstValueFrom(ref.closed);
    if (criado) {
      this.carregar();
    }
  }

  protected carregarSaldos(): void {
    this.store.carregarSaldos(this.id());
  }

  protected async pagarCasco(): Promise<void> {
    const ref = this.sheet.abrir<
      DevolucaoCascosResponse | ConversaoCascosResponse,
      PagarCascoSheetDados
    >(PagarCascoSheet, { clienteId: this.id() });
    const resposta = await firstValueFrom(ref.closed);
    if (!resposta) {
      return;
    }
    if ('novoSaldoFiado' in resposta) {
      this.toast.success(
        `Conversão registrada. Saldo de cascos: ${resposta.novoSaldoCascos}. Fiado: ${preco.transform(resposta.novoSaldoFiado)}.`,
      );
    } else {
      this.toast.success(`Devolução registrada. Saldo de cascos: ${resposta.novoSaldoCascos}.`);
    }
    this.carregarSaldos();
  }

  protected async entregarSucata(): Promise<void> {
    const ref = this.sheet.abrir<EntregaSucataResponse, EntregarSucataSheetDados>(
      EntregarSucataSheet,
      { clienteId: this.id() },
    );
    const resposta = await firstValueFrom(ref.closed);
    if (!resposta) {
      return;
    }
    this.toast.success(
      `Sucata registrada. Total entregue: ${resposta.totalSucataEntregue}. Fiado: ${preco.transform(resposta.novoSaldoFiado)}.`,
    );
    this.carregarSaldos();
  }

  protected async receberFiado(): Promise<void> {
    const ref = this.sheet.abrir<PagamentoFiadoResponse, ReceberFiadoSheetDados>(
      ReceberFiadoSheet,
      { clienteId: this.id() },
    );
    const resposta = await firstValueFrom(ref.closed);
    if (!resposta) {
      return;
    }
    this.toast.success(`Pagamento registrado. Fiado: ${preco.transform(resposta.novoSaldoFiado)}.`);
    this.carregarSaldos();
  }

  protected editar(): void {
    this.router.navigateByUrl(`/clientes/${this.id()}/editar`);
  }

  protected voltar(): void {
    this.router.navigateByUrl('/clientes');
  }
}
