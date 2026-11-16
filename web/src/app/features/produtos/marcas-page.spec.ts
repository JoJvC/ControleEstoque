import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { lerPadraoPagina } from '../../ui/organisms/padrao-pagina.testing';
import { MarcasPage } from './marcas-page';

const BASE = '/api/estoque/v1/marcas';

async function montar() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(MarcasPage);
  fixture.detectChanges();
  await fixture.whenStable();
  http.expectOne(BASE).flush([{ id: 'm1', nome: 'Indaiá' }]);
  await fixture.whenStable();
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    el,
    http,
    adicionar: () => el.querySelector<HTMLButtonElement>('ce-app-header .cabecalho__acoes button')!,
    abrir: async () => {
      el.querySelector<HTMLButtonElement>('ce-app-header .cabecalho__acoes button')!.click();
      await fixture.whenStable();
      fixture.detectChanges();
    },
    voltar: async () => {
      el.querySelector<HTMLButtonElement>('button[aria-label="Voltar"]')!.click();
      await fixture.whenStable();
      fixture.detectChanges();
    },
    digitar: async (nome: string) => {
      const campo = el.querySelector('ce-input input') as HTMLInputElement;
      campo.value = nome;
      campo.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    },
  };
}

describe('MarcasPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('renderiza a lista de marcas com + Nova no cabeçalho, sem barra nem Cancelar', async () => {
    const t = await montar();
    expect(t.el.textContent).toContain('Indaiá');
    expect(lerPadraoPagina(t.el)).toEqual({
      cabecalhos: 1,
      voltar: true,
      acoes: ['+ Nova'],
      barras: 0,
      cancelar: 0,
    });
    expect(t.adicionar().getAttribute('aria-label')).toBe('Nova marca');
    expect(t.el.querySelector('ce-input')).toBeNull();
  });

  it('+ Nova abre o formulário com título Nova marca; voltar fecha sem chamar a API', async () => {
    const t = await montar();
    await t.abrir();
    expect(t.el.querySelector('ce-app-header h1')!.textContent).toContain('Nova marca');
    expect(lerPadraoPagina(t.el).acoes).toEqual(['Salvar']);
    await t.digitar('Crystal');
    await t.voltar();
    expect(t.el.querySelector('ce-input')).toBeNull();
    expect(t.el.querySelector('ce-app-header h1')!.textContent).toContain('Marcas');
    t.http.expectNone(BASE);
  });

  it('Salvar envia { nome } à API e fica desabilitado até responder', async () => {
    const t = await montar();
    await t.abrir();
    await t.digitar('  Crystal ');

    t.adicionar().click();
    const req = t.http.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nome: 'Crystal' });
    await t.fixture.whenStable();
    t.fixture.detectChanges();
    expect(t.adicionar().disabled).toBe(true);

    req.flush({ id: 'm2', nome: 'Crystal' });
    await new Promise((r) => setTimeout(r, 0));
    await t.fixture.whenStable();
    t.fixture.detectChanges();
    expect(t.el.textContent).toContain('Crystal');
    expect(t.el.querySelector('ce-input')).toBeNull(); // salvou: formulário fechado
  });

  it('nome vazio: Salvar desabilitado e clique não chama a API', async () => {
    const t = await montar();
    await t.abrir();
    expect(t.adicionar().disabled).toBe(true);

    t.adicionar().click();
    await t.fixture.whenStable();

    t.http.expectNone(BASE);
  });

  it('habilita o Salvar quando há nome digitado', async () => {
    const t = await montar();
    await t.abrir();
    await t.digitar('Crystal');
    t.fixture.detectChanges();

    expect(t.adicionar().disabled).toBe(false);
  });
});
