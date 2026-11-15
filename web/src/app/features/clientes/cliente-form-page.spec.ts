import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { ClienteFormPage } from './cliente-form-page';

const URL = '/api/clientes/v1/clientes';

async function montar() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
    ],
  });
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ClienteFormPage);
  fixture.detectChanges();
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    el,
    navegar,
    http: TestBed.inject(HttpTestingController),
    salvar: () => el.querySelector<HTMLButtonElement>('ce-barra-acao button')!,
    nome: async (v: string) => {
      const campo = el.querySelector('ce-input input') as HTMLInputElement;
      campo.value = v;
      campo.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    },
  };
}

describe('ClienteFormPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('renderiza o formulário com o botão salvar na barra de ação fixa', async () => {
    const t = await montar();
    expect(t.el.querySelector('ce-app-header h1')!.textContent).toContain('Novo cliente');
    expect(t.salvar().textContent).toContain('Cadastrar cliente');
  });

  it('clique no salvar da barra envia o payload e navega para o detalhe', async () => {
    const t = await montar();
    await t.nome(' Maria ');

    t.salvar().click();
    const req = t.http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nome: 'Maria', telefone: null, observacoes: null });
    req.flush({ id: 'c9', nome: 'Maria' });
    await t.fixture.whenStable();
    t.http.expectOne((r) => r.method === 'GET' && r.url === URL).flush([]);
    await t.fixture.whenStable();
    expect(t.navegar).toHaveBeenCalledWith('/clientes/c9');
  });

  it('nome vazio: não chama a API e mostra o erro', async () => {
    const t = await montar();

    t.salvar().click();
    await t.fixture.whenStable();
    t.fixture.detectChanges();

    t.http.expectNone(URL);
    expect(t.el.querySelector('[role="alert"]')!.textContent).toContain('Informe o nome');
  });
});
