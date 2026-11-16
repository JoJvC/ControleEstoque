import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, Subscription, firstValueFrom } from 'rxjs';

import { ClientesApi } from '../../core/api/clientes-api';
import { PedidosApi } from '../../core/api/pedidos-api';
import { ClienteResponse } from '../../core/api/models/clientes';
import {
  CriarPedidoRequest,
  PedidoResponse,
  PedidoResumoResponse,
  StatusPedido,
} from '../../core/api/models/pedidos';
import { ApiError } from '../../core/http/api-error';
import { OperatorStore } from '../../core/operator/operator-store';

type Status = 'idle' | 'loading' | 'ok' | 'error';

const NOME_PADRAO = 'Cliente';

@Injectable({ providedIn: 'root' })
export class PedidosStore {
  private readonly api = inject(PedidosApi);
  private readonly clientesApi = inject(ClientesApi);
  private readonly operador = inject(OperatorStore);

  private readonly pedidosInterno = signal<PedidoResumoResponse[]>([]);
  private readonly statusListaInterno = signal<Status>('idle');
  private readonly filtroInterno = signal<StatusPedido | null>(null);

  private readonly pedidoInterno = signal<PedidoResponse | null>(null);
  private readonly statusPedidoInterno = signal<Status>('idle');
  private readonly erroPedidoInterno = signal<string | null>(null);
  private readonly clienteInterno = signal<ClienteResponse | null>(null);

  /** Cache id → nome; 'Cliente' quando a busca falha. Ausente = ainda carregando. */
  private readonly nomesInterno = signal<Readonly<Record<string, string>>>({});
  private readonly nomesPedidos = new Set<string>();

  private buscaLista?: Subscription;
  private buscaPedido?: Subscription;

  readonly pedidos = this.pedidosInterno.asReadonly();
  readonly statusLista = this.statusListaInterno.asReadonly();
  readonly filtro = this.filtroInterno.asReadonly();
  readonly pedido = this.pedidoInterno.asReadonly();
  readonly statusPedido = this.statusPedidoInterno.asReadonly();
  readonly erroPedido = this.erroPedidoInterno.asReadonly();
  readonly cliente = this.clienteInterno.asReadonly();
  readonly nomes = this.nomesInterno.asReadonly();
  /** Só a primeira página (50): o backend não devolve total. */
  readonly linhas = computed(() =>
    this.pedidosInterno().map((p) => ({
      ...p,
      clienteNome: this.nomesInterno()[p.clienteId] ?? null,
    })),
  );

  filtrar(status: StatusPedido | null): void {
    this.filtroInterno.set(status);
    this.carregarLista();
  }

  /** Recarrega a lista no filtro atual; cancela a busca anterior para a resposta atrasada não sobrescrever. */
  carregarLista(): void {
    this.buscaLista?.unsubscribe();
    this.statusListaInterno.set('loading');
    this.buscaLista = this.api.listar(this.filtroInterno()).subscribe({
      next: (pedidos) => {
        this.pedidosInterno.set(pedidos);
        this.statusListaInterno.set('ok');
        pedidos.forEach((p) => this.resolverNome(p.clienteId));
      },
      error: () => this.statusListaInterno.set('error'),
    });
  }

  /** Zera antes de buscar (a store é root: não pode mostrar o pedido anterior). */
  carregar(id: string): void {
    this.buscaPedido?.unsubscribe();
    this.pedidoInterno.set(null);
    this.clienteInterno.set(null);
    this.erroPedidoInterno.set(null);
    this.statusPedidoInterno.set('loading');
    this.buscaPedido = this.api.obter(id).subscribe({
      next: (pedido) => {
        this.pedidoInterno.set(pedido);
        this.statusPedidoInterno.set('ok');
        this.carregarCliente(pedido.clienteId);
      },
      error: (e: unknown) => {
        // Rede/5xx já viraram toast no interceptor: inline só 4xx.
        this.erroPedidoInterno.set(
          e instanceof ApiError && e.status < 500 && e.status > 0 ? e.userMessage : null,
        );
        this.statusPedidoInterno.set('error');
      },
    });
  }

  // As escritas lançam ApiError — a página/sheet trata.
  criar(request: CriarPedidoRequest): Promise<PedidoResponse> {
    return firstValueFrom(this.api.criar(request));
  }

  iniciar(id: string, funcionariosIds: readonly string[]): Promise<PedidoResponse> {
    return this.mudar(id, () =>
      this.api.iniciar(id, {
        funcionarioId: this.funcionarioId(),
        funcionariosIds: [...funcionariosIds],
      }),
    );
  }

  cancelar(id: string): Promise<PedidoResponse> {
    return this.mudar(id, () => this.api.cancelar(id, { funcionarioId: this.funcionarioId() }));
  }

  /** Atualiza pedido aberto e lista; em PEDIDO_STATUS_INVALIDO recarrega o pedido e relança. */
  private async mudar(
    id: string,
    chamar: () => Observable<PedidoResponse>,
  ): Promise<PedidoResponse> {
    try {
      const pedido = await firstValueFrom(chamar());
      this.pedidoInterno.set(pedido);
      this.pedidosInterno.update((lista) =>
        lista.map((p) => (p.id === id ? { ...p, status: pedido.status } : p)),
      );
      return pedido;
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PEDIDO_STATUS_INVALIDO') {
        this.carregar(id);
      }
      throw e;
    }
  }

  private funcionarioId(): string {
    const operador = this.operador.operator();
    if (!operador) {
      throw new Error('Nenhum operador selecionado.');
    }
    return operador.id;
  }

  private carregarCliente(clienteId: string): void {
    this.clientesApi.obter(clienteId).subscribe({
      next: (cliente) => {
        if (this.pedidoInterno()?.clienteId === clienteId) {
          this.clienteInterno.set(cliente);
        }
        this.guardarNome(clienteId, cliente.nome);
      },
      error: () => this.guardarNome(clienteId, NOME_PADRAO),
    });
  }

  private resolverNome(clienteId: string): void {
    if (this.nomesPedidos.has(clienteId)) {
      return;
    }
    this.nomesPedidos.add(clienteId);
    this.clientesApi.obter(clienteId).subscribe({
      next: (cliente) => this.guardarNome(clienteId, cliente.nome),
      error: () => this.guardarNome(clienteId, NOME_PADRAO),
    });
  }

  private guardarNome(clienteId: string, nome: string): void {
    this.nomesPedidos.add(clienteId);
    this.nomesInterno.update((atual) => ({ ...atual, [clienteId]: nome }));
  }
}
