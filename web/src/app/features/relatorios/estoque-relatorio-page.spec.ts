import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { OperatorStore } from '../../core/operator/operator-store';
import { EstoqueRelatorioPage } from './estoque-relatorio-page';

const URL = '/api/estoque/v1/relatorios/estoque';

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
  const fixture = TestBed.createComponent(EstoqueRelatorioPage);
  fixture.detectChanges();
  return { fixture, http, el: fixture.nativeElement as HTMLElement };
}

function linhas(el: HTMLElement): string[][] {
  return Array.from(el.querySelectorAll('.tabela tbody tr')).map((tr) =>
    Array.from(tr.querySelectorAll('td')).map((td) =>
      (td.textContent ?? '').replace(/\s/g, ' ').trim(),
    ),
  );
}

describe('EstoqueRelatorioPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('destaca só os itens de alertasEstoqueMinimo, nos cards e na tabela', async () => {
    const { fixture, http, el } = montar();
    const item = (id: string, nome: string, quantidade: number, estoqueMinimo: number) => ({
      produtoId: id,
      tipo: 'AGUA',
      nome,
      marca: null,
      categoria: null,
      quantidade,
      estoqueMinimo,
      abaixoMinimo: false,
    });
    const a = item('p1', 'Água 20L', 2, 10);
    const b = item('p2', 'Garrafão', 1, 5); // abaixo do mínimo, mas fora dos alertas
    const c = item('p3', 'Tampa', 50, 10);
    http.expectOne(URL).flush({ itens: [a, b, c], alertasEstoqueMinimo: [a] });
    await assentar(fixture);
    expect(linhas(el)).toEqual([
      ['Água 20L', '2', '10'],
      ['Garrafão', '1', '5'],
      ['Tampa', '50', '10'],
    ]);
    expect(el.querySelectorAll('.cards .card')).toHaveLength(3);
    const marcados = (sel: string) =>
      Array.from(el.querySelectorAll(`${sel}.abaixo-minimo`)).map((n) => n.textContent);
    expect(marcados('.cards .card')).toHaveLength(1);
    expect(marcados('.cards .card')[0]).toContain('Água 20L');
    expect(marcados('.tabela tbody tr')).toHaveLength(1);
    expect(marcados('.tabela tbody tr')[0]).toContain('Água 20L');
  });

  it('lista vazia mostra o estado vazio', async () => {
    const { fixture, http, el } = montar();
    http.expectOne(URL).flush({ itens: [], alertasEstoqueMinimo: [] });
    await assentar(fixture);
    expect(el.textContent).toContain('Nenhum item em estoque');
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
    http.expectOne(URL).flush({ itens: [], alertasEstoqueMinimo: [] });
  });
});
