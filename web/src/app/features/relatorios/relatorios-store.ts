import { Injectable, inject, signal } from '@angular/core';
import { Observable, firstValueFrom, forkJoin, map } from 'rxjs';

import { ClientesApi } from '../../core/api/clientes-api';
import { EstoqueApi } from '../../core/api/estoque-api';
import { FinanceiroApi } from '../../core/api/financeiro-api';
import { ProdutoResponse } from '../../core/api/models/estoque';
import {
  RelatorioCaixa,
  RelatorioEstoque,
  RelatorioFaturamento,
  RelatorioLucro,
  SaldoCascoRelatorio,
  SaldoFiadoCliente,
  SaldoFuncionario,
  SucataEntregueRelatorio,
  VendasPorFuncionario,
} from '../../core/api/models/relatorios';
import { OperatorStore } from '../../core/operator/operator-store';
import { RhApi } from '../../core/api/rh-api';
import { VendasApi } from '../../core/api/vendas-api';
import { ApiError } from '../../core/http/api-error';

export interface EstadoRelatorio<T> {
  dados: T | null;
  carregando: boolean;
  erro: string | null;
}

/** O relatório não traz o estoque geral: ele vem dos produtos (GET /v1/produtos). */
export interface RelatorioEstoqueTela extends RelatorioEstoque {
  produtos: ProdutoResponse[];
}

function vazio<T>(): EstadoRelatorio<T> {
  return { dados: null, carregando: false, erro: null };
}

/** Guarda o que o servidor devolveu; nada é somado nem recalculado aqui (§8 regra 6). */
@Injectable({ providedIn: 'root' })
export class RelatoriosStore {
  private readonly vendas = inject(VendasApi);
  private readonly financeiro = inject(FinanceiroApi);
  private readonly clientes = inject(ClientesApi);
  private readonly estoqueApi = inject(EstoqueApi);
  private readonly rh = inject(RhApi);
  private readonly operatorStore = inject(OperatorStore);

  private readonly faturamentoInterno = signal(vazio<RelatorioFaturamento>());
  private readonly vendasPorFuncionarioInterno = signal(vazio<VendasPorFuncionario[]>());
  private readonly caixaInterno = signal(vazio<RelatorioCaixa>());
  private readonly fiadoInterno = signal(vazio<SaldoFiadoCliente[]>());
  private readonly cascosInterno = signal(vazio<SaldoCascoRelatorio[]>());
  private readonly sucataInterno = signal(vazio<SucataEntregueRelatorio[]>());
  private readonly estoqueInterno = signal(vazio<RelatorioEstoqueTela>());
  private readonly lucroInterno = signal(vazio<RelatorioLucro>());
  private readonly contaFuncionariosInterno = signal(vazio<SaldoFuncionario[]>());

  readonly faturamento = this.faturamentoInterno.asReadonly();
  readonly vendasPorFuncionario = this.vendasPorFuncionarioInterno.asReadonly();
  readonly caixa = this.caixaInterno.asReadonly();
  readonly fiado = this.fiadoInterno.asReadonly();
  readonly cascos = this.cascosInterno.asReadonly();
  readonly sucata = this.sucataInterno.asReadonly();
  readonly estoque = this.estoqueInterno.asReadonly();
  readonly lucro = this.lucroInterno.asReadonly();
  readonly contaFuncionarios = this.contaFuncionariosInterno.asReadonly();

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

  carregarCascos(): Promise<void> {
    return this.carregar(this.cascosInterno, this.clientes.relatorioCascos());
  }

  carregarSucata(): Promise<void> {
    return this.carregar(this.sucataInterno, this.clientes.relatorioSucata());
  }

  carregarEstoque(): Promise<void> {
    return this.carregar(
      this.estoqueInterno,
      forkJoin([this.estoqueApi.relatorioEstoque(), this.estoqueApi.listarProdutos()]).pipe(
        map(([relatorio, produtos]) => ({ ...relatorio, produtos })),
      ),
    );
  }

  /** O funcionário vai na query `funcionarioId` (o backend exige `estoque.custos`); sem operador não há requisição. */
  carregarLucro(inicio: string, fim: string): Promise<void> {
    const funcionarioId = this.operatorStore.operator()?.id;
    if (!funcionarioId) {
      this.lucroInterno.set({
        dados: null,
        carregando: false,
        erro: 'Selecione um funcionário para ver o lucro.',
      });
      return Promise.resolve();
    }
    return this.carregar(
      this.lucroInterno,
      this.estoqueApi.relatorioLucro(inicio, fim, funcionarioId),
    );
  }

  carregarContaFuncionarios(): Promise<void> {
    return this.carregar(this.contaFuncionariosInterno, this.rh.relatorioContaFuncionarios());
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
