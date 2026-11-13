import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { FiadoPage } from './fiado-page';

const URL = '/api/financeiro/v1/relatorios/fiado';

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
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(FiadoPage);
  fixture.detectChanges();
  return { fixture, http, el: fixture.nativeElement as HTMLElement };
}

describe('FiadoPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sem filtro: busca sem query e mostra o saldo devedor em dinheiro', async () => {
    const { fixture, http, el } = montar();
    const req = http.expectOne(URL);
    expect(req.request.params.keys()).toEqual([]);
    req.flush([
      { clienteId: 'c1', nome: 'Mercado Sol', saldoDevedor: 150.75 },
      { clienteId: 'c2', nome: 'Bar Lua', saldoDevedor: 20 },
    ]);
    await assentar(fixture);
    expect(el.querySelector('ce-filtro-periodo')).toBeNull();
    const linhas = Array.from(el.querySelectorAll('.tabela tbody tr')).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) =>
        (td.textContent ?? '').replace(/\s/g, ' ').trim(),
      ),
    );
    expect(linhas).toEqual([
      ['Mercado Sol', 'R$ 150,75'],
      ['Bar Lua', 'R$ 20,00'],
    ]);
    expect(el.querySelectorAll('.cards .card')).toHaveLength(2);
    expect(el.textContent).not.toContain('casco');
  });

  it('lista vazia mostra o estado vazio', async () => {
    const { fixture, http, el } = montar();
    http.expectOne(URL).flush([]);
    await assentar(fixture);
    expect(el.textContent).toContain('Nenhum cliente com fiado em aberto');
  });

  it('erro mostra a mensagem e "Tentar de novo" busca de novo', async () => {
    const { fixture, http, el } = montar();
    http.expectOne(URL).flush({}, { status: 500, statusText: 'Erro' });
    await assentar(fixture);
    expect(el.textContent).toContain('Não foi possível carregar o relatório');
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Tentar de novo'))!
      .click();
    http.expectOne(URL).flush([]);
  });
});
