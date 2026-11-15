import { Injectable, WritableSignal, inject, signal } from '@angular/core';
import { Observable, Subscription, firstValueFrom } from 'rxjs';

import { ClientesApi } from '../../core/api/clientes-api';
import { EstoqueApi } from '../../core/api/estoque-api';
import { VendaFiltros, VendasApi } from '../../core/api/vendas-api';
import {
  AddPagamentoRequest,
  CreateVendaRequest,
  CupomFiscalResponse,
  VendaDetalheResponse,
  VendaResponse,
} from '../../core/api/models/vendas';
import { ApiError } from '../../core/http/api-error';
import { EstadoCliente, EstadoNome, EstadoProduto } from './venda-rotulos';

type Status = 'idle' | 'loading' | 'ok' | 'error';

const PAGE_SIZE = 20;

function mensagemDe(e: unknown): string | null {
  return e instanceof ApiError ? e.userMessage : null;
}

@Injectable({ providedIn: 'root' })
export class VendaStore {
  private readonly api = inject(VendasApi);
  private readonly clientesApi = inject(ClientesApi);
  private readonly estoqueApi = inject(EstoqueApi);

  private readonly vendasInterno = signal<VendaDetalheResponse[]>([]);
  private readonly statusInterno = signal<Status>('idle');
  private readonly temMaisInterno = signal(false);

  private readonly erroInterno = signal<string | null>(null);
  private readonly detalheInterno = signal<VendaDetalheResponse | null>(null);
  private readonly statusDetalheInterno = signal<Status>('idle');
  private readonly erroDetalheInterno = signal<string | null>(null);
  private readonly clientesInterno = signal<ReadonlyMap<string, EstadoCliente>>(new Map());
  private readonly produtosInterno = signal<ReadonlyMap<string, EstadoProduto>>(new Map());

  private obterSub: Subscription | null = null;
  private filtros: VendaFiltros = {};
  private page = 1;

  readonly vendas = this.vendasInterno.asReadonly();
  readonly status = this.statusInterno.asReadonly();
  readonly temMais = this.temMaisInterno.asReadonly();
  readonly erro = this.erroInterno.asReadonly();
  readonly detalhe = this.detalheInterno.asReadonly();
  readonly statusDetalhe = this.statusDetalheInterno.asReadonly();
  readonly erroDetalhe = this.erroDetalheInterno.asReadonly();
  /** Cache clienteId → nome; nunca é limpo por buscar. */
  readonly clientes = this.clientesInterno.asReadonly();
  /** Cache produtoId → nome (detalhe); nunca é limpo. */
  readonly produtos = this.produtosInterno.asReadonly();

  /**
   * Última venda do cliente (a listagem vem por data DESC); null se ele nunca comprou.
   * A listagem traz só o resumo (itens: []): os itens vêm do detalhe, por obter(id).
   */
  async ultimaVendaDoCliente(clienteId: string): Promise<VendaDetalheResponse | null> {
    const [resumo] = await firstValueFrom(this.api.listar({ clienteId, page: 1, pageSize: 1 }));
    return resumo ? firstValueFrom(this.api.obter(resumo.id)) : null;
  }

  buscar(filtros: Omit<VendaFiltros, 'page' | 'pageSize'>): void {
    this.filtros = filtros;
    this.page = 1;
    this.statusInterno.set('loading');
    this.erroInterno.set(null);
    this.api.listar({ ...filtros, page: 1, pageSize: PAGE_SIZE }).subscribe({
      next: (vendas) => {
        this.vendasInterno.set(vendas);
        this.temMaisInterno.set(vendas.length === PAGE_SIZE);
        this.statusInterno.set('ok');
        this.resolverClientes(vendas);
      },
      error: (e: unknown) => {
        this.erroInterno.set(mensagemDe(e));
        this.statusInterno.set('error');
      },
    });
  }

  carregarMais(): void {
    this.page += 1;
    this.api.listar({ ...this.filtros, page: this.page, pageSize: PAGE_SIZE }).subscribe({
      next: (vendas) => {
        this.vendasInterno.update((atual) => [...atual, ...vendas]);
        this.temMaisInterno.set(vendas.length === PAGE_SIZE);
        this.resolverClientes(vendas);
      },
      error: (e: unknown) => {
        // Rede/5xx já viraram toast no interceptor: inline só 4xx.
        this.erroInterno.set(
          e instanceof ApiError && e.status < 500 && e.status > 0 ? e.userMessage : null,
        );
        this.temMaisInterno.set(false);
      },
    });
  }

  obter(id: string): void {
    this.detalheInterno.set(null);
    this.erroDetalheInterno.set(null);
    this.statusDetalheInterno.set('loading');
    // Chamada nova cancela a anterior: resposta atrasada não pode sobrescrever o detalhe atual.
    this.obterSub?.unsubscribe();
    this.obterSub = this.api.obter(id).subscribe({
      next: (venda) => {
        this.detalheInterno.set(venda);
        this.statusDetalheInterno.set('ok');
        this.resolverClientes([venda]);
        this.resolverProdutos(venda);
      },
      error: (e: unknown) => {
        this.erroDetalheInterno.set(mensagemDe(e));
        this.statusDetalheInterno.set('error');
      },
    });
  }

  // Um GET de cliente por clienteId que ainda não está no cache (em qualquer estado).
  private resolverClientes(vendas: readonly VendaDetalheResponse[]): void {
    this.resolverNomes(
      vendas.map((v) => v.clienteId),
      this.clientesInterno,
      (id) => this.clientesApi.obter(id),
    );
  }

  // Um GET de produto por produtoId distinto que ainda não está no cache.
  private resolverProdutos(venda: VendaDetalheResponse): void {
    this.resolverNomes(
      venda.itens.map((i) => i.produtoId),
      this.produtosInterno,
      (id) => this.estoqueApi.obterProduto(id),
    );
  }

  private resolverNomes(
    ids: readonly string[],
    cache: WritableSignal<ReadonlyMap<string, EstadoNome>>,
    obter: (id: string) => Observable<{ nome: string }>,
  ): void {
    const definir = (id: string, estado: EstadoNome | null): void =>
      cache.update((atual) => {
        const novo = new Map(atual);
        if (estado) {
          novo.set(id, estado);
        } else {
          novo.delete(id);
        }
        return novo;
      });
    for (const id of new Set(ids)) {
      if (cache().has(id)) {
        continue;
      }
      definir(id, { estado: 'carregando' });
      obter(id).subscribe({
        next: (r) => definir(id, { estado: 'ok', nome: r.nome }),
        // Rede/5xx: sai do cache para a próxima busca tentar de novo (o toast é do interceptor).
        error: (e: unknown) =>
          definir(id, e instanceof ApiError && e.status === 404 ? { estado: 'removido' } : null),
      });
    }
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
    this.recarregarDetalheDe(id);
    return venda;
  }

  async emitirCupom(id: string): Promise<CupomFiscalResponse> {
    const cupom = await firstValueFrom(this.api.emitirCupom(id));
    this.recarregarDetalheDe(id);
    return cupom;
  }

  /** Cupom já emitido da venda (409 CUPOM_JA_EMITIDO); não mexe no detalhe aberto. */
  async cupomExistente(id: string): Promise<{ numero: string; emitidoEm: string } | null> {
    const venda = await firstValueFrom(this.api.obter(id));
    return venda.cupomNumero && venda.cupomEmitidoEm
      ? { numero: venda.cupomNumero, emitidoEm: venda.cupomEmitidoEm }
      : null;
  }

  // Só recarrega quando o detalhe aberto é dessa venda (no PDV não há detalhe aberto).
  private recarregarDetalheDe(id: string): void {
    if (this.detalheInterno()?.id === id) this.obter(id);
  }
}
