import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { CreateFuncionarioRequest, FuncionarioResponse } from '../../core/api/models/rh';
import { RhApi } from '../../core/api/rh-api';

type Status = 'idle' | 'loading' | 'ok' | 'error';

@Injectable({ providedIn: 'root' })
export class FuncionariosStore {
  private readonly api = inject(RhApi);

  private readonly statusInterno = signal<Status>('idle');
  private readonly funcionariosInterno = signal<FuncionarioResponse[]>([]);

  readonly status = this.statusInterno.asReadonly();
  readonly funcionarios = this.funcionariosInterno.asReadonly();

  async carregar(): Promise<void> {
    this.statusInterno.set('loading');
    try {
      this.funcionariosInterno.set(await firstValueFrom(this.api.listarFuncionarios()));
      this.statusInterno.set('ok');
    } catch {
      this.statusInterno.set('error');
    }
  }

  obter(id: string): Promise<FuncionarioResponse> {
    return firstValueFrom(this.api.obterFuncionario(id));
  }

  async criar(req: CreateFuncionarioRequest): Promise<void> {
    const novo = await firstValueFrom(this.api.criarFuncionario(req));
    this.funcionariosInterno.update((l) => [...l, novo]);
    await this.recarregarLista();
  }

  async atualizar(id: string, req: CreateFuncionarioRequest): Promise<FuncionarioResponse> {
    const atual = await firstValueFrom(this.api.atualizarFuncionario(id, req));
    const havia = this.funcionariosInterno().length > 0;
    this.funcionariosInterno.update((l) => l.map((f) => (f.id === id ? atual : f)));
    if (havia) await this.recarregarLista();
    return atual;
  }

  // POST/PUT devolvem cargo null; o GET da lista traz o nome. Falha aqui mantém a resposta já inserida.
  private async recarregarLista(): Promise<void> {
    try {
      this.funcionariosInterno.set(await firstValueFrom(this.api.listarFuncionarios()));
    } catch {
      // mantém a lista atual
    }
  }
}
