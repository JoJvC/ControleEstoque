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
  readonly permissoes: string[];
}

const STORAGE_KEY = 'ce.operador';

@Injectable({ providedIn: 'root' })
export class OperatorStore {
  private readonly storage = inject(StorageService);
  private readonly current = signal<Operator | null>(this.lerSalvo());

  readonly operator = this.current.asReadonly();
  readonly isSelected = computed(() => this.current() !== null);

  select(operator: Operator): void {
    this.current.set(operator);
    this.storage.set(STORAGE_KEY, operator);
  }

  atualizarPermissoes(permissoes: string[]): void {
    const atual = this.current();
    if (!atual) return;
    const atualizado = { ...atual, permissoes };
    this.current.set(atualizado);
    this.storage.set(STORAGE_KEY, atualizado);
  }

  clear(): void {
    this.current.set(null);
    this.storage.remove(STORAGE_KEY);
  }

  /** Registro salvo antes da F8a não tem `permissoes`: lê como sem permissão até recarregar. */
  private lerSalvo(): Operator | null {
    const salvo = this.storage.get<Operator>(STORAGE_KEY);
    if (!salvo) return null;
    return { ...salvo, permissoes: Array.isArray(salvo.permissoes) ? salvo.permissoes : [] };
  }
}
