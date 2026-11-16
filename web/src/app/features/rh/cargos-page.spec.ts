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
import { ICONES } from '../../ui/atoms/icon';
import { lerPadraoPagina, reenviarForm } from '../../ui/organisms/padrao-pagina.testing';
import { CargosPage } from './cargos-page';
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

  it('criar: + Novo, nome, checkbox e Salvar do cabeçalho enviam o POST', async () => {
    const t = await montar(['rh.gerir']);
    t.botao('+ Novo')!.click();
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
    expect(adm.querySelector('button')!.disabled).toBe(true);
    expect(adm.textContent).not.toContain('Editar');
    expect(t.el.querySelectorAll('li button:not([disabled])').length).toBe(1);
  });

  it('ícone cadeado e chip nativo no cargo nativo; ícone rh no não nativo', async () => {
    const t = await montar(['rh.gerir']);
    const linhas = Array.from(t.el.querySelectorAll('li'));
    const d = (li: Element) => li.querySelector('.icone-tipo svg path')!.getAttribute('d');
    const adm = linhas.find((l) => l.textContent?.includes('ADM'))!;
    const caixa = linhas.find((l) => l.textContent?.includes('Caixa'))!;
    expect(d(adm)).toBe(ICONES.cadeado[0]);
    expect(adm.querySelector('ce-badge')!.textContent).toContain('nativo');
    expect(d(caixa)).toBe(ICONES.rh[0]);
    expect(caixa.querySelector('ce-badge')).toBeNull();
    expect(adm.textContent).toContain('Todas as permissões');
    // seção "Cargos" num único cartão, com as linhas dentro
    const cartao = t.el.querySelector('section.cartao')!;
    expect(cartao.querySelectorAll('li')).toHaveLength(2);
  });

  it('padrão de página: título Cargos, voltar e + Novo com aria-label, sem barra nem Cancelar', async () => {
    const t = await montar(['rh.gerir']);
    expect(t.el.querySelector('ce-app-header h1')!.textContent).toContain('Cargos');
    expect(lerPadraoPagina(t.el)).toEqual({
      cabecalhos: 1,
      voltar: true,
      acoes: ['+ Novo'],
      barras: 0,
      cancelar: 0,
    });
    expect(t.botao('+ Novo')!.getAttribute('aria-label')).toBe('Novo cargo');
  });

  it('+ Novo abre o formulário com título Novo cargo; voltar fecha sem chamar a API', async () => {
    const t = await montar(['rh.gerir']);
    t.botao('+ Novo')!.click();
    await assentar(t.fixture);
    expect(t.el.querySelector('ce-app-header h1')!.textContent).toContain('Novo cargo');
    expect(lerPadraoPagina(t.el).acoes).toEqual(['Salvar']);
    await t.nome('X');
    t.el.querySelector<HTMLButtonElement>('button[aria-label="Voltar"]')!.click();
    await assentar(t.fixture);
    expect(t.el.querySelector('form')).toBeNull();
    expect(t.el.querySelector('ce-app-header h1')!.textContent).toContain('Cargos');
    t.http.expectNone(URL);
  });

  it('editar abre o formulário com título Editar cargo', async () => {
    const t = await montar(['rh.gerir']);
    t.botao('Editar')!.click();
    await assentar(t.fixture);
    expect(t.el.querySelector('ce-app-header h1')!.textContent).toContain('Editar cargo');
  });

  it('embutido: cabeçalho de seção (h2, sem topo, sem onda e sem voltar)', async () => {
    configurar(['rh.gerir']);
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(CargosPage);
    fixture.componentRef.setInput('embutido', true);
    fixture.detectChanges();
    await assentar(fixture);
    http.expectOne(URL).flush([ADM]);
    await assentar(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('ce-app-header h2')!.textContent).toContain('Cargos');
    expect(el.querySelector('ce-app-header h1')).toBeNull();
    expect(el.querySelector('ce-app-header .topo--onda')).toBeNull();
    expect(lerPadraoPagina(el).voltar).toBe(false);
    expect(lerPadraoPagina(el).acoes).toEqual(['+ Novo']);
  });

  it('a ação do cabeçalho abre o formulário de criação', async () => {
    const t = await montar(['rh.gerir']);
    const botao = t.el.querySelector<HTMLButtonElement>('ce-app-header .cabecalho__acoes button')!;
    expect(botao.textContent).toContain('+ Novo');
    botao.click();
    await assentar(t.fixture);
    expect(t.el.querySelector('form')).not.toBeNull();
  });

  it('Enter: o form tem submitter oculto e acioná-lo envia o POST', async () => {
    const t = await montar(['rh.gerir']);
    t.botao('+ Novo')!.click();
    await assentar(t.fixture);
    await t.nome('Caixa');
    const submitter = t.el.querySelector<HTMLButtonElement>('form button[type="submit"]')!;
    expect(submitter.hidden).toBe(true);
    submitter.click();
    expect(t.http.expectOne(URL).request.method).toBe('POST');
  });

  it('Enter com o envio pendente não cria o cargo de novo', async () => {
    const t = await montar(['rh.gerir']);
    t.botao('+ Novo')!.click();
    await assentar(t.fixture);
    await t.nome('Caixa');
    t.botao('Salvar')!.click();
    const req = t.http.expectOne(URL);
    const submitter = reenviarForm(t.el);
    t.botao('Salvar')!.click(); // Salvar do cabeçalho de novo
    await assentar(t.fixture);
    t.http.expectNone(URL); // um só POST
    t.fixture.detectChanges();
    expect(submitter.disabled).toBe(true);
    req.flush({}, { status: 500, statusText: 'Erro' });
    await assentar(t.fixture);
    t.fixture.detectChanges();
    expect(submitter.disabled).toBe(false);
  });

  it('erro da API aparece em role=alert e o formulário continua aberto', async () => {
    const t = await montar(['rh.gerir']);
    t.botao('+ Novo')!.click();
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
    t.botao('+ Novo')!.click();
    await assentar(t.fixture);
    expect(t.el.querySelector('label')?.textContent).toContain('Nome');
    expect(t.el.querySelector('label input')).not.toBeNull();
    t.botao('Salvar')!.click();
    await assentar(t.fixture);
    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain('Informe o nome');
    t.http.verify();
  });

  it('sem rh.gerir: sem + Novo nem Editar', async () => {
    const t = await montar([]);
    expect(t.botao('+ Novo')).toBeUndefined();
    expect(t.botao('Editar')).toBeUndefined();
  });

  it('sem rh.gerir: clicar na linha não abre o formulário', async () => {
    const t = await montar([]);
    const linha = t.el.querySelectorAll<HTMLButtonElement>('li button')[1];
    expect(linha.disabled).toBe(true);
    linha.click();
    await assentar(t.fixture);
    expect(t.el.querySelector('form')).toBeNull();
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
