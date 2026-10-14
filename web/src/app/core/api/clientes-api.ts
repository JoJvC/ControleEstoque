import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ConfigStore } from '../config/app-config';
import {
  ClienteResponse,
  ConversaoCascosRequest,
  ConversaoCascosResponse,
  CreateClienteRequest,
  CreateEnderecoRequest,
  DevolucaoCascosRequest,
  DevolucaoCascosResponse,
  EnderecoResponse,
  EntregaSucataRequest,
  EntregaSucataResponse,
  SaldosResponse,
} from './models/clientes';

@Injectable({ providedIn: 'root' })
export class ClientesApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigStore);

  private get base(): string {
    return `${this.config.apiBaseUrl}/clientes/v1`;
  }

  listar(nome: string, page: number, pageSize = 20): Observable<ClienteResponse[]> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (nome) {
      params = params.set('nome', nome);
    }
    return this.http.get<ClienteResponse[]>(`${this.base}/clientes`, { params });
  }

  obter(id: string): Observable<ClienteResponse> {
    return this.http.get<ClienteResponse>(`${this.base}/clientes/${id}`);
  }

  criar(request: CreateClienteRequest): Observable<ClienteResponse> {
    return this.http.post<ClienteResponse>(`${this.base}/clientes`, request);
  }

  atualizar(id: string, request: CreateClienteRequest): Observable<ClienteResponse> {
    return this.http.put<ClienteResponse>(`${this.base}/clientes/${id}`, request);
  }

  adicionarEndereco(
    clienteId: string,
    request: CreateEnderecoRequest,
  ): Observable<EnderecoResponse> {
    return this.http.post<EnderecoResponse>(
      `${this.base}/clientes/${clienteId}/enderecos`,
      request,
    );
  }

  obterSaldos(clienteId: string): Observable<SaldosResponse> {
    return this.http.get<SaldosResponse>(`${this.base}/clientes/${clienteId}/saldos`);
  }

  devolverCascos(
    clienteId: string,
    request: DevolucaoCascosRequest,
  ): Observable<DevolucaoCascosResponse> {
    return this.http.post<DevolucaoCascosResponse>(
      `${this.base}/clientes/${clienteId}/cascos/devolucoes`,
      request,
    );
  }

  converterCascos(
    clienteId: string,
    request: ConversaoCascosRequest,
  ): Observable<ConversaoCascosResponse> {
    return this.http.post<ConversaoCascosResponse>(
      `${this.base}/clientes/${clienteId}/cascos/conversoes`,
      request,
    );
  }

  entregarSucata(
    clienteId: string,
    request: EntregaSucataRequest,
  ): Observable<EntregaSucataResponse> {
    return this.http.post<EntregaSucataResponse>(
      `${this.base}/clientes/${clienteId}/sucatas`,
      request,
    );
  }
}
