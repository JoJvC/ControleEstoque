import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { LancamentoContaRequest, LancamentoResponse } from '../../core/api/models/rh';
import { RhApi } from '../../core/api/rh-api';

type Status = 'idle' | 'loading' | 'ok' | 'error';

@Injectable({ providedIn: 'root' })
export class ContaCorrenteStore {
  private readonly api = inject(RhApi);

  private readonly statusInterno = signal<Status>('idle');
  private readonly lancamentosInterno = signal<LancamentoResponse[]>([]);
  private readonly saldoInterno = signal(0);

  readonly status = this.statusInterno.asReadonly();
  readonly lancamentos = this.lancamentosInterno.asReadonly();
  readonly saldoAPagar = this.saldoInterno.asReadonly();

  async carregar(funcionarioId: string): Promise<void> {
    // singleton: sem limpar, uma falha mostraria o saldo do funcionário anterior
    this.lancamentosInterno.set([]);
    this.saldoInterno.set(0);
    this.statusInterno.set('loading');
    try {
      const extrato = await firstValueFrom(this.api.obterContaCorrente(funcionarioId));
      this.lancamentosInterno.set(extrato.lancamentos);
      this.saldoInterno.set(extrato.saldoAPagar);
      this.statusInterno.set('ok');
    } catch {
      this.statusInterno.set('error');
    }
  }

  async lancarVale(id: string, req: LancamentoContaRequest): Promise<void> {
    const r = await firstValueFrom(this.api.lancarVale(id, req));
    await this.aplicar(id, r.saldoAPagar);
  }

  async lancarPagamento(id: string, req: LancamentoContaRequest): Promise<void> {
    const r = await firstValueFrom(this.api.lancarPagamento(id, req));
    await this.aplicar(id, r.saldoAPagar);
  }

  /** O saldo vem da resposta do lançamento; o extrato é recarregado só para a lista. */
  private async aplicar(id: string, saldo: number): Promise<void> {
    this.saldoInterno.set(saldo);
    try {
      const extrato = await firstValueFrom(this.api.obterContaCorrente(id));
      this.lancamentosInterno.set(extrato.lancamentos);
    } catch {
      // lançamento já gravado; a lista fica desatualizada até a próxima carga
    }
  }
}
