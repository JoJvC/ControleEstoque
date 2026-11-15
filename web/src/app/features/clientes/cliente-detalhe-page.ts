import { BreakpointObserver } from '@angular/cdk/layout';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subscription, firstValueFrom, map } from 'rxjs';

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
import { AppHeader } from '../../ui/organisms/app-header';
import { BarraAcao } from '../../ui/organisms/barra-acao';
import { PrecoPipe } from '../../ui/pipes/preco-pipe';
import { FiltroClientes, urlLista } from './clientes-linhas';
import { ClientesStore } from './clientes-store';
import { rotuloStatusPagamento } from '../vendas/venda-rotulos';
import { galoesVisiveis } from './galoes-visiveis';
import { EnderecoSheet, EnderecoSheetDados } from './endereco-sheet';
import { EntregarSucataSheet, EntregarSucataSheetDados } from './entregar-sucata-sheet';
import { PagarCascoSheet, PagarCascoSheetDados } from './pagar-casco-sheet';
import { ReceberFiadoSheet, ReceberFiadoSheetDados } from './receber-fiado-sheet';

const preco = new PrecoPipe();
const MAX_GALOES = 10;

@Component({
  selector: 'ce-cliente-detalhe-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CePermissao,
    AppHeader,
    Button,
    Icon,
    Spinner,
    EmptyState,
    BarraAcao,
    DatePipe,
    PrecoPipe,
  ],
  templateUrl: './cliente-detalhe-page.html',
  styleUrl: './cliente-detalhe-page.scss',
})
export class ClienteDetalhePage {
  /** Route param (:id). */
  readonly id = input.required<string>();
  /** Chip da lista de onde o cliente foi aberto: o Voltar devolve a lista com ele. */
  readonly filtro = input<FiltroClientes>('todos');

  private readonly api = inject(ClientesApi);
  private readonly sheet = inject(SheetService);
  private readonly router = inject(Router);
  private readonly store = inject(ClientesStore);
  private readonly toast = inject(ToastService);
  private readonly breakpoints = inject(BreakpointObserver);

  // A partir de 960 px o detalhe vive ao lado da lista: sem voltar, sem barra fixa, Vender no cabeçalho.
  protected readonly desktop = toSignal(
    this.breakpoints.observe('(min-width: 960px)').pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  protected readonly saldos = this.store.saldos;
  protected readonly statusSaldos = this.store.statusSaldos;
  protected readonly erroSaldos = this.store.erroSaldos;

  protected readonly rotuloStatusPagamento = rotuloStatusPagamento;
  protected readonly historico = this.store.historico;
  protected readonly statusHistorico = this.store.statusHistorico;

  protected readonly cliente = signal<ClienteResponse | null>(null);
  protected readonly carregando = signal(true);

  private busca?: Subscription;

  constructor() {
    // No mestre-detalhe o mesmo componente troca de :id: recarrega tudo a cada id.
    effect(() => {
      this.id();
      untracked(() => {
        this.carregar();
        this.carregarSaldos();
        this.carregarHistorico();
      });
    });
  }

  protected carregar(): void {
    this.busca?.unsubscribe();
    this.carregando.set(true);
    this.busca = this.api.obter(this.id()).subscribe({
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

  protected carregarHistorico(): void {
    this.store.carregarHistorico(this.id());
  }

  protected galoes(saldo: number) {
    return galoesVisiveis(saldo, MAX_GALOES);
  }

  protected galoesIdx(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  protected abrirVenda(id: string): void {
    this.router.navigateByUrl(`/vendas/detalhe/${id}`);
  }

  protected vender(): void {
    this.router.navigate(['/vendas/nova'], { queryParams: { cliente: this.id() } });
  }

  protected repetir(): void {
    this.router.navigate(['/vendas/nova'], {
      queryParams: { cliente: this.id(), repetirUltima: '1' },
    });
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
    this.carregarHistorico();
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
    this.carregarHistorico();
  }

  protected editar(): void {
    this.router.navigateByUrl(`/clientes/${this.id()}/editar`);
  }

  protected voltar(): void {
    this.router.navigateByUrl(urlLista(null, this.filtro()));
  }
}
