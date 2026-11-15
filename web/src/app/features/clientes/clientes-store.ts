import { Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { Observable, Subscription, firstValueFrom } from 'rxjs';

import { ClientesApi } from '../../core/api/clientes-api';
import { FinanceiroApi } from '../../core/api/financeiro-api';
import { VendasApi } from '../../core/api/vendas-api';
import { SaldoCascoRelatorio, SaldoFiadoCliente } from '../../core/api/models/relatorios';
import { VendaDetalheResponse } from '../../core/api/models/vendas';
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
import { FiltroClientes, montarLinhas } from './clientes-linhas';

type Status = 'idle' | 'loading' | 'ok' | 'error';

interface Relatorio<T> {
  status: Status;
  itens: readonly T[];
}

const PAGE_SIZE = 20;

@Injectable({ providedIn: 'root' })
export class ClientesStore {
  private readonly api = inject(ClientesApi);
  private readonly financeiroApi = inject(FinanceiroApi);
  private readonly vendasApi = inject(VendasApi);

  private readonly clientesInterno = signal<ClienteResponse[]>([]);
  private readonly statusInterno = signal<Status>('idle');
  private readonly temMaisInterno = signal(false);

  private readonly saldosInterno = signal<SaldosResponse | null>(null);
  private readonly statusSaldosInterno = signal<Status>('idle');
  private readonly erroSaldosInterno = signal<string | null>(null);

  private readonly historicoInterno = signal<VendaDetalheResponse[]>([]);
  private readonly statusHistoricoInterno = signal<Status>('idle');

  private readonly filtroInterno = signal<FiltroClientes>('todos');
  private readonly termoInterno = signal('');
  private readonly fiado = signal<Relatorio<SaldoFiadoCliente>>({ status: 'idle', itens: [] });
  private readonly cascos = signal<Relatorio<SaldoCascoRelatorio>>({ status: 'idle', itens: [] });

  private buscaSaldos?: Subscription;
  private buscaHistorico?: Subscription;
  /** Termo da última busca à API (null = lista de 'todos' ainda não carregada neste uso). */
  private nomeCarregado: string | null = null;
  private page = 1;

  readonly filtro = this.filtroInterno.asReadonly();
  readonly termo = this.termoInterno.asReadonly();
  /** Linhas do chip atual: lista paginada em 'todos', relatório filtrado no front nos demais. */
  readonly linhas = computed(() =>
    montarLinhas(
      this.filtroInterno(),
      this.clientesInterno(),
      this.fiado().itens,
      this.cascos().itens,
      this.termoInterno(),
    ),
  );
  readonly statusLista = computed<Status>(() => {
    const f = this.filtroInterno();
    return f === 'todos'
      ? this.statusInterno()
      : (f === 'fiado' ? this.fiado() : this.cascos()).status;
  });
  readonly temMaisLista = computed(() => this.filtroInterno() === 'todos' && this.temMaisInterno());

  readonly clientes = this.clientesInterno.asReadonly();
  readonly status = this.statusInterno.asReadonly();
  readonly temMais = this.temMaisInterno.asReadonly();
  readonly saldos = this.saldosInterno.asReadonly();
  readonly statusSaldos = this.statusSaldosInterno.asReadonly();
  readonly erroSaldos = this.erroSaldosInterno.asReadonly();
  readonly historico = this.historicoInterno.asReadonly();
  readonly statusHistorico = this.statusHistoricoInterno.asReadonly();

  /**
   * Abre a lista no chip dado e carrega os dois relatórios (selos das linhas) uma vez.
   * Em 'fiado'/'casco' a lista de clientes só é buscada se o chip voltar a 'todos'.
   */
  abrir(filtro: FiltroClientes): void {
    this.termoInterno.set('');
    this.nomeCarregado = null;
    this.filtroInterno.set(filtro);
    this.carregarRelatorio(this.fiado, this.financeiroApi.relatorioFiado());
    this.carregarRelatorio(this.cascos, this.api.relatorioCascos());
    if (filtro === 'todos') {
      this.buscarTodos();
    }
  }

  /** Troca o chip sem refazer carga que já existe; mesmo valor não faz nada. */
  definirFiltro(filtro: FiltroClientes): void {
    if (filtro === this.filtroInterno()) {
      return;
    }
    this.filtroInterno.set(filtro);
    if (filtro === 'todos') {
      if (this.nomeCarregado !== this.termoInterno()) {
        this.buscarTodos();
      }
    } else if ((filtro === 'fiado' ? this.fiado() : this.cascos()).status === 'idle') {
      this.recarregar();
    }
  }

  /** "Tentar novamente" da lista: refaz a carga do chip atual. */
  recarregar(): void {
    const f = this.filtroInterno();
    if (f === 'fiado') {
      this.carregarRelatorio(this.fiado, this.financeiroApi.relatorioFiado());
    } else if (f === 'casco') {
      this.carregarRelatorio(this.cascos, this.api.relatorioCascos());
    } else {
      this.buscarTodos();
    }
  }

  buscar(nome: string): void {
    this.termoInterno.set(nome);
    if (this.filtroInterno() === 'todos') {
      this.buscarTodos();
    }
  }

  // Relatório com falha: a lista segue sem os selos dele (sem tela de erro, a menos que seja o chip atual).
  private carregarRelatorio<T>(alvo: WritableSignal<Relatorio<T>>, fonte: Observable<T[]>): void {
    alvo.update((r) => ({ ...r, status: 'loading' }));
    fonte.subscribe({
      next: (itens) => alvo.set({ status: 'ok', itens }),
      error: () => alvo.update((r) => ({ ...r, status: 'error' })),
    });
  }

  private buscarTodos(): void {
    const nome = this.termoInterno();
    this.nomeCarregado = nome;
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
    this.api.listar(this.termoInterno(), this.page, PAGE_SIZE).subscribe({
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
    this.nomeCarregado = null;
    this.buscar(this.termoInterno());
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

  /** Últimas vendas do cliente. Zera e cancela a busca anterior (mesmo motivo dos saldos). */
  carregarHistorico(clienteId: string): void {
    this.buscaHistorico?.unsubscribe();
    this.historicoInterno.set([]);
    this.statusHistoricoInterno.set('loading');
    this.buscaHistorico = this.vendasApi.listar({ clienteId, page: 1, pageSize: 10 }).subscribe({
      next: (vendas) => {
        this.historicoInterno.set(vendas);
        this.statusHistoricoInterno.set('ok');
      },
      error: () => this.statusHistoricoInterno.set('error'),
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
