import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { EstoqueApi } from '../../core/api/estoque-api';
import { MarcaResponse } from '../../core/api/models/estoque';

type Status = 'idle' | 'loading' | 'ok' | 'error';

@Injectable({ providedIn: 'root' })
export class MarcasStore {
  private readonly api = inject(EstoqueApi);

  private readonly marcasInterno = signal<MarcaResponse[]>([]);
  private readonly statusInterno = signal<Status>('idle');

  readonly marcas = this.marcasInterno.asReadonly();
  readonly status = this.statusInterno.asReadonly();

  carregar(): void {
    this.statusInterno.set('loading');
    this.api.listarMarcas().subscribe({
      next: (marcas) => {
        this.marcasInterno.set(marcas);
        this.statusInterno.set('ok');
      },
      error: () => this.statusInterno.set('error'),
    });
  }

  /** Lança ApiError (ex.: 409 nome duplicado) — a página trata inline. */
  async criar(nome: string): Promise<MarcaResponse> {
    const marca = await firstValueFrom(this.api.criarMarca({ nome }));
    this.marcasInterno.update((lista) =>
      [...lista, marca].sort((a, b) => a.nome.localeCompare(b.nome)),
    );
    return marca;
  }
}
