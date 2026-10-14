import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ConfigStore } from '../config/app-config';
import { CargoResponse, CreateCargoRequest, FuncionarioResponse } from './models/rh';

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

  listarCargos(): Observable<CargoResponse[]> {
    return this.http.get<CargoResponse[]>(`${this.base}/cargos`);
  }

  criarCargo(request: CreateCargoRequest): Observable<CargoResponse> {
    return this.http.post<CargoResponse>(`${this.base}/cargos`, request);
  }
}
