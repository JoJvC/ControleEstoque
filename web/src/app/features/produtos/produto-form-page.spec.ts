import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { MediaService } from '../../core/platform/media-service';
import { ProdutoFormPage } from './produto-form-page';

const BASE = '/api/estoque/v1';

async function montar() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: MediaService, useValue: {} },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ProdutoFormPage);
  fixture.detectChanges();
  await fixture.whenStable();
  http.expectOne(`${BASE}/marcas`).flush([]);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    el,
    http,
    navegar,
    salvar: () => el.querySelector<HTMLButtonElement>('ce-barra-acao button')!,
    preencher: async (nome: string) => {
      const campo = el.querySelector('ce-input input') as HTMLInputElement;
      campo.value = nome;
      campo.dispatchEvent(new Event('input'));
      const tipo = el.querySelector('ce-select select') as HTMLSelectElement;
      tipo.value = 'DESCARTAVEL';
      tipo.dispatchEvent(new Event('change'));
      await fixture.whenStable();
    },
  };
}

describe('ProdutoFormPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('renderiza o formulário com o botão salvar na barra de ação fixa', async () => {
    const t = await montar();
    expect(t.el.querySelector('ce-app-header h1')!.textContent).toContain('Novo produto');
    expect(t.salvar().textContent).toContain('Cadastrar produto');
  });

  it('clique no salvar da barra envia o mesmo payload e volta para /produtos', async () => {
    const t = await montar();
    await t.preencher('Copo 200ml');

    t.salvar().click();
    const req = t.http.expectOne(`${BASE}/produtos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      tipo: 'DESCARTAVEL',
      nome: 'Copo 200ml',
      marcaId: null,
      categoria: null,
      tamanho: null,
      precoReferencia: 0,
      estoqueMinimo: 0,
    });
    await t.fixture.whenStable();
    t.fixture.detectChanges();
    expect(t.salvar().disabled).toBe(true);

    req.flush({ id: 'p1' });
    await t.fixture.whenStable();
    t.http.expectOne((r) => r.method === 'GET' && r.url === `${BASE}/produtos`).flush([]);
    await t.fixture.whenStable();
    expect(t.navegar).toHaveBeenCalledWith('/produtos');
  });

  it('formulário inválido: botão desabilitado e clique não chama a API', async () => {
    const t = await montar();
    t.fixture.detectChanges();
    expect(t.salvar().disabled).toBe(true);

    t.salvar().click();
    await t.fixture.whenStable();

    t.http.expectNone(`${BASE}/produtos`);
  });

  it('habilita o botão quando nome e tipo estão preenchidos', async () => {
    const t = await montar();
    await t.preencher('Copo 200ml');
    t.fixture.detectChanges();

    expect(t.salvar().disabled).toBe(false);
  });
});
