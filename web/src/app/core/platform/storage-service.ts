import { DOCUMENT, Injectable, inject } from '@angular/core';

/**
 * Único ponto do app que toca armazenamento local (regra Capacitor, plano §10).
 * Impl. futura para app nativo: @capacitor/preferences — troca só o provider.
 */
export abstract class StorageService {
  abstract get<T>(key: string): T | null;
  abstract set(key: string, value: unknown): void;
  abstract remove(key: string): void;
}

@Injectable()
export class LocalStorageService extends StorageService {
  private readonly storage = inject(DOCUMENT).defaultView?.localStorage ?? null;

  override get<T>(key: string): T | null {
    const raw = this.storage?.getItem(key);
    if (raw == null) {
      return null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  override set(key: string, value: unknown): void {
    this.storage?.setItem(key, JSON.stringify(value));
  }

  override remove(key: string): void {
    this.storage?.removeItem(key);
  }
}

export function provideStorage() {
  return { provide: StorageService, useClass: LocalStorageService };
}
