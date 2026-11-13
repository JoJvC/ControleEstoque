import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Route,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';

import { ConfigStore } from '../config/app-config';
import { Operator, OperatorStore } from '../operator/operator-store';
import { PERMISSAO_TODAS, PERMISSOES } from './permissoes';
import { StorageService } from '../platform/storage-service';

/** Apoio de spec: armazenamento em memória, sem tocar o localStorage. */
export class FakeStorage extends StorageService {
  private readonly data = new Map<string, unknown>();

  override get<T>(key: string): T | null {
    return (this.data.get(key) as T | undefined) ?? null;
  }

  override set(key: string, value: unknown): void {
    this.data.set(key, value);
  }

  override remove(key: string): void {
    this.data.delete(key);
  }
}

export function operador(permissoes: string[]): Operator {
  return { id: 'f1', nome: 'Maria', cargoId: 'c1', cargoNome: 'Vendedor', permissoes };
}

/** Falha se o spec usar chave fora do catálogo: '*' libera qualquer string e esconderia um typo. */
export function operadorValido(permissoes: string[]): Operator {
  const fora = permissoes.filter(
    (p) => p !== PERMISSAO_TODAS && !PERMISSOES.some((c) => c.chave === p),
  );
  if (fora.length) throw new Error(`chave fora do catálogo: ${fora.join(', ')}`);
  return operador(permissoes);
}

/** Apoio de spec de rotas: roda o `canActivate` da rota com um operador de `permissoes`. */
export function rodarGuardDaRota(route: Route, permissoes: string[]): ReturnType<CanActivateFn> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: StorageService, useValue: new FakeStorage() },
    ],
  });
  TestBed.inject(OperatorStore).select(operador(permissoes));
  const guard = route.canActivate![0] as CanActivateFn;
  return TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
}
