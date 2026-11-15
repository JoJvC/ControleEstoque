import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
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
    adicionar: () => el.querySelector<HTMLButtonElement>('ce-barra-acao button')!,
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

  it('renderiza a lista de marcas e o botão Adicionar na barra de ação fixa', async () => {
    const t = await montar();
    expect(t.el.textContent).toContain('Indaiá');
    expect(t.adicionar().textContent).toContain('Adicionar');
  });

  it('clique em Adicionar envia { nome } à API e fica desabilitado até responder', async () => {
    const t = await montar();
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
    expect((t.el.querySelector('ce-input input') as HTMLInputElement).value).toBe('');
    expect(t.adicionar().disabled).toBe(true); // campo limpo: inválido de novo
  });

  it('nome vazio: botão desabilitado e clique não chama a API', async () => {
    const t = await montar();
    expect(t.adicionar().disabled).toBe(true);

    t.adicionar().click();
    await t.fixture.whenStable();

    t.http.expectNone(BASE);
  });

  it('habilita o botão quando há nome digitado', async () => {
    const t = await montar();
    await t.digitar('Crystal');
    t.fixture.detectChanges();

    expect(t.adicionar().disabled).toBe(false);
  });
});
