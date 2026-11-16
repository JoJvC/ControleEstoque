import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { CascosPage } from './cascos-page';

const URL = '/api/clientes/v1/relatorios/cascos';

async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
}

function montar() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: OperatorStore, useValue: { permissoes: () => ['*'] } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(CascosPage);
  fixture.detectChanges();
  return { fixture, http, el: fixture.nativeElement as HTMLElement };
}

function linhas(el: HTMLElement): string[][] {
  return Array.from(el.querySelectorAll('.tabela tbody tr')).map((tr) =>
    Array.from(tr.querySelectorAll('td')).map((td) =>
      (td.textContent ?? '').replace(/\s+/g, ' ').trim(),
    ),
  );
}

describe('CascosPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('com dados mostra as linhas nos cards e na tabela', async () => {
    const { fixture, http, el } = montar();
    http.expectOne(URL).flush([
      { clienteId: 'c1', nome: 'Mercado Sol', saldoCascos: 5, cascosAFavor: 0 },
      { clienteId: 'c2', nome: 'Bar Lua', saldoCascos: 0, cascosAFavor: 2 },
    ]);
    await assentar(fixture);
    expect(linhas(el)).toEqual([
      ['Mercado Sol', '5'],
      ['Bar Lua', '0 + 2 a favor'],
    ]);
    expect(el.querySelectorAll('.cards .card')).toHaveLength(2);
    expect(el.textContent).not.toContain('R$');
  });

  it('lista vazia mostra o estado vazio', async () => {
    const { fixture, http, el } = montar();
    http.expectOne(URL).flush([]);
    await assentar(fixture);
    expect(el.textContent).toContain('Nenhum cliente com saldo de cascos');
  });

  it('erro mostra a mensagem e "Tentar de novo" busca de novo', async () => {
    const { fixture, http, el } = montar();
    http
      .expectOne(URL)
      .flush(
        { code: 'ERRO', message: 'falhou', traceId: 't' },
        { status: 500, statusText: 'Erro' },
      );
    await assentar(fixture);
    expect(el.textContent).toContain('Tentar de novo');
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Tentar de novo'))!
      .click();
    http.expectOne(URL).flush([]);
  });
});
