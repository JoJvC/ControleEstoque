import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ConfigStore } from '../config/app-config';
import {
  AddPagamentoRequest,
  CancelarVendaRequest,
  CreateVendaRequest,
  CupomFiscalResponse,
  UltimoPrecoResponse,
  VendaDetalheResponse,
  VendaResponse,
} from './models/vendas';
import { RelatorioFaturamento, VendasPorFuncionario } from './models/relatorios';
import { periodoParams } from './periodo-params';

export interface VendaFiltros {
  clienteId?: string;
  /** Datas em ISO (yyyy-MM-dd). */
  inicio?: string;
  fim?: string;
  page?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class VendasApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigStore);

  private get base(): string {
    return `${this.config.apiBaseUrl}/vendas/v1`;
  }

  criar(request: CreateVendaRequest): Observable<VendaResponse> {
    return this.http.post<VendaResponse>(`${this.base}/vendas`, request);
  }

  cancelar(id: string, request: CancelarVendaRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/vendas/${id}/cancelamento`, request);
  }

  editar(id: string, request: CreateVendaRequest): Observable<VendaResponse> {
    return this.http.put<VendaResponse>(`${this.base}/vendas/${id}`, request);
  }

  obter(id: string): Observable<VendaDetalheResponse> {
    return this.http.get<VendaDetalheResponse>(`${this.base}/vendas/${id}`);
  }

  listar(filtros: VendaFiltros = {}): Observable<VendaDetalheResponse[]> {
    let params = new HttpParams();
    if (filtros.clienteId) {
      params = params.set('clienteId', filtros.clienteId);
    }
    if (filtros.inicio) {
      params = params.set('inicio', filtros.inicio);
    }
    if (filtros.fim) {
      params = params.set('fim', filtros.fim);
    }
    if (filtros.page !== undefined) {
      params = params.set('page', filtros.page);
    }
    if (filtros.pageSize !== undefined) {
      params = params.set('pageSize', filtros.pageSize);
    }
    return this.http.get<VendaDetalheResponse[]>(`${this.base}/vendas`, { params });
  }

  /** Preço unitário da última venda do cliente para o produto/marca; 204 (sem venda anterior) vira null. */
  ultimoPreco(
    clienteId: string,
    produtoId: string,
    marcaId: string,
  ): Observable<UltimoPrecoResponse | null> {
    const params = new HttpParams()
      .set('clienteId', clienteId)
      .set('produtoId', produtoId)
      .set('marcaId', marcaId);
    return this.http
      .get<UltimoPrecoResponse>(`${this.base}/vendas/ultimo-preco`, {
        params,
        observe: 'response',
      })
      .pipe(map((r) => (r.status === 204 ? null : r.body)));
  }

  adicionarPagamento(id: string, request: AddPagamentoRequest): Observable<VendaResponse> {
    return this.http.post<VendaResponse>(`${this.base}/vendas/${id}/pagamentos`, request);
  }

  emitirCupom(id: string): Observable<CupomFiscalResponse> {
    return this.http.post<CupomFiscalResponse>(`${this.base}/vendas/${id}/cupom-fiscal`, null);
  }

  /** Datas em yyyy-MM-dd; `produtoId` só vai na query quando vier. */
  relatorioFaturamento(
    inicio?: string,
    fim?: string,
    produtoId?: string,
  ): Observable<RelatorioFaturamento> {
    let params = periodoParams(inicio, fim);
    if (produtoId) {
      params = params.set('produtoId', produtoId);
    }
    return this.http.get<RelatorioFaturamento>(`${this.base}/relatorios/faturamento`, { params });
  }

  relatorioVendasPorFuncionario(inicio?: string, fim?: string): Observable<VendasPorFuncionario[]> {
    return this.http.get<VendasPorFuncionario[]>(`${this.base}/relatorios/vendas-por-funcionario`, {
      params: periodoParams(inicio, fim),
    });
  }
}
