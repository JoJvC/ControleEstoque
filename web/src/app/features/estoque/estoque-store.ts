import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, forkJoin } from 'rxjs';

import { EstoqueApi } from '../../core/api/estoque-api';
import {
  CreateAbastecimentoRequest,
  CreateBaixaCascoRequest,
  CreateMovimentoRequest,
  EstoqueCascoResponse,
  EstoqueItemResponse,
  ProdutoResponse,
} from '../../core/api/models/estoque';

type Status = 'idle' | 'loading' | 'ok' | 'error';

@Injectable({ providedIn: 'root' })
export class EstoqueStore {
  private readonly api = inject(EstoqueApi);

  private readonly produtosInterno = signal<ProdutoResponse[]>([]);
  private readonly cascosInterno = signal<EstoqueCascoResponse[]>([]);
  private readonly statusInterno = signal<Status>('idle');

  /** Saldo por produto+marca e estoque geral: o servidor soma, o front só exibe. */
  readonly produtos = this.produtosInterno.asReadonly();
  /** Vasilhames por tipo, como o servidor devolve (inclusive os zerados). */
  readonly cascos = this.cascosInterno.asReadonly();
  readonly status = this.statusInterno.asReadonly();
  readonly erro = computed(() =>
    this.statusInterno() === 'error' ? 'Não foi possível carregar o estoque.' : null,
  );

  /** Uma linha por produto+marca, no formato de GET /v1/estoque (a abastecimento-page ainda a lê). */
  readonly itens = computed<EstoqueItemResponse[]>(() =>
    this.produtosInterno().flatMap((p) =>
      p.marcas.map((m) => ({
        produtoMarcaId: m.id,
        produtoId: p.id,
        tipo: p.tipo,
        nome: p.nome,
        marcaId: m.marcaId,
        marca: m.marcaNome,
        categoria: p.categoria,
        tamanho: p.tamanho,
        quantidade: m.quantidade,
        estoqueMinimo: m.estoqueMinimo,
        abaixoMinimo: m.abaixoMinimo,
      })),
    ),
  );

  carregar(): void {
    this.statusInterno.set('loading');
    forkJoin({
      produtos: this.api.listarProdutos(),
      cascos: this.api.obterEstoqueCascos(),
    }).subscribe({
      next: ({ produtos, cascos }) => {
        this.produtosInterno.set(produtos);
        this.cascosInterno.set(cascos);
        this.statusInterno.set('ok');
      },
      error: () => this.statusInterno.set('error'),
    });
  }

  /** Lança ApiError — quem chama trata. Saldos sempre re-consultados do servidor (Regra 8.6). */
  async ajustar(request: CreateMovimentoRequest): Promise<void> {
    await firstValueFrom(this.api.criarMovimento(request));
    this.carregar();
  }

  async abastecer(request: CreateAbastecimentoRequest): Promise<void> {
    await firstValueFrom(this.api.criarAbastecimento(request));
    this.carregar();
  }

  async baixarCasco(request: CreateBaixaCascoRequest): Promise<void> {
    await firstValueFrom(this.api.criarBaixaCasco(request));
    this.carregar();
  }
}
