import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { EstoqueApi } from '../../core/api/estoque-api';
import {
  CreateAbastecimentoRequest,
  CreateBaixaCascoRequest,
  CreateMovimentoRequest,
  EstoqueItemResponse,
} from '../../core/api/models/estoque';

type Status = 'idle' | 'loading' | 'ok' | 'error';

@Injectable({ providedIn: 'root' })
export class EstoqueStore {
  private readonly api = inject(EstoqueApi);

  private readonly itensInterno = signal<EstoqueItemResponse[]>([]);
  private readonly statusInterno = signal<Status>('idle');

  readonly itens = this.itensInterno.asReadonly();
  readonly status = this.statusInterno.asReadonly();

  carregar(): void {
    this.statusInterno.set('loading');
    this.api.obterEstoque().subscribe({
      next: (itens) => {
        this.itensInterno.set(itens);
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
