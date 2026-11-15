import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { EstoqueApi } from '../../core/api/estoque-api';
import { TipoCascoRequest, TipoCascoResponse } from '../../core/api/models/estoque';

type Status = 'idle' | 'loading' | 'ok' | 'error';

const porNome = (a: TipoCascoResponse, b: TipoCascoResponse) => a.nome.localeCompare(b.nome);

@Injectable({ providedIn: 'root' })
export class TiposCascoStore {
  private readonly api = inject(EstoqueApi);

  private readonly statusInterno = signal<Status>('idle');
  private readonly tiposInterno = signal<TipoCascoResponse[]>([]);

  readonly status = this.statusInterno.asReadonly();
  readonly tipos = this.tiposInterno.asReadonly();

  async carregar(): Promise<void> {
    this.statusInterno.set('loading');
    try {
      this.tiposInterno.set(await firstValueFrom(this.api.listarTiposCasco()));
      this.statusInterno.set('ok');
    } catch {
      this.statusInterno.set('error');
    }
  }

  /** Lança ApiError (400/422) — a página trata inline. */
  async criar(req: TipoCascoRequest): Promise<void> {
    const novo = await firstValueFrom(this.api.criarTipoCasco(req));
    this.tiposInterno.update((l) => [...l, novo].sort(porNome));
  }

  async atualizar(id: string, req: TipoCascoRequest): Promise<void> {
    const atual = await firstValueFrom(this.api.atualizarTipoCasco(id, req));
    this.tiposInterno.update((l) => l.map((t) => (t.id === id ? atual : t)).sort(porNome));
  }
}
