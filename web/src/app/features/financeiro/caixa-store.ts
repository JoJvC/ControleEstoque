import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { FinanceiroApi } from '../../core/api/financeiro-api';
import {
  DiariaFechamentoRequest,
  FechamentoResponse,
  ResumoCaixaResponse,
  TipoDespesaResponse,
} from '../../core/api/models/financeiro';
import { ApiError } from '../../core/http/api-error';
import { hojeLocal } from '../../core/util/data-local';

type Status = 'idle' | 'loading' | 'nao-aberto' | 'ok' | 'error';

@Injectable({ providedIn: 'root' })
export class CaixaStore {
  private readonly api = inject(FinanceiroApi);

  private readonly statusInterno = signal<Status>('idle');
  private readonly resumoInterno = signal<ResumoCaixaResponse | null>(null);

  readonly status = this.statusInterno.asReadonly();
  readonly resumo = this.resumoInterno.asReadonly();

  async carregar(data: string): Promise<void> {
    // recarga com a tela já montada mantém o resumo antigo até a resposta chegar
    if (this.statusInterno() !== 'ok') {
      this.statusInterno.set('loading');
    }
    try {
      this.resumoInterno.set(await firstValueFrom(this.api.obterResumoCaixa(data)));
      this.statusInterno.set('ok');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CAIXA_NAO_ENCONTRADO') {
        this.resumoInterno.set(null);
        this.statusInterno.set('nao-aberto');
      } else {
        this.statusInterno.set('error');
      }
    }
  }

  /** 409 CAIXA_JA_EXISTE (outro terminal abriu antes) resolve sem erro; os demais 4xx sobem. */
  async abrir(saldoInicial: number): Promise<void> {
    const data = hojeLocal();
    try {
      await firstValueFrom(this.api.abrirCaixa({ data, saldoInicial }));
    } catch (e) {
      if (!(e instanceof ApiError && e.code === 'CAIXA_JA_EXISTE')) {
        throw e;
      }
    }
    await this.carregar(data);
  }

  lancarDespesa(
    caixaId: string,
    tipoDespesaId: string,
    valor: number,
    descricao: string | null,
  ): Promise<void> {
    return firstValueFrom(this.api.lancarDespesa(caixaId, { tipoDespesaId, valor, descricao }));
  }

  fechar(caixaId: string, diarias: DiariaFechamentoRequest[]): Promise<FechamentoResponse> {
    return firstValueFrom(this.api.fecharCaixa(caixaId, { diarias }));
  }

  listarTipos(): Promise<TipoDespesaResponse[]> {
    return firstValueFrom(this.api.listarTiposDespesa());
  }

  criarTipo(nome: string): Promise<TipoDespesaResponse> {
    return firstValueFrom(this.api.criarTipoDespesa({ nome }));
  }
}
