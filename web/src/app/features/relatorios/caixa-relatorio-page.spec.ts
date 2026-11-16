import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigStore } from '../../core/config/app-config';
import { FakeStorage } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { CaixaRelatorioPage } from './caixa-relatorio-page';
import { periodoPadrao } from './periodo';

const URL = '/api/financeiro/v1/relatorios/caixa';
const PADRAO = periodoPadrao();
const RELATORIO = {
  dias: [
    {
      data: '2026-11-02',
      status: 'FECHADO',
      saldoInicial: 100,
      entradas: 300,
      saidas: 40,
      saldoFinal: 360,
    },
    {
      data: '2026-11-03',
      status: 'ABERTO',
      saldoInicial: 360,
      entradas: 50,
      saidas: 0,
      saldoFinal: null,
    },
  ],
  despesasPorTipo: [{ tipoDespesa: 'Luz', total: 40 }],
};

async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
}

const consulta = (http: HttpTestingController) => http.expectOne((r) => r.url === URL);

async function montar() {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: StorageService, useValue: new FakeStorage() },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(CaixaRelatorioPage);
  fixture.detectChanges();
  const inicial = consulta(http);
  expect(inicial.request.params.get('inicio')).toBe(PADRAO.inicio);
  expect(inicial.request.params.get('fim')).toBe(PADRAO.fim);
  inicial.flush(RELATORIO);
  await assentar(fixture);
  return { fixture, http, el: fixture.nativeElement as HTMLElement };
}

const celulas = (el: HTMLElement, seletor: string) =>
  Array.from(el.querySelectorAll(seletor)).map((tr) =>
    Array.from(tr.querySelectorAll('td')).map((td) =>
      (td.textContent ?? '').replace(/\s/g, ' ').trim(),
    ),
  );

describe('CaixaRelatorioPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('mostra os dias e as despesas por tipo exatamente como o servidor devolveu', async () => {
    const { el } = await montar();
    const linhas = celulas(el, '.tabela tbody tr');
    expect(linhas[0]).toEqual([
      '02/11/2026',
      'Fechado',
      'R$ 100,00',
      'R$ 300,00',
      'R$ 40,00',
      'R$ 360,00',
    ]);
    expect(linhas[1][1]).toBe('Aberto');
    expect(linhas[1][5]).toBe('—');
    expect(linhas[2]).toEqual(['Luz', 'R$ 40,00']);
    expect(el.querySelectorAll('.cards .card')).toHaveLength(3);
  });

  it('muda o período e busca com os valores escolhidos', async () => {
    const { fixture, http, el } = await montar();
    const [de, ate] = Array.from(
      el.querySelectorAll('ce-filtro-periodo input'),
    ) as HTMLInputElement[];
    de.value = '2026-10-01';
    de.dispatchEvent(new Event('input'));
    ate.value = '2026-10-31';
    ate.dispatchEvent(new Event('input'));
    await assentar(fixture);
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Buscar'))!
      .click();
    const req = consulta(http);
    expect(req.request.params.get('inicio')).toBe('2026-10-01');
    expect(req.request.params.get('fim')).toBe('2026-10-31');
    req.flush({ dias: [], despesasPorTipo: [] });
  });

  it('bloqueio: início depois do fim mostra a mensagem e não dispara requisição', async () => {
    const { fixture, http, el } = await montar();
    const [de, ate] = Array.from(
      el.querySelectorAll('ce-filtro-periodo input'),
    ) as HTMLInputElement[];
    de.value = '2026-10-31';
    de.dispatchEvent(new Event('input'));
    ate.value = '2026-10-01';
    ate.dispatchEvent(new Event('input'));
    await assentar(fixture);
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Buscar'))!
      .click();
    await assentar(fixture);
    http.verify();
    expect(el.textContent).toContain('A data inicial não pode ser depois da data final.');
  });
});
