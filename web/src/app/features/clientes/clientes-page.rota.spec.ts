import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { ConfigStore } from '../../core/config/app-config';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { CLIENTES_ROUTES } from './clientes-routes';

const CLIENTES = '/api/clientes/v1/clientes';
const FIADO_REL = '/api/financeiro/v1/relatorios/fiado';
const CASCOS_REL = '/api/clientes/v1/relatorios/cascos';

async function navegar(url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'clientes', children: CLIENTES_ROUTES }], withComponentInputBinding()),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: StorageService, useValue: new FakeStorage() },
    ],
  });
  TestBed.inject(OperatorStore).select(operadorValido(['*']));
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  harness.detectChanges();
  await harness.fixture.whenStable();
  const http = TestBed.inject(HttpTestingController);
  return { harness, http, el: harness.routeNativeElement as HTMLElement };
}

async function responder(t: Awaited<ReturnType<typeof navegar>>, todos: object[] = []) {
  t.http.match((r) => r.url === CLIENTES).forEach((r) => r.flush(todos));
  t.http
    .match(FIADO_REL)
    .forEach((r) =>
      r.flush([{ clienteId: 'f', nome: 'Fátima', saldoDevedor: 42.5, saldo: -42.5 }]),
    );
  t.http
    .match(CASCOS_REL)
    .forEach((r) => r.flush([{ clienteId: 'c', nome: 'Caio', saldoCascos: 6, cascosAFavor: 0 }]));
  await t.harness.fixture.whenStable();
  t.harness.detectChanges();
}

const ativo = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('.pilula'))
    .filter((b) => b.getAttribute('aria-pressed') === 'true')
    .map((b) => b.textContent?.trim());
const nomes = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('ce-list-item .nome')).map((n) => n.textContent?.trim());

describe('ClientesPage com a rota (?filtro= via withComponentInputBinding)', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('/clientes?filtro=fiado: "Com fiado" ativo e a lista do relatório de fiado', async () => {
    const t = await navegar('/clientes?filtro=fiado');
    t.http.expectNone((r) => r.url === CLIENTES);
    await responder(t);
    expect(ativo(t.el)).toEqual(['Com fiado']);
    expect(nomes(t.el)).toEqual(['Fátima']);
  });

  it('/clientes?filtro=casco: "Com casco" ativo e a lista do relatório de cascos', async () => {
    const t = await navegar('/clientes?filtro=casco');
    await responder(t);
    expect(ativo(t.el)).toEqual(['Com casco']);
    expect(nomes(t.el)).toEqual(['Caio']);
  });

  it.each(['/clientes?filtro=xyz', '/clientes', '/clientes?filtro='])(
    '%s: abre em Todos',
    async (url) => {
      const t = await navegar(url);
      await responder(t, [
        { id: 'a', nome: 'Ana', telefone: null, observacoes: null, enderecos: [] },
      ]);
      expect(ativo(t.el)).toEqual(['Todos']);
      expect(nomes(t.el)).toEqual(['Ana']);
    },
  );

  it('trocar o chip reescreve a URL e mantém a página', async () => {
    const t = await navegar('/clientes');
    await responder(t);
    const antes = t.el.querySelector('ce-clientes-page');
    Array.from(t.el.querySelectorAll<HTMLButtonElement>('.pilula'))
      .find((b) => b.textContent?.includes('Com fiado'))!
      .click();
    await t.harness.fixture.whenStable();
    t.harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/clientes?filtro=fiado');
    expect(t.el.querySelector('ce-clientes-page')).toBe(antes);
    expect(nomes(t.el)).toEqual(['Fátima']);
  });

  it('buscar, abrir um cliente e voltar: a caixa mostra o termo da lista', async () => {
    const t = await navegar('/clientes');
    await responder(t);
    const campo = () => t.el.querySelector<HTMLInputElement>('input[type=text]')!;
    campo().value = 'an';
    campo().dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 350));
    t.http.match((r) => r.url === CLIENTES).forEach((r) => r.flush([]));

    await t.harness.navigateByUrl('/clientes/a');
    t.http.match(() => true).forEach((r) => r.flush(r.request.url.endsWith('/vendas') ? [] : {}));
    await t.harness.navigateByUrl('/clientes');
    t.harness.detectChanges();
    await t.harness.fixture.whenStable();
    t.http.match((r) => r.url === CLIENTES).forEach((r) => r.flush([]));
    expect(campo().value).toBe('an');
    expect(t.el.querySelector('button[aria-label="Limpar busca"]')).not.toBeNull();
    expect(t.el.textContent).toContain('Ninguém com “an”');
  });
});
