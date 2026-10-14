import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ConfigStore } from '../config/app-config';
import {
  CreateAbastecimentoRequest,
  CreateBaixaCascoRequest,
  CreateMarcaRequest,
  CreateMovimentoRequest,
  CreateProdutoRequest,
  CreatedResponse,
  EstoqueItemResponse,
  FotoResponse,
  MarcaResponse,
  ProdutoResponse,
  TipoProduto,
} from './models/estoque';

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

  enviarFoto(produtoId: string, foto: File): Observable<FotoResponse> {
    const form = new FormData();
    form.append('foto', foto, foto.name);
    return this.http.post<FotoResponse>(`${this.base}/produtos/${produtoId}/foto`, form);
  }

  /** URL da foto para usar direto em <img src>. */
  urlFoto(produtoId: string): string {
    return `${this.base}/produtos/${produtoId}/foto`;
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
}
