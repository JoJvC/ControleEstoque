import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { EstoqueApi } from '../../core/api/estoque-api';
import { CreateProdutoRequest, ProdutoResponse } from '../../core/api/models/estoque';

type Status = 'idle' | 'loading' | 'ok' | 'error';

@Injectable({ providedIn: 'root' })
export class ProdutosStore {
  private readonly api = inject(EstoqueApi);

  private readonly produtosInterno = signal<ProdutoResponse[]>([]);
  private readonly statusInterno = signal<Status>('idle');

  readonly produtos = this.produtosInterno.asReadonly();
  readonly status = this.statusInterno.asReadonly();

  carregar(): void {
    this.statusInterno.set('loading');
    this.api.listarProdutos().subscribe({
      next: (produtos) => {
        this.produtosInterno.set(produtos);
        this.statusInterno.set('ok');
      },
      error: () => this.statusInterno.set('error'),
    });
  }

  /**
   * Cria ou atualiza o produto e, se houver foto nova, envia em seguida.
   * Lança ApiError — a página trata (inline/toast).
   */
  async salvar(
    request: CreateProdutoRequest,
    id: string | null,
    foto: File | null,
  ): Promise<ProdutoResponse> {
    const produto =
      id === null
        ? await firstValueFrom(this.api.criarProduto(request))
        : await firstValueFrom(this.api.atualizarProduto(id, request));

    if (foto !== null) {
      await firstValueFrom(this.api.enviarFoto(produto.id, foto));
    }

    this.carregar();
    return produto;
  }
}
