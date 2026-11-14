import { ColorSchemeService } from '../platform/color-scheme-service';
import { TemaSlug } from './theme-store';

/** Apoio de spec: esquema de cor em memória, sem consultar o aparelho nem o html. */
export class FakeColorScheme extends ColorSchemeService {
  escuro = false;
  aplicado: TemaSlug | null = null;
  private readonly listeners = new Set<(dark: boolean) => void>();

  override prefersDark(): boolean {
    return this.escuro;
  }

  override onChange(listener: (dark: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  override applyTheme(slug: TemaSlug): void {
    this.aplicado = slug;
  }

  /** Simula o aparelho trocando o modo. */
  emitir(dark: boolean): void {
    this.escuro = dark;
    this.listeners.forEach((l) => l(dark));
  }
}
