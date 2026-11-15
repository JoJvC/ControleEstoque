import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ConfigStore } from '../config/app-config';
import {
  CreateAbastecimentoRequest,
  CreateBaixaCascoRequest,
  CreateMarcaRequest,
  CreateMovimentoRequest,
  CreateProdutoMarcaRequest,
  CreateProdutoRequest,
  CreatedResponse,
  EstoqueItemResponse,
  FotoResponse,
  MarcaResponse,
  ProdutoResponse,
  TipoCascoRequest,
  TipoCascoResponse,
  TipoProduto,
} from './models/estoque';
import { RelatorioEstoque } from './models/relatorios';

export interface ProdutoFiltros {
  tipo?: TipoProduto;
  marcaId?: string;
  categoria?: string;
}

@Injectable({ providedIn: 'root' })
export class EstoqueApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigStore);

  private get base(): string {
    return `${this.config.apiBaseUrl}/estoque/v1`;
  }

  listarMarcas(): Observable<MarcaResponse[]> {
    return this.http.get<MarcaResponse[]>(`${this.base}/marcas`);
  }

  criarMarca(request: CreateMarcaRequest): Observable<MarcaResponse> {
    return this.http.post<MarcaResponse>(`${this.base}/marcas`, request);
  }

  listarTiposCasco(): Observable<TipoCascoResponse[]> {
    return this.http.get<TipoCascoResponse[]>(`${this.base}/tipos-casco`);
  }

  criarTipoCasco(request: TipoCascoRequest): Observable<TipoCascoResponse> {
    return this.http.post<TipoCascoResponse>(`${this.base}/tipos-casco`, request);
  }

  atualizarTipoCasco(id: string, request: TipoCascoRequest): Observable<TipoCascoResponse> {
    return this.http.put<TipoCascoResponse>(`${this.base}/tipos-casco/${id}`, request);
  }

  listarProdutos(filtros: ProdutoFiltros = {}): Observable<ProdutoResponse[]> {
    let params = new HttpParams();
    if (filtros.tipo) {
      params = params.set('tipo', filtros.tipo);
    }
    if (filtros.marcaId) {
      params = params.set('marcaId', filtros.marcaId);
    }
    if (filtros.categoria) {
      params = params.set('categoria', filtros.categoria);
    }
    return this.http.get<ProdutoResponse[]>(`${this.base}/produtos`, { params });
  }

  obterProduto(id: string): Observable<ProdutoResponse> {
    return this.http.get<ProdutoResponse>(`${this.base}/produtos/${id}`);
  }

  criarProduto(request: CreateProdutoRequest): Observable<ProdutoResponse> {
    return this.http.post<ProdutoResponse>(`${this.base}/produtos`, request);
  }

  atualizarProduto(id: string, request: CreateProdutoRequest): Observable<ProdutoResponse> {
    return this.http.put<ProdutoResponse>(`${this.base}/produtos/${id}`, request);
  }

  adicionarMarca(
    produtoId: string,
    request: CreateProdutoMarcaRequest,
  ): Observable<ProdutoResponse> {
    return this.http.post<ProdutoResponse>(`${this.base}/produtos/${produtoId}/marcas`, request);
  }

  atualizarMarca(
    produtoId: string,
    produtoMarcaId: string,
    request: CreateProdutoMarcaRequest,
  ): Observable<ProdutoResponse> {
    return this.http.put<ProdutoResponse>(
      `${this.base}/produtos/${produtoId}/marcas/${produtoMarcaId}`,
      request,
    );
  }

  enviarFotoMarca(produtoId: string, produtoMarcaId: string, foto: File): Observable<FotoResponse> {
    const form = new FormData();
    form.append('foto', foto, foto.name);
    return this.http.post<FotoResponse>(
      `${this.base}/produtos/${produtoId}/marcas/${produtoMarcaId}/foto`,
      form,
    );
  }

  /** URL da foto da associação produto+marca para usar direto em <img src>. */
  urlFotoMarca(produtoId: string, produtoMarcaId: string): string {
    return `${this.base}/produtos/${produtoId}/marcas/${produtoMarcaId}/foto`;
  }

  obterEstoque(): Observable<EstoqueItemResponse[]> {
    return this.http.get<EstoqueItemResponse[]>(`${this.base}/estoque`);
  }

  criarMovimento(request: CreateMovimentoRequest): Observable<void> {
    return this.http.post<void>(`${this.base}/estoque/movimentos`, request);
  }

  criarAbastecimento(request: CreateAbastecimentoRequest): Observable<CreatedResponse> {
    return this.http.post<CreatedResponse>(`${this.base}/abastecimentos`, request);
  }

  criarBaixaCasco(request: CreateBaixaCascoRequest): Observable<CreatedResponse> {
    return this.http.post<CreatedResponse>(`${this.base}/estoque/cascos/baixas`, request);
  }

  relatorioEstoque(): Observable<RelatorioEstoque> {
    return this.http.get<RelatorioEstoque>(`${this.base}/relatorios/estoque`);
  }
}
