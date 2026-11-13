import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import { StorageService } from '../platform/storage-service';
import { operatorGuard } from './operator-guard';
import { Operator, OperatorStore } from './operator-store';

class FakeStorage extends StorageService {
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

const OPERADOR: Operator = {
  id: 'f1',
  nome: 'Maria Silva',
  cargoId: 'c1',
  cargoNome: 'ADM',
  permissoes: [],
};

function rodarGuard(): ReturnType<typeof operatorGuard> {
  return TestBed.runInInjectionContext(() =>
    operatorGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );
}

describe('operatorGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: StorageService, useValue: new FakeStorage() }],
    });
  });

  it('libera a rota quando há operador selecionado', () => {
    TestBed.inject(OperatorStore).select(OPERADOR);
    expect(rodarGuard()).toBe(true);
  });

  it('sem operador, redireciona para /operador', () => {
    const resultado = rodarGuard();
    expect(resultado).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(resultado as UrlTree)).toBe('/operador');
  });
});
