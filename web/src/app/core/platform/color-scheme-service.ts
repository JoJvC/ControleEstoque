import { DOCUMENT, Injectable, inject } from '@angular/core';

import type { TemaSlug } from '../theme/theme-store';

/**
 * Único ponto do app que toca matchMedia e o <html> (regra Capacitor, plano §10).
 * Impl. futura para app nativo: troca só o provider.
 */
export abstract class ColorSchemeService {
  abstract prefersDark(): boolean;
  /** Avisa quando o aparelho troca claro/escuro; devolve a função que cancela. */
  abstract onChange(listener: (dark: boolean) => void): () => void;
  abstract applyTheme(slug: TemaSlug): void;
}

@Injectable()
export class WebColorSchemeService extends ColorSchemeService {
  private readonly document = inject(DOCUMENT);
  private readonly query =
    this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)') ?? null;

  override prefersDark(): boolean {
    return this.query?.matches ?? false;
  }

  override onChange(listener: (dark: boolean) => void): () => void {
    const query = this.query;
    if (!query) {
      return () => undefined;
    }
    const handler = (event: MediaQueryListEvent) => listener(event.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }

  override applyTheme(slug: TemaSlug): void {
    this.document.documentElement.setAttribute('data-tema', slug);
  }
}

export function provideColorScheme() {
  return { provide: ColorSchemeService, useClass: WebColorSchemeService };
}
