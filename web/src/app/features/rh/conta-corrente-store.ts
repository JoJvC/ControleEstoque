import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { LancamentoContaRequest, LancamentoResponse } from '../../core/api/models/rh';
import { RhApi } from '../../core/api/rh-api';
import { LinhaExtrato, saldoPorLancamento } from './conta-corrente-saldo';

type Status = 'idle' | 'loading' | 'ok' | 'error';

@Injectable({ providedIn: 'root' })
export class ContaCorrenteStore {
  private readonly api = inject(RhApi);

  private readonly statusInterno = signal<Status>('idle');
  private readonly lancamentosInterno = signal<LancamentoResponse[]>([]);
  private readonly saldoInterno = signal(0);
  /** Saldo do mesmo GET que trouxe os lançamentos: a lista se ancora nele, não no saldo do POST. */
  private readonly ancoraInterna = signal(0);

  readonly status = this.statusInterno.asReadonly();
  readonly lancamentos = this.lancamentosInterno.asReadonly();
  readonly saldoAPagar = this.saldoInterno.asReadonly();
  /** Lançamentos da mais nova para a mais antiga, com o saldo depois de cada um. */
  readonly extrato = computed<LinhaExtrato[]>(() =>
    saldoPorLancamento(this.lancamentosInterno(), this.ancoraInterna()),
  );

  async carregar(funcionarioId: string): Promise<void> {
    // singleton: sem limpar, uma falha mostraria o saldo do funcionário anterior
    this.lancamentosInterno.set([]);
    this.saldoInterno.set(0);
    this.ancoraInterna.set(0);
    this.statusInterno.set('loading');
    try {
      const extrato = await firstValueFrom(this.api.obterContaCorrente(funcionarioId));
      this.lancamentosInterno.set(extrato.lancamentos);
      this.saldoInterno.set(extrato.saldoAPagar);
      this.ancoraInterna.set(extrato.saldoAPagar);
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

  /** O herói mostra o saldo do POST; lista e âncora vêm juntas do refetch (se falhar, ficam as antigas). */
  private async aplicar(id: string, saldo: number): Promise<void> {
    this.saldoInterno.set(saldo);
    try {
      const extrato = await firstValueFrom(this.api.obterContaCorrente(id));
      this.lancamentosInterno.set(extrato.lancamentos);
      this.ancoraInterna.set(extrato.saldoAPagar);
    } catch {
      // lançamento já gravado; a lista fica com a âncora antiga (coerente) até a próxima carga
    }
  }
}
