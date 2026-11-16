import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RelatorioLucro } from '../../core/api/models/relatorios';
import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { LucroRelatorioPage } from './lucro-relatorio-page';
import { periodoPadrao } from './periodo';

const URL = '/api/estoque/v1/relatorios/lucro';
const PADRAO = periodoPadrao();

const base = {
  produtoId: 'p',
  marcaId: 'm',
  receitaVasilhame: 0,
};
function resposta(linhasPendentes: number): RelatorioLucro {
  return {
    inicio: PADRAO.inicio,
    fim: PADRAO.fim,
    linhas: [
      {
        ...base,
        produtoMarcaId: 'pm1',
        produtoNome: 'Água 20L',
        marcaNome: 'Indaiá',
        quantidadeVendida: 10,
        receita: 120,
        custoProdutos: 70,
        frete: 5,
        lucro: 45,
        custoPendente: false,
      },
      {
        ...base,
        produtoMarcaId: 'pm2',
        produtoNome: 'Gás P13',
        marcaNome: 'Genérica',
        quantidadeVendida: 2,
        receita: 220,
        custoProdutos: null,
        frete: null,
        lucro: null,
        custoPendente: true,
      },
    ],
    totais: {
      quantidadeVendida: 12,
      receita: 340,
      receitaVasilhame: 0,
      custoProdutos: 70,
      frete: 5,
      lucro: 45,
      linhasPendentes,
    },
  };
}

async function assentar(fixture: ComponentFixture<unknown>): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await fixture.whenStable();
}

const consulta = (http: HttpTestingController) => http.expectOne((r) => r.url === URL);
const txt = (e: Element) => (e.textContent ?? '').replace(/\s+/g, ' ').trim();

async function montar(linhasPendentes = 1) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([apiErrorInterceptor])),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: StorageService, useValue: new FakeStorage() },
    ],
  });
  TestBed.inject(OperatorStore).select(operadorValido(['estoque.custos']));
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(LucroRelatorioPage);
  fixture.detectChanges();
  const inicial = consulta(http);
  expect(inicial.request.params.get('inicio')).toBe(PADRAO.inicio);
  inicial.flush(resposta(linhasPendentes));
  await assentar(fixture);
  return { fixture, http, el: fixture.nativeElement as HTMLElement };
}

describe('LucroRelatorioPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('trocar o período e clicar em Buscar dispara a consulta com os novos inicio e fim', async () => {
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
    req.flush({ ...resposta(0), linhas: [] });
    await assentar(fixture);
    expect(el.textContent).toContain('Nenhuma venda no período');
  });

  it('período invertido não dispara requisição e mostra a mensagem', async () => {
    const { fixture, el } = await montar();
    const [de, ate] = Array.from(
      el.querySelectorAll('ce-filtro-periodo input'),
    ) as HTMLInputElement[];
    de.value = '2026-10-10';
    de.dispatchEvent(new Event('input'));
    ate.value = '2026-10-01';
    ate.dispatchEvent(new Event('input'));
    await assentar(fixture);
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Buscar'))!
      .click();
    await assentar(fixture);
    expect(el.textContent).toContain('A data inicial não pode ser depois da data final.');
  });

  it('linha normal mostra custo, frete à parte e lucro', async () => {
    const { el } = await montar();
    const linha = el.querySelector('tbody tr:not([data-pendente])')!;
    const cel = Array.from(linha.querySelectorAll('td')).map(txt);
    expect(cel[0]).toBe('Água 20L — Indaiá');
    expect(cel.slice(2)).toEqual(['R$ 120,00', 'R$ 0,00', 'R$ 70,00', 'R$ 5,00', 'R$ 45,00']);
  });

  it('linha pendente mostra receita, "—" em custo, frete e lucro, a marca e "sem marca"', async () => {
    const { el } = await montar();
    const linha = el.querySelector('tbody tr[data-pendente]')!;
    const cel = Array.from(linha.querySelectorAll('td')).map(txt);
    expect(cel[0]).toContain('Gás P13 — sem marca');
    expect(cel[0]).toContain('custo pendente');
    expect(cel[2]).toBe('R$ 220,00');
    expect(cel.slice(4)).toEqual(['—', '—', '—']);
  });

  it('aviso nos totais usa o linhasPendentes do servidor; com 0 não aparece', async () => {
    const dois = await montar(2);
    expect(txt(dois.el.querySelector('.aviso')!)).toContain('2 linha(s) com custo pendente');
    TestBed.resetTestingModule();
    const zero = await montar(0);
    expect(zero.el.querySelector('.aviso')).toBeNull();
  });

  it('celular: um cartão por produto+marca; desktop: tabela (o scss alterna em 960 px)', async () => {
    const { el } = await montar();
    const cards = Array.from(el.querySelectorAll('ul.cards > li.card'));
    expect(cards.length).toBe(2);
    expect(el.querySelectorAll('.tabela tbody tr').length).toBe(2);
    const normal = cards.find((c) => !c.hasAttribute('data-pendente'))!;
    expect(txt(normal.querySelector('.card__titulo')!)).toBe('Água 20L — Indaiá');
    const pares = Array.from(normal.querySelectorAll('dt:not(.card__titulo)')).map(
      (dt) => `${txt(dt)}: ${txt(dt.nextElementSibling!)}`,
    );
    expect(pares).toEqual([
      'Quantidade: 10',
      'Receita: R$ 120,00',
      'Vasilhame: R$ 0,00',
      'Custo: R$ 70,00',
      'Frete: R$ 5,00',
      'Lucro: R$ 45,00',
    ]);
    const pend = cards.find((c) => c.hasAttribute('data-pendente'))!;
    expect(txt(pend.querySelector('.card__titulo')!)).toContain('custo pendente');
    const vals = Array.from(pend.querySelectorAll('dd')).map(txt);
    expect(vals.slice(3)).toEqual(['—', '—', '—']);
  });

  it('sem placeholder nem emoji', async () => {
    const { el } = await montar();
    expect(el.querySelector('ce-page-placeholder')).toBeNull();
    expect(/\p{Extended_Pictographic}/u.test(el.textContent ?? '')).toBe(false);
  });
});
