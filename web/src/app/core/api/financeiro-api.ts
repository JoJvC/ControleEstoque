import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ConfigStore } from '../config/app-config';
import {
  AbrirCaixaRequest,
  CaixaResponse,
  CreateDespesaRequest,
  CreateTipoDespesaRequest,
  FecharCaixaRequest,
  FechamentoResponse,
  PagamentoFiadoRequest,
  PagamentoFiadoResponse,
  ResumoCaixaResponse,
  TipoDespesaResponse,
} from './models/financeiro';
import { RelatorioCaixa, SaldoFiadoCliente, TotalFiadoResponse } from './models/relatorios';
import { periodoParams } from './periodo-params';

@Injectable({ providedIn: 'root' })
export class FinanceiroApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigStore);

  private get base(): string {
    return `${this.config.apiBaseUrl}/financeiro/v1`;
  }

  pagarFiado(
    clienteId: string,
    request: PagamentoFiadoRequest,
  ): Observable<PagamentoFiadoResponse> {
    return this.http.post<PagamentoFiadoResponse>(
      `${this.base}/clientes/${clienteId}/fiado/pagamentos`,
      request,
    );
  }

  abrirCaixa(request: AbrirCaixaRequest): Observable<CaixaResponse> {
    return this.http.post<CaixaResponse>(`${this.base}/caixas`, request);
  }

  /** `data` em yyyy-MM-dd. */
  obterResumoCaixa(data: string): Observable<ResumoCaixaResponse> {
    return this.http.get<ResumoCaixaResponse>(`${this.base}/caixas/${data}`);
  }

  lancarDespesa(caixaId: string, request: CreateDespesaRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/caixas/${caixaId}/despesas`, request);
  }

  fecharCaixa(caixaId: string, request: FecharCaixaRequest): Observable<FechamentoResponse> {
    return this.http.post<FechamentoResponse>(`${this.base}/caixas/${caixaId}/fechamento`, request);
  }

  listarTiposDespesa(): Observable<TipoDespesaResponse[]> {
    return this.http.get<TipoDespesaResponse[]>(`${this.base}/tipos-despesa`);
  }

  criarTipoDespesa(request: CreateTipoDespesaRequest): Observable<TipoDespesaResponse> {
    return this.http.post<TipoDespesaResponse>(`${this.base}/tipos-despesa`, request);
  }

  /** Datas em yyyy-MM-dd. */
  relatorioCaixa(inicio?: string, fim?: string): Observable<RelatorioCaixa> {
    return this.http.get<RelatorioCaixa>(`${this.base}/relatorios/caixa`, {
      params: periodoParams(inicio, fim),
    });
  }

  relatorioFiado(): Observable<SaldoFiadoCliente[]> {
    return this.http.get<SaldoFiadoCliente[]>(`${this.base}/relatorios/fiado`);
  }

  totalFiado(): Observable<TotalFiadoResponse> {
    return this.http.get<TotalFiadoResponse>(`${this.base}/relatorios/fiado/total`);
  }
}
