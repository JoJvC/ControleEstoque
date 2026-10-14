import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { VendaFiltros, VendasApi } from '../../core/api/vendas-api';
import {
  AddPagamentoRequest,
  CreateVendaRequest,
  CupomFiscalResponse,
  VendaDetalheResponse,
  VendaResponse,
} from '../../core/api/models/vendas';

type Status = 'idle' | 'loading' | 'ok' | 'error';

const PAGE_SIZE = 20;

@Injectable({ providedIn: 'root' })
export class VendaStore {
  private readonly api = inject(VendasApi);

  private readonly vendasInterno = signal<VendaDetalheResponse[]>([]);
  private readonly statusInterno = signal<Status>('idle');
  private readonly temMaisInterno = signal(false);

  private filtros: VendaFiltros = {};
  private page = 1;

  readonly vendas = this.vendasInterno.asReadonly();
  readonly status = this.statusInterno.asReadonly();
  readonly temMais = this.temMaisInterno.asReadonly();

  buscar(filtros: Omit<VendaFiltros, 'page' | 'pageSize'>): void {
    this.filtros = filtros;
    this.page = 1;
    this.statusInterno.set('loading');
    this.api.listar({ ...filtros, page: 1, pageSize: PAGE_SIZE }).subscribe({
      next: (vendas) => {
        this.vendasInterno.set(vendas);
        this.temMaisInterno.set(vendas.length === PAGE_SIZE);
        this.statusInterno.set('ok');
      },
      error: () => this.statusInterno.set('error'),
    });
  }

  carregarMais(): void {
    this.page += 1;
    this.api.listar({ ...this.filtros, page: this.page, pageSize: PAGE_SIZE }).subscribe({
      next: (vendas) => {
        this.vendasInterno.update((atual) => [...atual, ...vendas]);
        this.temMaisInterno.set(vendas.length === PAGE_SIZE);
      },
      error: () => this.temMaisInterno.set(false),
    });
  }

  // Escritas lançam ApiError — a página trata. A lista é recarregada do servidor (Regra 8.6).

  async criar(request: CreateVendaRequest): Promise<VendaResponse> {
    const venda = await firstValueFrom(this.api.criar(request));
    this.buscar(this.filtros);
    return venda;
  }

  async editar(id: string, request: CreateVendaRequest): Promise<VendaResponse> {
    const venda = await firstValueFrom(this.api.editar(id, request));
    this.buscar(this.filtros);
    return venda;
  }

  async adicionarPagamento(id: string, request: AddPagamentoRequest): Promise<VendaResponse> {
    const venda = await firstValueFrom(this.api.adicionarPagamento(id, request));
    this.buscar(this.filtros);
    return venda;
  }

  async emitirCupom(id: string): Promise<CupomFiscalResponse> {
    return firstValueFrom(this.api.emitirCupom(id));
  }
}
