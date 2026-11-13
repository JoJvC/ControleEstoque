import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import { CargoResponse } from '../api/models/rh';
import { ConfigStore } from '../config/app-config';
import { Operator, OperatorStore } from '../operator/operator-store';
import { StorageService } from '../platform/storage-service';
import { ToastService } from '../toast/toast-service';
import { CePermissao } from './ce-permissao';
import { permissaoGuard } from './permissao-guard';
import { PermissionService } from './permission-service';

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

const URL_CARGOS = '/api/rh/v1/cargos';

function operador(permissoes: string[]): Operator {
  return { id: 'f1', nome: 'Maria', cargoId: 'c1', cargoNome: 'Vendedor', permissoes };
}

@Component({
  imports: [CePermissao],
  template: `<p *cePermissao="'vendas.registrar'" class="alvo">ok</p>`,
})
class HostTeste {}

describe('permissões de UI', () => {
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
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  describe('has', () => {
    it('com a permissão → true; sem ela → false', () => {
      TestBed.inject(OperatorStore).select(operador(['vendas.registrar']));
      const service = TestBed.inject(PermissionService);
      expect(service.has('vendas.registrar')).toBe(true);
      expect(service.has('caixa.fechar')).toBe(false);
    });

    it("com '*' → true", () => {
      TestBed.inject(OperatorStore).select(operador(['*']));
      expect(TestBed.inject(PermissionService).has('qualquer.coisa')).toBe(true);
    });

    it('sem operador → false', () => {
      expect(TestBed.inject(PermissionService).has('vendas.registrar')).toBe(false);
    });
  });

  describe('*cePermissao', () => {
    it('renderiza com permissão, esconde sem ela e alterna ao atualizar', async () => {
      const store = TestBed.inject(OperatorStore);
      store.select(operador([]));
      const fixture = TestBed.createComponent(HostTeste);
      const alvo = () => (fixture.nativeElement as HTMLElement).querySelector('.alvo');

      await fixture.whenStable();
      expect(alvo()).toBeNull();

      store.atualizarPermissoes(['vendas.registrar']);
      await fixture.whenStable();
      expect(alvo()).not.toBeNull();

      store.atualizarPermissoes([]);
      await fixture.whenStable();
      expect(alvo()).toBeNull();
    });

    it('não recria a view quando as permissões mudam mas has continua true', async () => {
      const store = TestBed.inject(OperatorStore);
      store.select(operador(['vendas.registrar']));
      const fixture = TestBed.createComponent(HostTeste);
      const alvo = () => (fixture.nativeElement as HTMLElement).querySelector('.alvo');
      await fixture.whenStable();
      const antes = alvo();

      store.atualizarPermissoes(['vendas.registrar', 'caixa.fechar']);
      await fixture.whenStable();

      expect(antes).not.toBeNull();
      expect(alvo()).toBe(antes);
    });

    it('renderiza de início quando o operador já tem a permissão', async () => {
      TestBed.inject(OperatorStore).select(operador(['vendas.registrar']));
      const fixture = TestBed.createComponent(HostTeste);
      await fixture.whenStable();
      expect((fixture.nativeElement as HTMLElement).querySelector('.alvo')).not.toBeNull();
    });
  });

  describe('permissaoGuard', () => {
    function rodar(permissao: string): ReturnType<ReturnType<typeof permissaoGuard>> {
      return TestBed.runInInjectionContext(() =>
        permissaoGuard(permissao)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      );
    }

    it('libera quando tem a permissão', () => {
      TestBed.inject(OperatorStore).select(operador(['vendas.registrar']));
      expect(rodar('vendas.registrar')).toBe(true);
    });

    it('nega: UrlTree para / e toast de erro', () => {
      TestBed.inject(OperatorStore).select(operador([]));
      const resultado = rodar('vendas.registrar');
      expect(resultado).toBeInstanceOf(UrlTree);
      expect(TestBed.inject(Router).serializeUrl(resultado as UrlTree)).toBe('/');
      const toasts = TestBed.inject(ToastService).toasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].kind).toBe('error');
      expect(toasts[0].message).toBe('Sem permissão para acessar esta tela');
    });
  });

  describe('recarregar', () => {
    const cargos: CargoResponse[] = [
      { id: 'c1', nome: 'Vendedor', nativo: false, permissoes: ['caixa.fechar'] },
    ];

    it('atualiza as permissões do operador salvo', () => {
      const store = TestBed.inject(OperatorStore);
      store.select(operador(['velha']));

      TestBed.inject(PermissionService).recarregar();
      TestBed.inject(HttpTestingController).expectOne(URL_CARGOS).flush(cargos);

      expect(store.operator()?.permissoes).toEqual(['caixa.fechar']);
      expect(storage.get<Operator>('ce.operador')?.permissoes).toEqual(['caixa.fechar']);
    });

    it('com erro HTTP mantém as permissões anteriores', () => {
      const store = TestBed.inject(OperatorStore);
      store.select(operador(['velha']));

      TestBed.inject(PermissionService).recarregar();
      TestBed.inject(HttpTestingController)
        .expectOne(URL_CARGOS)
        .flush('erro', { status: 500, statusText: 'Server Error' });

      expect(store.operator()?.permissoes).toEqual(['velha']);
      expect(TestBed.inject(ToastService).toasts()).toHaveLength(0);
    });

    it('operador trocado durante a requisição: ignora a resposta', () => {
      const store = TestBed.inject(OperatorStore);
      store.select(operador(['velha']));

      TestBed.inject(PermissionService).recarregar();
      store.select({ ...operador(['outra']), id: 'f2' });
      TestBed.inject(HttpTestingController).expectOne(URL_CARGOS).flush(cargos);

      expect(store.operator()?.permissoes).toEqual(['outra']);
    });

    it('sem operador não faz requisição', () => {
      TestBed.inject(PermissionService).recarregar();
      TestBed.inject(HttpTestingController).expectNone(URL_CARGOS);
    });
  });
});
