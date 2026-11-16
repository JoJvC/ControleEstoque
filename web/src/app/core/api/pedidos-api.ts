import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ConfigStore } from '../config/app-config';
import {
  CancelarPedidoRequest,
  CriarPedidoRequest,
  IniciarPedidoRequest,
  PedidoResponse,
  PedidoResumoResponse,
  StatusPedido,
} from './models/pedidos';

@Injectable({ providedIn: 'root' })
export class PedidosApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigStore);

  private get base(): string {
    return `${this.config.apiBaseUrl}/vendas/v1/pedidos`;
  }

  /** O servidor devolve só o array, sem total. */
  listar(status: StatusPedido | null, page = 1, pageSize = 50): Observable<PedidoResumoResponse[]> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (status) {
      params = params.set('status', status);
    }
    return this.http.get<PedidoResumoResponse[]>(this.base, { params });
  }

  obter(id: string): Observable<PedidoResponse> {
    return this.http.get<PedidoResponse>(`${this.base}/${id}`);
  }

  criar(request: CriarPedidoRequest): Observable<PedidoResponse> {
    return this.http.post<PedidoResponse>(this.base, request);
  }

  iniciar(id: string, request: IniciarPedidoRequest): Observable<PedidoResponse> {
    return this.http.post<PedidoResponse>(`${this.base}/${id}/inicio`, request);
  }

  cancelar(id: string, request: CancelarPedidoRequest): Observable<PedidoResponse> {
    return this.http.post<PedidoResponse>(`${this.base}/${id}/cancelamento`, request);
  }
}
