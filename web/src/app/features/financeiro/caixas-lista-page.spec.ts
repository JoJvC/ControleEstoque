import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { hojeLocal } from '../../core/util/data-local';
import { CaixasListaPage } from './caixas-lista-page';

const URL = '/api/financeiro/v1/caixas';
const item = (id: string, data: string, extra: object = {}) => ({
  id,
  data,
  status: 'FECHADO',
  fechadoPeloSistema: false,
  diariasPendentes: false,
  saldoInicial: 100,
  totalEntradas: 300,
  totalSaidas: 50,
  saldoFinal: 350,
  dinheiroNaGaveta: 350,
  ...extra,
});

async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
}

async function montar() {
  const router = { navigateByUrl: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: Router, useValue: router },
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(CaixasListaPage);
  fixture.detectChanges();
  await assentar(fixture);
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, http, router, el };
}

describe('CaixasListaPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('o GET inicial traz os últimos 30 dias até hoje', async () => {
    const { http } = await montar();
    const req = http.expectOne((r) => r.url === URL);
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 30);
    expect(req.request.params.get('inicio')).toBe(hojeLocal(inicio));
    expect(req.request.params.get('fim')).toBe(hojeLocal());
    req.flush([]);
  });

  it('linhas da data mais recente para a mais antiga, com selos conforme as flags', async () => {
    const { fixture, http, el } = await montar();
    http
      .expectOne((r) => r.url === URL)
      .flush([
        item('cx-1', '2026-11-13'),
        item('cx-3', '2026-11-15', { fechadoPeloSistema: true, diariasPendentes: true }),
        item('cx-2', '2026-11-14', { fechadoPeloSistema: true }),
      ]);
    await assentar(fixture);
    const linhas = Array.from(el.querySelectorAll('ce-list-item')).map((l) =>
      (l.textContent ?? '').replace(/\s+/g, ' '),
    );
    expect(linhas.map((l) => l.slice(0, 10))).toEqual(['15/11/2026', '14/11/2026', '13/11/2026']);
    expect(linhas[0]).toContain('Fechado pelo sistema');
    expect(linhas[0]).toContain('Diárias pendentes');
    expect(linhas[1]).toContain('Fechado pelo sistema');
    expect(linhas[1]).not.toContain('Diárias pendentes');
    expect(linhas[2]).not.toContain('Fechado pelo sistema');
    expect(linhas[0]).toContain('R$ 350,00');
  });

  it('trocar o período e clicar Buscar refaz o GET com as novas datas', async () => {
    const { fixture, http, el } = await montar();
    http.expectOne((r) => r.url === URL).flush([]);
    await assentar(fixture);
    const [de, ate] = Array.from(el.querySelectorAll('ce-input input')) as HTMLInputElement[];
    for (const [campo, valor] of [
      [de, '2026-10-01'],
      [ate, '2026-10-31'],
    ] as const) {
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    (
      Array.from(el.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Buscar',
      ) as HTMLButtonElement
    ).click();
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.get('inicio')).toBe('2026-10-01');
    expect(req.request.params.get('fim')).toBe('2026-10-31');
    req.flush([]);
    await assentar(fixture);
    expect(el.textContent).toContain('Nenhum caixa no período');
  });

  it('clicar numa linha navega para /financeiro/caixas/:id', async () => {
    const { fixture, http, router, el } = await montar();
    http.expectOne((r) => r.url === URL).flush([item('cx-9', '2026-11-15')]);
    await assentar(fixture);
    (el.querySelector('ce-list-item button') as HTMLButtonElement).click();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/financeiro/caixas/cx-9');
  });

  it('erro na API mostra o estado de erro e Tentar de novo refaz o GET', async () => {
    const { fixture, http, el } = await montar();
    http
      .expectOne((r) => r.url === URL)
      .flush({ code: 'ERRO', message: 'x', traceId: 't' }, { status: 500, statusText: 'Erro' });
    await assentar(fixture);
    expect(el.textContent).toContain('Não foi possível carregar os caixas');
    (
      Array.from(el.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Tentar de novo',
      ) as HTMLButtonElement
    ).click();
    http.expectOne((r) => r.url === URL).flush([]);
  });
});
