import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ConfigStore } from '../config/app-config';
import { PagamentoFiadoRequest, PagamentoFiadoResponse } from './models/financeiro';

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
}
