import { Injectable, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { FinanceiroApi } from '../../core/api/financeiro-api';
import {
  RelatorioCaixa,
  RelatorioFaturamento,
  SaldoFiadoCliente,
  VendasPorFuncionario,
} from '../../core/api/models/relatorios';
import { VendasApi } from '../../core/api/vendas-api';
import { ApiError } from '../../core/http/api-error';

export interface EstadoRelatorio<T> {
  dados: T | null;
  carregando: boolean;
  erro: string | null;
}

function vazio<T>(): EstadoRelatorio<T> {
  return { dados: null, carregando: false, erro: null };
}

/** Guarda o que o servidor devolveu; nada é somado nem recalculado aqui (§8 regra 6). */
@Injectable({ providedIn: 'root' })
export class RelatoriosStore {
  private readonly vendas = inject(VendasApi);
  private readonly financeiro = inject(FinanceiroApi);

  private readonly faturamentoInterno = signal(vazio<RelatorioFaturamento>());
  private readonly vendasPorFuncionarioInterno = signal(vazio<VendasPorFuncionario[]>());
  private readonly caixaInterno = signal(vazio<RelatorioCaixa>());
  private readonly fiadoInterno = signal(vazio<SaldoFiadoCliente[]>());

  readonly faturamento = this.faturamentoInterno.asReadonly();
  readonly vendasPorFuncionario = this.vendasPorFuncionarioInterno.asReadonly();
  readonly caixa = this.caixaInterno.asReadonly();
  readonly fiado = this.fiadoInterno.asReadonly();

  carregarFaturamento(inicio: string, fim: string, produtoId?: string): Promise<void> {
    return this.carregar(
      this.faturamentoInterno,
      this.vendas.relatorioFaturamento(inicio, fim, produtoId),
    );
  }

  carregarVendasPorFuncionario(inicio: string, fim: string): Promise<void> {
    return this.carregar(
      this.vendasPorFuncionarioInterno,
      this.vendas.relatorioVendasPorFuncionario(inicio, fim),
    );
  }

  carregarCaixa(inicio: string, fim: string): Promise<void> {
    return this.carregar(this.caixaInterno, this.financeiro.relatorioCaixa(inicio, fim));
  }

  carregarFiado(): Promise<void> {
    return this.carregar(this.fiadoInterno, this.financeiro.relatorioFiado());
  }

  /** Recarga mantém os dados antigos até a resposta; falha limpa os dados e guarda a mensagem. */
  private async carregar<T>(
    alvo: { set(v: EstadoRelatorio<T>): void; (): EstadoRelatorio<T> },
    origem: Observable<T>,
  ): Promise<void> {
    alvo.set({ dados: alvo().dados, carregando: true, erro: null });
    try {
      alvo.set({ dados: await firstValueFrom(origem), carregando: false, erro: null });
    } catch (e) {
      const erro = e instanceof ApiError ? e.userMessage : 'Não foi possível carregar o relatório.';
      alvo.set({ dados: null, carregando: false, erro });
    }
  }
}
