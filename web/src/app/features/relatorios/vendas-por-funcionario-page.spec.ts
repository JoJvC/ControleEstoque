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
const RELATORIO = {
  inicio: PADRAO.inicio,
  fim: PADRAO.fim,
  totais: { quantidadeVendas: 1, quantidadeEntregas: 1, totalLiquido: 385 },
  funcionarios: [
    {
      funcionarioId: 'f1',
      nome: 'Ana',
      quantidadeVendas: 1,
      quantidadeEntregas: 0,
      totalLiquido: 55,
      descontoSucata: 5,
      itens: [
        {
          tipo: 'PRODUTO' as const,
          produtoNome: 'Água 20L',
          marcaNome: 'Indaiá',
          quantidade: 2,
          total: 30,
        },
        { tipo: 'VASILHAME' as const, tipoCascoNome: '20L', quantidade: 1, total: 25 },
      ],
    },
    {
      funcionarioId: 'f2',
      nome: 'Bruno',
      quantidadeVendas: 0,
      quantidadeEntregas: 1,
      totalLiquido: 330,
      descontoSucata: 0,
      itens: [
        {
          tipo: 'PRODUTO' as const,
          produtoNome: 'Gás P13',
          marcaNome: 'Genérica',
          quantidade: 3,
          total: 330,
        },
      ],
    },
  ],
};
const VAZIO = { ...RELATORIO, totais: { ...RELATORIO.totais }, funcionarios: [] };

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
  inicial.flush(RELATORIO);
  await assentar(fixture);
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, http, el };
}

describe('VendasPorFuncionarioPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  const textos = (el: HTMLElement, seletor: string) =>
    Array.from(el.querySelectorAll(seletor)).map((n) =>
      Array.from(n.children)
        .map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' '),
    );

  it('mostra os totais do período e a lista de funcionários', async () => {
    const { el } = await montar();
    expect(textos(el, '.totais .total')).toEqual(['Vendas 1', 'Entregas 1', 'Total R$ 385,00']);
    expect(textos(el, '.funcionario__cab')).toEqual([
      'Ana 1 vendas · 0 entregas · R$ 55,00',
      'Bruno 0 vendas · 1 entregas · R$ 330,00',
    ]);
    expect(el.querySelector('.funcionario__detalhe')).toBeNull();
  });

  it('clicar no funcionário expande o detalhamento e clicar de novo recolhe', async () => {
    const { fixture, el } = await montar();
    const [ana, bruno] = Array.from(el.querySelectorAll<HTMLButtonElement>('.funcionario__cab'));
    ana.click();
    await assentar(fixture);
    expect(ana.getAttribute('aria-expanded')).toBe('true');
    expect(textos(el, '.funcionario__detalhe li')).toEqual([
      'Água 20L Indaiá 2 R$ 30,00',
      'Vasilhame 20L 1 R$ 25,00',
      'Desconto por sucata R$ 5,00',
    ]);
    bruno.click();
    await assentar(fixture);
    expect(textos(el, '.funcionario__detalhe li').at(-1)).toBe('Gás P13 sem marca 3 R$ 330,00');
    ana.click();
    await assentar(fixture);
    expect(ana.getAttribute('aria-expanded')).toBe('false');
    expect(textos(el, '.funcionario__detalhe li')).toEqual(['Gás P13 sem marca 3 R$ 330,00']);
  });

  it('mudar início ou fim recarrega com as datas novas', async () => {
    const { fixture, http, el } = await montar();
    const [de, ate] = Array.from(
      el.querySelectorAll('ce-filtro-periodo input'),
    ) as HTMLInputElement[];
    de.value = '2020-09-01';
    de.dispatchEvent(new Event('input'));
    const primeira = consulta(http);
    expect(primeira.request.params.get('inicio')).toBe('2020-09-01');
    primeira.flush(RELATORIO);
    await assentar(fixture);
    ate.value = '2020-09-30';
    ate.dispatchEvent(new Event('input'));
    const segunda = consulta(http);
    expect(segunda.request.params.get('inicio')).toBe('2020-09-01');
    expect(segunda.request.params.get('fim')).toBe('2020-09-30');
    segunda.flush(VAZIO);
    await assentar(fixture);
    expect(el.textContent).toContain('Nenhuma venda no período');
  });

  it('bloqueio: início depois do fim mostra a mensagem e não dispara requisição', async () => {
    const { fixture, http, el } = await montar();
    const [de] = Array.from(el.querySelectorAll('ce-filtro-periodo input')) as HTMLInputElement[];
    de.value = '2099-12-31';
    de.dispatchEvent(new Event('input'));
    await assentar(fixture);
    http.verify();
    expect(el.textContent).toContain('A data inicial não pode ser depois da data final.');
  });
});
