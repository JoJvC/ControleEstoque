import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { StorageService } from '../../core/platform/storage-service';
import { CargosPage } from './cargos-page';
import { RhPage } from './rh-page';
import { RH_ROUTES } from './rh-routes';

const URL = '/api/rh/v1/cargos';
const ADM = { id: 'c0', nome: 'ADM', nativo: true, permissoes: ['*'] };
const CAIXA = { id: 'c1', nome: 'Caixa', nativo: false, permissoes: ['vendas.registrar'] };

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

function operador(permissoes: string[]) {
  return { id: 'f1', nome: 'Maria', cargoId: 'c1', cargoNome: 'Gerente', permissoes };
}

async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
}

function configurar(permissoes: string[]) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: StorageService, useValue: new FakeStorage() },
    ],
  });
  TestBed.inject(OperatorStore).select(operador(permissoes));
}

async function montar(permissoes: string[]) {
  configurar(permissoes);
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(CargosPage);
  fixture.detectChanges();
  await assentar(fixture);
  http.expectOne(URL).flush([ADM, CAIXA]);
  await assentar(fixture);
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    http,
    el,
    botao: (texto: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(texto)) as
        HTMLButtonElement | undefined,
    nome: async (v: string) => {
      const campo = el.querySelector('ce-input input') as HTMLInputElement;
      campo.value = v;
      campo.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    },
    marcar: async (rotulo: string) => {
      const l = Array.from(el.querySelectorAll('ce-checkbox')).find((c) =>
        c.textContent?.includes(rotulo),
      )!;
      (l.querySelector('input') as HTMLInputElement).click();
      await fixture.whenStable();
    },
  };
}

describe('CargosPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('criar: Novo cargo, nome, checkbox e Salvar enviam o POST', async () => {
    const t = await montar(['rh.gerir']);
    t.botao('Novo cargo')!.click();
    await assentar(t.fixture);
    await t.nome('Caixa');
    await t.marcar('Registrar vendas');
    t.botao('Salvar')!.click();
    const req = t.http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nome: 'Caixa', permissoes: ['vendas.registrar'] });
    req.flush(CAIXA, { status: 201, statusText: 'Created' });
    await assentar(t.fixture);
    expect(t.el.querySelector('form')).toBeNull();
  });

  it('editar: marcar Fechar caixa envia o PUT', async () => {
    const t = await montar(['rh.gerir']);
    t.botao('Editar')!.click();
    await assentar(t.fixture);
    await t.marcar('Fechar o caixa');
    t.botao('Salvar')!.click();
    const req = t.http.expectOne(`${URL}/c1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      nome: 'Caixa',
      permissoes: ['vendas.registrar', 'caixa.fechar'],
    });
    req.flush({ ...CAIXA, permissoes: req.request.body.permissoes });
    await assentar(t.fixture);
  });

  it('linha nativa: badge e sem Editar', async () => {
    const t = await montar(['rh.gerir']);
    const linhas = Array.from(t.el.querySelectorAll('li'));
    const adm = linhas.find((l) => l.textContent?.includes('ADM'))!;
    expect(adm.textContent).toContain('nativo');
    expect(adm.querySelector('button')).toBeNull();
    expect(t.el.querySelectorAll('li button').length).toBe(1);
  });

  it('erro da API aparece em role=alert e o formulário continua aberto', async () => {
    const t = await montar(['rh.gerir']);
    t.botao('Novo cargo')!.click();
    await assentar(t.fixture);
    await t.nome('X');
    t.botao('Salvar')!.click();
    t.http
      .expectOne(URL)
      .flush(
        { code: 'NOME_OBRIGATORIO', message: 'Nome obrigatório', traceId: 't' },
        { status: 400, statusText: 'Bad Request' },
      );
    await assentar(t.fixture);
    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain('Nome obrigatório');
    expect(t.el.querySelector('form')).not.toBeNull();
  });

  it('nome com rótulo associado e erro inline sem requisição quando vazio', async () => {
    const t = await montar(['rh.gerir']);
    t.botao('Novo cargo')!.click();
    await assentar(t.fixture);
    expect(t.el.querySelector('label')?.textContent).toContain('Nome');
    expect(t.el.querySelector('label input')).not.toBeNull();
    t.botao('Salvar')!.click();
    await assentar(t.fixture);
    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain('Informe o nome');
    t.http.verify();
  });

  it('sem rh.gerir: sem Novo cargo nem Editar', async () => {
    const t = await montar([]);
    expect(t.botao('Novo cargo')).toBeUndefined();
    expect(t.botao('Editar')).toBeUndefined();
  });
});

describe('rota /rh/cargos', () => {
  function rodar() {
    const guard = RH_ROUTES.find((r) => r.path === 'cargos')!.canActivate![0] as (
      r: ActivatedRouteSnapshot,
      s: RouterStateSnapshot,
    ) => unknown;
    return TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  it('libera com rh.gerir', () => {
    configurar(['rh.gerir']);
    expect(rodar()).toBe(true);
  });

  it('sem rh.gerir: UrlTree para /', () => {
    configurar([]);
    const resultado = rodar();
    expect(resultado).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(resultado as UrlTree)).toBe('/');
  });
});

describe('RhPage', () => {
  it('mostra Cargos com link para /rh/cargos só com rh.gerir', () => {
    configurar(['rh.gerir']);
    let f = TestBed.createComponent(RhPage);
    f.detectChanges();
    const a = (f.nativeElement as HTMLElement).querySelector('a[href="/rh/cargos"]')!;
    expect(a.textContent).toContain('Cargos');
    TestBed.inject(OperatorStore).select(operador([]));
    f = TestBed.createComponent(RhPage);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('a')).toBeNull();
  });
});
