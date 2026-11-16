import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigStore } from '../../core/config/app-config';
import { FakeStorage } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { periodoPadrao } from './periodo';
import { VendasPorFuncionarioPage } from './vendas-por-funcionario-page';

const URL = '/api/vendas/v1/relatorios/vendas-por-funcionario';
const PADRAO = periodoPadrao();
const LINHAS = [
  { funcionarioId: 'f1', nome: 'Ana', quantidadeVendas: 4, totalLiquido: 220.5 },
  { funcionarioId: 'f2', nome: 'Beto', quantidadeVendas: 1, totalLiquido: 30 },
];

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
  const fixture = TestBed.createComponent(VendasPorFuncionarioPage);
  fixture.detectChanges();
  const inicial = consulta(http);
  expect(inicial.request.params.get('inicio')).toBe(PADRAO.inicio);
  expect(inicial.request.params.get('fim')).toBe(PADRAO.fim);
  inicial.flush(LINHAS);
  await assentar(fixture);
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, http, el };
}

describe('VendasPorFuncionarioPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('mostra funcionário, vendas e total do servidor em cards e em tabela', async () => {
    const { el } = await montar();
    expect(el.querySelectorAll('.cards .card')).toHaveLength(2);
    const linhas = Array.from(el.querySelectorAll('.tabela tbody tr')).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) =>
        (td.textContent ?? '').replace(/\s/g, ' ').trim(),
      ),
    );
    expect(linhas).toEqual([
      ['Ana', '4', 'R$ 220,50'],
      ['Beto', '1', 'R$ 30,00'],
    ]);
  });

  it('muda o período e busca com os valores escolhidos', async () => {
    const { fixture, http, el } = await montar();
    const [de, ate] = Array.from(
      el.querySelectorAll('ce-filtro-periodo input'),
    ) as HTMLInputElement[];
    de.value = '2026-09-01';
    de.dispatchEvent(new Event('input'));
    ate.value = '2026-09-30';
    ate.dispatchEvent(new Event('input'));
    await assentar(fixture);
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Buscar'))!
      .click();
    const req = consulta(http);
    expect(req.request.params.get('inicio')).toBe('2026-09-01');
    expect(req.request.params.get('fim')).toBe('2026-09-30');
    req.flush([]);
    await assentar(fixture);
    expect(el.textContent).toContain('Nenhuma venda no período');
  });

  it('bloqueio: início depois do fim mostra a mensagem e não dispara requisição', async () => {
    const { fixture, http, el } = await montar();
    const [de, ate] = Array.from(
      el.querySelectorAll('ce-filtro-periodo input'),
    ) as HTMLInputElement[];
    de.value = '2026-09-30';
    de.dispatchEvent(new Event('input'));
    ate.value = '2026-09-01';
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
