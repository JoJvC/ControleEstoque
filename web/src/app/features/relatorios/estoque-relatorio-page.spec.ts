import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfigStore } from '../../core/config/app-config';
import { apiErrorInterceptor } from '../../core/http/api-error-interceptor';
import { marcaResp, produtoResp } from '../../core/api/testing';
import { OperatorStore } from '../../core/operator/operator-store';
import { EstoqueRelatorioPage } from './estoque-relatorio-page';

const URL = '/api/estoque/v1/relatorios/estoque';
const PRODUTOS = '/api/estoque/v1/produtos';

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

function responder(http: HttpTestingController, rel: object, produtos: object[] = []): void {
  http.expectOne(URL).flush(rel);
  http.expectOne(PRODUTOS).flush(produtos);
}

const item = (
  pm: string,
  produtoId: string,
  nome: string,
  marca: string,
  quantidade: number,
  estoqueMinimo: number,
  abaixoMinimo = false,
) => ({
  produtoMarcaId: pm,
  produtoId,
  tipo: 'RETORNAVEL',
  nome,
  marcaId: `m-${pm}`,
  marca,
  categoria: null,
  tamanho: null,
  quantidade,
  estoqueMinimo,
  abaixoMinimo,
});

const casco = (id: string, nome: string, vazios: number, sucata: number) => ({
  tipoCascoId: id,
  nome,
  marcaId: null,
  marca: null,
  aceitaSucata: true,
  vazios,
  sucata,
});

function linhas(el: HTMLElement): string[][] {
  return Array.from(el.querySelectorAll('.tabela tbody tr')).map((tr) =>
    Array.from(tr.querySelectorAll('td')).map((td) =>
      (td.textContent ?? '').replace(/\s/g, ' ').trim(),
    ),
  );
}

describe('EstoqueRelatorioPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify({ ignoreCancelled: true }));

  it('duas marcas do mesmo produto dão duas linhas, com estoque geral do produto e alerta do servidor', async () => {
    const { fixture, http, el } = montar();
    const a = item('pm1', 'p1', 'Água 20L', 'Cristal', 3, 5);
    const b = item('pm2', 'p1', 'Água 20L', 'Genérica', 4, 2, true);
    const c = item('pm3', 'p2', 'Tampa', 'Genérica', 50, 10);
    responder(http, { itens: [a, b, c], alertasEstoqueMinimo: [b], cascos: [] }, [
      produtoResp({ id: 'p1', estoqueGeral: 99, marcas: [marcaResp({ id: 'pm1' })] }),
      produtoResp({ id: 'p2', estoqueGeral: 50, marcas: [marcaResp({ id: 'pm3' })] }),
    ]);
    await assentar(fixture);
    expect(linhas(el)).toEqual([
      ['Água 20L', 'Cristal', '3', '5', 'Ok', '99'],
      ['Água 20L', 'sem marca', '4', '2', 'Abaixo do mínimo', '99'],
      ['Tampa', 'sem marca', '50', '10', 'Ok', '50'],
    ]);
    expect(el.querySelectorAll('.cards .card')).toHaveLength(3);
    const marcados = (sel: string) =>
      Array.from(el.querySelectorAll(`${sel}.abaixo-minimo`)).map((n) => n.textContent);
    expect(marcados('.cards .card')).toHaveLength(1);
    expect(marcados('.tabela tbody tr')).toHaveLength(1);
    expect(el.querySelector('ce-page-placeholder')).toBeNull();
  });

  it('vasilhames por tipo: só saldo diferente de zero', async () => {
    const { fixture, http, el } = montar();
    responder(http, {
      itens: [item('pm1', 'p1', 'Água 20L', 'Cristal', 3, 5)],
      alertasEstoqueMinimo: [],
      cascos: [
        casco('t1', 'Tipo 1', 0, 0),
        casco('t2', 'Tipo 2', 3, 0),
        casco('t3', 'Tipo 3', -1, 2),
      ],
    });
    await assentar(fixture);
    const secao = el.querySelector('section')!;
    expect(secao.textContent).toContain('Vasilhames por tipo');
    const tipos = Array.from(secao.querySelectorAll('.tabela tbody tr')).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => td.textContent?.trim()),
    );
    expect(tipos).toEqual([
      ['Tipo 2', '3', '0'],
      ['Tipo 3', '-1', '2'],
    ]);
  });

  it('todos os cascos zerados: estado vazio', async () => {
    const { fixture, http, el } = montar();
    responder(http, {
      itens: [item('pm1', 'p1', 'Água 20L', 'Cristal', 3, 5)],
      alertasEstoqueMinimo: [],
      cascos: [casco('t1', 'Tipo 1', 0, 0)],
    });
    await assentar(fixture);
    expect(el.querySelector('section')!.textContent).toContain('Nenhum vasilhame em estoque');
    expect(el.querySelector('section .tabela')).toBeNull();
  });

  it('lista vazia mostra o estado vazio', async () => {
    const { fixture, http, el } = montar();
    responder(http, { itens: [], alertasEstoqueMinimo: [], cascos: [] });
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
    // o primeiro /produtos foi cancelado pela falha do relatório
    http.expectOne(URL).flush({ itens: [], alertasEstoqueMinimo: [], cascos: [] });
    http.match(PRODUTOS).at(-1)!.flush([]);
  });
});
