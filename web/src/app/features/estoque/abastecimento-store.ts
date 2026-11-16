import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { EstoqueApi } from '../../core/api/estoque-api';
import {
  AbastecimentoDetalheResponse,
  AbastecimentoPendenteResponse,
  CreateAbastecimentoRequest,
  LancarCustosAbastecimentoRequest,
} from '../../core/api/models/estoque';
import { OperatorStore } from '../../core/operator/operator-store';
import { EstoqueStore } from './estoque-store';

type Status = 'idle' | 'loading' | 'ok' | 'error';

/** Carga de mercadoria: momento 1 (quantidades) e momento 2 (custos e frete, `estoque.custos`). */
@Injectable({ providedIn: 'root' })
export class AbastecimentoStore {
  private readonly api = inject(EstoqueApi);
  private readonly estoque = inject(EstoqueStore);
  private readonly operatorStore = inject(OperatorStore);

  private readonly pendentesInterno = signal<AbastecimentoPendenteResponse[]>([]);
  private readonly statusPendentesInterno = signal<Status>('idle');
  private readonly detalheInterno = signal<AbastecimentoDetalheResponse | null>(null);
  private readonly statusDetalheInterno = signal<Status>('idle');

  readonly pendentes = this.pendentesInterno.asReadonly();
  readonly statusPendentes = this.statusPendentesInterno.asReadonly();
  readonly detalhe = this.detalheInterno.asReadonly();
  readonly statusDetalhe = this.statusDetalheInterno.asReadonly();

  private get funcionarioId(): string | null {
    return this.operatorStore.operator()?.id ?? null;
  }

  /** Lança ApiError — quem chama trata. Devolve o id da carga; saldos re-consultados do servidor. */
  async registrar(request: Omit<CreateAbastecimentoRequest, 'funcionarioId'>): Promise<string> {
    const { id } = await firstValueFrom(
      this.api.criarAbastecimento({ ...request, funcionarioId: this.funcionarioId }),
    );
    this.estoque.carregar();
    return id;
  }

  async carregarPendentes(): Promise<void> {
    this.statusPendentesInterno.set('loading');
    try {
      this.pendentesInterno.set(
        await firstValueFrom(this.api.listarCustosPendentes(this.funcionarioId)),
      );
      this.statusPendentesInterno.set('ok');
    } catch {
      this.statusPendentesInterno.set('error');
    }
  }

  async carregar(id: string): Promise<void> {
    this.detalheInterno.set(null);
    this.statusDetalheInterno.set('loading');
    try {
      this.detalheInterno.set(
        await firstValueFrom(this.api.obterAbastecimento(id, this.funcionarioId)),
      );
      this.statusDetalheInterno.set('ok');
    } catch {
      this.statusDetalheInterno.set('error');
    }
  }

  /** Lança ApiError (CUSTO_INVALIDO, FRETE_INVALIDO, PERMISSAO_NEGADA). O total vem do servidor. */
  async lancarCustos(
    id: string,
    request: Omit<LancarCustosAbastecimentoRequest, 'funcionarioId'>,
  ): Promise<AbastecimentoDetalheResponse> {
    const detalhe = await firstValueFrom(
      this.api.lancarCustosAbastecimento(id, { ...request, funcionarioId: this.funcionarioId }),
    );
    this.detalheInterno.set(detalhe);
    return detalhe;
  }
}
