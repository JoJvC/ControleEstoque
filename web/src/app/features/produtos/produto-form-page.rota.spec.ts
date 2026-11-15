import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { MediaService } from '../../core/platform/media-service';
import { ProdutoFormPage } from './produto-form-page';

const BASE = '/api/estoque/v1';

async function navegar(url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter(
        [
          { path: 'produtos/novo', component: ProdutoFormPage },
          { path: 'produtos/:id/editar', component: ProdutoFormPage },
          { path: 'produtos', children: [] },
        ],
        withComponentInputBinding(),
      ),
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: MediaService, useValue: {} },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  const http = TestBed.inject(HttpTestingController);
  harness.detectChanges();
  await harness.fixture.whenStable();
  http.expectOne(`${BASE}/marcas`).flush([]);
  return { harness, http, el: harness.routeNativeElement as HTMLElement };
}

function preencher(el: HTMLElement, nome: string) {
  const campo = el.querySelector('ce-input input') as HTMLInputElement;
  campo.value = nome;
  campo.dispatchEvent(new Event('input'));
  const tipo = el.querySelector('ce-select select') as HTMLSelectElement;
  tipo.value = 'DESCARTAVEL';
  tipo.dispatchEvent(new Event('change'));
}

describe('ProdutoFormPage com a rota (withComponentInputBinding)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('/produtos/novo: título "Novo produto", sem GET de carregamento e salvar chama criar', async () => {
    const t = await navegar('/produtos/novo');
    await t.harness.fixture.whenStable();
    t.http.expectNone((r) => r.method === 'GET' && r.url.includes('/produtos/'));
    expect(t.el.querySelector('ce-app-header h1')!.textContent).toContain('Novo produto');

    preencher(t.el, 'Copo 200ml');
    await t.harness.fixture.whenStable();
    t.harness.detectChanges();
    t.el.querySelector<HTMLButtonElement>('ce-barra-acao button')!.click();

    const req = t.http.expectOne(`${BASE}/produtos`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'p1' });
    await t.harness.fixture.whenStable();
    t.http.match((r) => r.method === 'GET').forEach((r) => r.flush([]));
  });

  it('/produtos/p7/editar: carrega o produto e salvar chama atualizar', async () => {
    const t = await navegar('/produtos/p7/editar');
    const get = t.http.expectOne(`${BASE}/produtos/p7`);
    get.flush({
      id: 'p7',
      tipo: 'DESCARTAVEL',
      nome: 'Copo',
      marcaId: null,
      categoria: null,
      tamanho: null,
      precoReferencia: 0,
      estoqueMinimo: 0,
    });
    await t.harness.fixture.whenStable();
    t.harness.detectChanges();
    expect(t.el.querySelector('ce-app-header h1')!.textContent).toContain('Editar produto');

    t.el.querySelector<HTMLButtonElement>('ce-barra-acao button')!.click();
    const req = t.http.expectOne(`${BASE}/produtos/p7`);
    expect(req.request.method).toBe('PUT');
    req.flush({ id: 'p7' });
    await t.harness.fixture.whenStable();
    t.http.match((r) => r.method === 'GET').forEach((r) => r.flush([]));
  });
});
