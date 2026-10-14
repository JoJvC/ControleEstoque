import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ClientesApi } from '../../core/api/clientes-api';
import { ClienteResponse, CreateClienteRequest } from '../../core/api/models/clientes';

type Status = 'idle' | 'loading' | 'ok' | 'error';

const PAGE_SIZE = 20;

@Injectable({ providedIn: 'root' })
export class ClientesStore {
  private readonly api = inject(ClientesApi);

  private readonly clientesInterno = signal<ClienteResponse[]>([]);
  private readonly statusInterno = signal<Status>('idle');
  private readonly temMaisInterno = signal(false);

  private nome = '';
  private page = 1;

  readonly clientes = this.clientesInterno.asReadonly();
  readonly status = this.statusInterno.asReadonly();
  readonly temMais = this.temMaisInterno.asReadonly();

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
}
