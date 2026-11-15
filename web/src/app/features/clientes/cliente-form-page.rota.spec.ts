import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { ClienteFormPage } from './cliente-form-page';

const URL = '/api/clientes/v1/clientes';

async function navegar(url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        [
          { path: 'clientes/novo', component: ClienteFormPage },
          { path: 'clientes/:id/editar', component: ClienteFormPage },
          { path: 'clientes/:id', children: [] },
        ],
        withComponentInputBinding(),
      ),
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  harness.detectChanges();
  await harness.fixture.whenStable();
  return {
    harness,
    http: TestBed.inject(HttpTestingController),
    el: harness.routeNativeElement as HTMLElement,
  };
}

describe('ClienteFormPage com a rota (withComponentInputBinding)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('/clientes/novo: título "Novo cliente", sem GET de carregamento e salvar chama criar', async () => {
    const t = await navegar('/clientes/novo');
    t.http.expectNone((r) => r.method === 'GET');
    expect(t.el.querySelector('ce-app-header h1')!.textContent).toContain('Novo cliente');

    const campo = t.el.querySelector('ce-input input') as HTMLInputElement;
    campo.value = 'Maria';
    campo.dispatchEvent(new Event('input'));
    await t.harness.fixture.whenStable();
    t.el.querySelector<HTMLButtonElement>('ce-barra-acao button')!.click();

    const req = t.http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'c9', nome: 'Maria' });
    await t.harness.fixture.whenStable();
    t.http.match((r) => r.method === 'GET').forEach((r) => r.flush([]));
  });

  it('/clientes/c7/editar: carrega o cliente e salvar chama atualizar', async () => {
    const t = await navegar('/clientes/c7/editar');
    t.http
      .expectOne(`${URL}/c7`)
      .flush({ id: 'c7', nome: 'João', telefone: null, observacoes: null });
    await t.harness.fixture.whenStable();
    t.harness.detectChanges();
    expect(t.el.querySelector('ce-app-header h1')!.textContent).toContain('Editar cliente');

    t.el.querySelector<HTMLButtonElement>('ce-barra-acao button')!.click();
    const req = t.http.expectOne(`${URL}/c7`);
    expect(req.request.method).toBe('PUT');
    req.flush({ id: 'c7', nome: 'João' });
    await t.harness.fixture.whenStable();
    t.http.match((r) => r.method === 'GET').forEach((r) => r.flush([]));
  });
});
