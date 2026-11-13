import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ConfigStore } from '../config/app-config';
import {
  CargoResponse,
  CreateCargoRequest,
  CreateFuncionarioRequest,
  ExtratoResponse,
  FuncionarioResponse,
  LancamentoContaRequest,
  SaldoContaResponse,
} from './models/rh';

@Injectable({ providedIn: 'root' })
export class RhApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigStore);

  private get base(): string {
    return `${this.config.apiBaseUrl}/rh/v1`;
  }

  listarFuncionarios(): Observable<FuncionarioResponse[]> {
    return this.http.get<FuncionarioResponse[]>(`${this.base}/funcionarios`);
  }

  obterFuncionario(id: string): Observable<FuncionarioResponse> {
    return this.http.get<FuncionarioResponse>(`${this.base}/funcionarios/${id}`);
  }

  criarFuncionario(request: CreateFuncionarioRequest): Observable<FuncionarioResponse> {
    return this.http.post<FuncionarioResponse>(`${this.base}/funcionarios`, request);
  }

  atualizarFuncionario(
    id: string,
    request: CreateFuncionarioRequest,
  ): Observable<FuncionarioResponse> {
    return this.http.put<FuncionarioResponse>(`${this.base}/funcionarios/${id}`, request);
  }

  obterContaCorrente(id: string): Observable<ExtratoResponse> {
    return this.http.get<ExtratoResponse>(`${this.base}/funcionarios/${id}/conta-corrente`);
  }

  lancarVale(id: string, request: LancamentoContaRequest): Observable<SaldoContaResponse> {
    return this.http.post<SaldoContaResponse>(`${this.base}/funcionarios/${id}/vales`, request);
  }

  lancarPagamento(id: string, request: LancamentoContaRequest): Observable<SaldoContaResponse> {
    return this.http.post<SaldoContaResponse>(
      `${this.base}/funcionarios/${id}/pagamentos`,
      request,
    );
  }

  listarCargos(): Observable<CargoResponse[]> {
    return this.http.get<CargoResponse[]>(`${this.base}/cargos`);
  }

  criarCargo(request: CreateCargoRequest): Observable<CargoResponse> {
    return this.http.post<CargoResponse>(`${this.base}/cargos`, request);
  }

  atualizarCargo(id: string, request: CreateCargoRequest): Observable<CargoResponse> {
    return this.http.put<CargoResponse>(`${this.base}/cargos/${id}`, request);
  }
}
