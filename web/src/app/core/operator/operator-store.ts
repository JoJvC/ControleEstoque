import { Injectable, computed, inject, signal } from '@angular/core';

import { StorageService } from '../platform/storage-service';

/**
 * Operador = funcionário usando o app agora. MVP sem auth de backend (plano §9):
 * alimenta funcionarioId das operações e, na F8, o permissionamento de UI.
 * Quando o backend ganhar login/JWT, esta store passa a ler o token.
 */
export interface Operator {
  readonly id: string;
  readonly nome: string;
  readonly cargoId: string;
  readonly cargoNome: string | null;
}

const STORAGE_KEY = 'ce.operador';

@Injectable({ providedIn: 'root' })
export class OperatorStore {
  private readonly storage = inject(StorageService);
  private readonly current = signal<Operator | null>(this.storage.get<Operator>(STORAGE_KEY));

  readonly operator = this.current.asReadonly();
  readonly isSelected = computed(() => this.current() !== null);

  select(operator: Operator): void {
    this.current.set(operator);
    this.storage.set(STORAGE_KEY, operator);
  }

  clear(): void {
    this.current.set(null);
    this.storage.remove(STORAGE_KEY);
  }
}
