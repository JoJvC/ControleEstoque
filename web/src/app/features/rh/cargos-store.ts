import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { RhApi } from '../../core/api/rh-api';
import { CargoResponse, CreateCargoRequest } from '../../core/api/models/rh';

type Status = 'idle' | 'loading' | 'ok' | 'error';

@Injectable({ providedIn: 'root' })
export class CargosStore {
  private readonly api = inject(RhApi);

  private readonly statusInterno = signal<Status>('idle');
  private readonly cargosInterno = signal<CargoResponse[]>([]);

  readonly status = this.statusInterno.asReadonly();
  readonly cargos = this.cargosInterno.asReadonly();

  async carregar(): Promise<void> {
    this.statusInterno.set('loading');
    try {
      this.cargosInterno.set(await firstValueFrom(this.api.listarCargos()));
      this.statusInterno.set('ok');
    } catch {
      this.statusInterno.set('error');
    }
  }

  async criar(req: CreateCargoRequest): Promise<void> {
    const novo = await firstValueFrom(this.api.criarCargo(req));
    this.cargosInterno.update((l) => [...l, novo]);
  }

  async atualizar(id: string, req: CreateCargoRequest): Promise<void> {
    // trava em código do 422 CARGO_NATIVO
    if (this.cargosInterno().find((c) => c.id === id)?.nativo) {
      throw new Error('Cargo nativo não pode ser alterado');
    }
    const atual = await firstValueFrom(this.api.atualizarCargo(id, req));
    this.cargosInterno.update((l) => l.map((c) => (c.id === id ? atual : c)));
  }
}
