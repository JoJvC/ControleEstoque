import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { CargoResponse, FuncionarioResponse } from '../../core/api/models/rh';
import { ConfigStore } from '../../core/config/app-config';
import { Operator, OperatorStore } from '../../core/operator/operator-store';
import { StorageService } from '../../core/platform/storage-service';
import { SelectOperatorPage } from './select-operator-page';

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

const FUNCIONARIOS: FuncionarioResponse[] = [
  {
    id: 'f1',
    nome: 'Maria Silva',
    telefone: null,
    cargoId: 'c1',
    cargo: 'Vendedor',
    valorDiaria: 0,
    ativo: true,
  },
  {
    id: 'f2',
    nome: 'João Souza',
    telefone: null,
    cargoId: 'c-removido',
    cargo: null,
    valorDiaria: 0,
    ativo: true,
  },
];
const CARGOS: CargoResponse[] = [
  { id: 'c1', nome: 'Vendedor', nativo: false, permissoes: ['vendas.registrar'] },
];

async function abrirPagina(): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(SelectOperatorPage);
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/rh/v1/funcionarios').flush(FUNCIONARIOS);
  http.expectOne('/api/rh/v1/cargos').flush(CARGOS);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('SelectOperatorPage', () => {
  let storage: FakeStorage;

  beforeEach(() => {
    storage = new FakeStorage();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
        { provide: StorageService, useValue: storage },
      ],
    });
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('clique no funcionário grava as permissões do cargo no operador', async () => {
    const el = await abrirPagina();

    el.querySelectorAll<HTMLButtonElement>('.operador__item')[0].click();

    expect(TestBed.inject(OperatorStore).operator()?.permissoes).toEqual(['vendas.registrar']);
    expect(storage.get<Operator>('ce.operador')?.permissoes).toEqual(['vendas.registrar']);
  });

  it('cargo ausente resulta em permissoes []', async () => {
    const el = await abrirPagina();

    el.querySelectorAll<HTMLButtonElement>('.operador__item')[1].click();

    expect(TestBed.inject(OperatorStore).operator()?.permissoes).toEqual([]);
  });

  it('erro em cargos mostra o estado de erro', async () => {
    const fixture = TestBed.createComponent(SelectOperatorPage);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/rh/v1/funcionarios').flush(FUNCIONARIOS);
    http.expectOne('/api/rh/v1/cargos').flush('erro', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('.operador__retry')).not.toBeNull();
  });
});
