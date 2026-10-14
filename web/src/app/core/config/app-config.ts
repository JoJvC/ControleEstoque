import { Injectable, inject, provideAppInitializer } from '@angular/core';

/**
 * Configuração carregada em RUNTIME de public/config.json — nunca em build.
 * Web: apiBaseUrl relativo ("/api", atendido pelo gateway/proxy).
 * Capacitor (futuro): o empacotamento troca o config.json por um com URL absoluta.
 */
export interface AppConfig {
  readonly apiBaseUrl: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigStore {
  private config: AppConfig | null = null;

  get apiBaseUrl(): string {
    if (this.config === null) {
      throw new Error('AppConfig não carregado — provideAppConfig() ausente do bootstrap?');
    }
    return this.config.apiBaseUrl;
  }

  async load(): Promise<void> {
    // fetch (e não HttpClient) para não passar pelos interceptors antes do app existir
    const response = await fetch('config.json');
    if (!response.ok) {
      throw new Error(`Falha ao carregar config.json (${response.status})`);
    }
    this.config = (await response.json()) as AppConfig;
  }
}

export function provideAppConfig() {
  return provideAppInitializer(() => inject(ConfigStore).load());
}
