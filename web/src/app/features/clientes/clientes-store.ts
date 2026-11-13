import { Injectable, inject, signal } from '@angular/core';
import { Subscription, firstValueFrom } from 'rxjs';

import { ClientesApi } from '../../core/api/clientes-api';
import { FinanceiroApi } from '../../core/api/financeiro-api';
import {
  ClienteResponse,
  ConversaoCascosResponse,
  CreateClienteRequest,
  DevolucaoCascosResponse,
  EntregaSucataResponse,
  SaldosResponse,
} from '../../core/api/models/clientes';
import { PagamentoFiadoResponse } from '../../core/api/models/financeiro';
import { ApiError } from '../../core/http/api-error';

type Status = 'idle' | 'loading' | 'ok' | 'error';

const PAGE_SIZE = 20;

@Injectable({ providedIn: 'root' })
export class ClientesStore {
  private readonly api = inject(ClientesApi);
  private readonly financeiroApi = inject(FinanceiroApi);

  private readonly clientesInterno = signal<ClienteResponse[]>([]);
  private readonly statusInterno = signal<Status>('idle');
  private readonly temMaisInterno = signal(false);

  private readonly saldosInterno = signal<SaldosResponse | null>(null);
  private readonly statusSaldosInterno = signal<Status>('idle');
  private readonly erroSaldosInterno = signal<string | null>(null);

  private buscaSaldos?: Subscription;
  private nome = '';
  private page = 1;

  readonly clientes = this.clientesInterno.asReadonly();
  readonly status = this.statusInterno.asReadonly();
  readonly temMais = this.temMaisInterno.asReadonly();
  readonly saldos = this.saldosInterno.asReadonly();
  readonly statusSaldos = this.statusSaldosInterno.asReadonly();
  readonly erroSaldos = this.erroSaldosInterno.asReadonly();

  buscar(nome: string): void {
    this.nome = nome;
    this.page = 1;
    this.statusInterno.set('loading');
    this.api.listar(nome, 1, PAGE_SIZE).subscribe({
      next: (clientes) => {
        this.clientesInterno.set(clientes);
        this.temMaisInterno.set(clientes.length === PAGE_SIZE);
        this.statusInterno.set('ok');
      },
      error: () => this.statusInterno.set('error'),
    });
  }

  carregarMais(): void {
    this.page += 1;
    this.api.listar(this.nome, this.page, PAGE_SIZE).subscribe({
      next: (clientes) => {
        this.clientesInterno.update((atual) => [...atual, ...clientes]);
        this.temMaisInterno.set(clientes.length === PAGE_SIZE);
      },
      error: () => this.temMaisInterno.set(false),
    });
  }

  /** Lança ApiError — a página trata. */
  async salvar(request: CreateClienteRequest, id: string | null): Promise<ClienteResponse> {
    const cliente =
      id === null
        ? await firstValueFrom(this.api.criar(request))
        : await firstValueFrom(this.api.atualizar(id, request));
    this.buscar(this.nome);
    return cliente;
  }

  /**
   * Zera antes de buscar (a store é root e não pode mostrar o saldo de outro cliente)
   * e cancela a busca anterior, para uma resposta atrasada não sobrescrever a atual.
   */
  carregarSaldos(clienteId: string): void {
    this.buscaSaldos?.unsubscribe();
    this.saldosInterno.set(null);
    this.erroSaldosInterno.set(null);
    this.statusSaldosInterno.set('loading');
    this.buscaSaldos = this.api.obterSaldos(clienteId).subscribe({
      next: (saldos) => {
        this.saldosInterno.set(saldos);
        this.statusSaldosInterno.set('ok');
      },
      error: (e: unknown) => {
        // Rede/5xx já viraram toast no interceptor: inline só 4xx.
        this.erroSaldosInterno.set(
          e instanceof ApiError && e.status < 500 && e.status > 0 ? e.userMessage : null,
        );
        this.statusSaldosInterno.set('error');
      },
    });
  }

  // As escritas lançam ApiError — a sheet trata. O saldo vem sempre do GET /saldos.
  devolverCascos(id: string, quantidade: number): Promise<DevolucaoCascosResponse> {
    return firstValueFrom(this.api.devolverCascos(id, { quantidade }));
  }

  converterCascos(
    id: string,
    quantidade: number,
    valorUnitario: number,
  ): Promise<ConversaoCascosResponse> {
    return firstValueFrom(this.api.converterCascos(id, { quantidade, valorUnitario }));
  }

  entregarSucata(
    id: string,
    quantidade: number,
    valorConversao: number | null,
  ): Promise<EntregaSucataResponse> {
    return firstValueFrom(this.api.entregarSucata(id, { quantidade, valorConversao }));
  }

  pagarFiado(id: string, valor: number, forma: string | null): Promise<PagamentoFiadoResponse> {
    return firstValueFrom(this.financeiroApi.pagarFiado(id, { valor, forma }));
  }
}
