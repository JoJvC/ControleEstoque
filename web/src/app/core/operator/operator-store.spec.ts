import { TestBed } from '@angular/core/testing';

import { StorageService } from '../platform/storage-service';
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
};

function criarStore(storage: FakeStorage): OperatorStore {
  TestBed.configureTestingModule({
    providers: [{ provide: StorageService, useValue: storage }],
  });
  return TestBed.inject(OperatorStore);
}

describe('OperatorStore', () => {
  it('começa sem operador quando o storage está vazio', () => {
    const store = criarStore(new FakeStorage());
    expect(store.operator()).toBeNull();
    expect(store.isSelected()).toBe(false);
  });

  it('select expõe o operador e persiste no storage', () => {
    const storage = new FakeStorage();
    const store = criarStore(storage);

    store.select(OPERADOR);

    expect(store.operator()).toEqual(OPERADOR);
    expect(store.isSelected()).toBe(true);
    expect(storage.get<Operator>('ce.operador')).toEqual(OPERADOR);
  });

  it('restaura o operador persistido ao criar a store', () => {
    const storage = new FakeStorage();
    storage.set('ce.operador', OPERADOR);

    const store = criarStore(storage);

    expect(store.operator()).toEqual(OPERADOR);
  });

  it('clear remove o operador da store e do storage', () => {
    const storage = new FakeStorage();
    const store = criarStore(storage);
    store.select(OPERADOR);

    store.clear();

    expect(store.operator()).toBeNull();
    expect(storage.get<Operator>('ce.operador')).toBeNull();
  });
});
