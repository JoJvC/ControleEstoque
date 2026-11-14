import { Injectable, inject, provideAppInitializer, signal } from '@angular/core';

import { ColorSchemeService } from '../platform/color-scheme-service';
import { StorageService } from '../platform/storage-service';

export type TemaSlug = 'oceano' | 'uva' | 'carvao' | 'noite';
export type TemaEscolha = 'automatico' | TemaSlug;

const STORAGE_KEY = 'ce.tema';
const ESCOLHAS: readonly TemaEscolha[] = ['automatico', 'oceano', 'uva', 'carvao', 'noite'];

/** Ausente ou inválido vale Automático. */
export function lerEscolha(valor: unknown): TemaEscolha {
  return ESCOLHAS.find((e) => e === valor) ?? 'automatico';
}

export function resolverTema(escolha: TemaEscolha, prefereEscuro: boolean): TemaSlug {
  if (escolha === 'automatico') {
    return prefereEscuro ? 'noite' : 'oceano';
  }
  return escolha;
}

/** Tema do aparelho: guardado via StorageService, aplicado no <html> via ColorSchemeService. */
@Injectable({ providedIn: 'root' })
export class ThemeStore {
  private readonly storage = inject(StorageService);
  private readonly colorScheme = inject(ColorSchemeService);

  private readonly _escolha = signal<TemaEscolha>('automatico');
  private readonly _aplicado = signal<TemaSlug>('oceano');

  readonly escolha = this._escolha.asReadonly();
  readonly aplicado = this._aplicado.asReadonly();

  escolher(escolha: TemaEscolha): void {
    this._escolha.set(escolha);
    this.storage.set(STORAGE_KEY, escolha);
    this.aplicar();
  }

  iniciar(): void {
    this._escolha.set(lerEscolha(this.storage.get<unknown>(STORAGE_KEY)));
    this.aplicar();
    this.colorScheme.onChange((escuro) => {
      if (this._escolha() === 'automatico') {
        this.aplicar(escuro);
      }
    });
  }

  private aplicar(escuro = this.colorScheme.prefersDark()): void {
    const slug = resolverTema(this._escolha(), escuro);
    this._aplicado.set(slug);
    this.colorScheme.applyTheme(slug);
  }
}

export function provideTheme() {
  return provideAppInitializer(() => inject(ThemeStore).iniciar());
}
