import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { vi } from 'vitest';

import { marcaResp, produtoResp } from '../../core/api/testing';
import { ConfigStore } from '../../core/config/app-config';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { ToastService } from '../../core/toast/toast-service';
import { AbastecimentoPage } from './abastecimento-page';

const BASE = '/api/estoque/v1';

const AGUA = produtoResp({
  id: 'a1',
  nome: 'Água 20L',
  categoria: 'Água',
  marcas: [
    marcaResp({
      id: 'pm-a',
      marcaNome: 'Marca A',
      quantidade: 4,
      estoqueMinimo: 5,
      abaixoMinimo: true,
    }),
  ],
});
const GAS = produtoResp({
  id: 'g1',
  nome: 'Gás P13',
  categoria: 'Gás',
  marcas: [marcaResp({ id: 'pm-g', marcaNome: 'Genérica', quantidade: 9 })],
});
const TIPO_CASCO = {
  id: 'T20',
  nome: 'Galão 20L',
  marcaId: null,
  marca: null,
  precoVasilhame: 30,
  aceitaSucata: true,
};
const CASCO_ESTOQUE = {
  tipoCascoId: 'T20',
  nome: 'Galão 20L',
  marcaId: null,
  marca: null,
  aceitaSucata: true,
  vazios: 6,
  sucata: 0,
};

async function montar(
  permissoes: string[],
  produtoId: string | null = null,
  catalogo: object[] = [AGUA, GAS],
) {
  const navegar = vi.fn().mockResolvedValue(true);
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: StorageService, useValue: new FakeStorage() },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: convertToParamMap(produtoId ? { produtoId } : {}) },
        },
      },
      { provide: Router, useValue: { navigateByUrl: navegar } },
    ],
  });
  TestBed.inject(OperatorStore).select(operadorValido(permissoes));
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(AbastecimentoPage);
  const el = fixture.nativeElement as HTMLElement;
  const assentar = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const carregarEstoque = async () => {
    http.expectOne(`${BASE}/produtos`).flush(catalogo);
    http.expectOne(`${BASE}/estoque/cascos`).flush([CASCO_ESTOQUE]);
    await assentar();
  };
  fixture.detectChanges();
  http.expectOne(`${BASE}/tipos-casco`).flush([TIPO_CASCO]);
  await carregarEstoque();

  const texto = () => (el.textContent ?? '').replace(/\s+/g, ' ');
  const botao = (rotulo: string) =>
    Array.from(el.querySelectorAll('button')).find((b) =>
      (b.textContent + (b.getAttribute('aria-label') ?? '')).includes(rotulo),
    ) as HTMLButtonElement;
  const digitar = async (campo: HTMLInputElement, valor: string) => {
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    await assentar();
  };
  const buscar = async (termo: string) => {
    await digitar(el.querySelector('ce-search-box input') as HTMLInputElement, termo);
    await new Promise((r) => setTimeout(r, 350)); // debounce da busca
    await assentar();
  };
  const quantidade = (nome: string) =>
    Array.from(el.querySelectorAll('.item'))
      .find((i) => i.querySelector('b')?.textContent === nome)
      ?.querySelector('ce-quantity-stepper input') as HTMLInputElement;
  const clicar = async (rotulo: string) => {
    botao(rotulo).click();
    await assentar();
  };
  const enviar = async () => {
    (el.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await assentar();
  };
  return {
    fixture,
    http,
    navegar,
    el,
    texto,
    botao,
    buscar,
    digitar,
    quantidade,
    clicar,
    enviar,
    assentar,
    carregarEstoque,
  };
}

describe('AbastecimentoPage — momento 1', () => {
  it('buscar, digitar quantidades de dois produto+marca e do vasilhame e enviar: corpo sem custo', async () => {
    const t = await montar(['estoque.editar']);

    await t.buscar('água');
    expect(t.texto()).toContain('Água 20L — Marca A');
    expect(t.texto()).not.toContain('Gás P13');
    await t.digitar(t.quantidade('Água 20L — Marca A'), '10');

    await t.clicar('Limpar busca');
    expect(t.texto()).toContain('Gás P13 — sem marca');
    expect(t.texto()).toContain('Vasilhame Galão 20L');
    await t.digitar(t.quantidade('Gás P13 — sem marca'), '5');
    await t.digitar(t.quantidade('Vasilhame Galão 20L'), '3');
    expect(t.texto()).toContain('3 itens');
    expect(t.texto()).toContain('18 un');
    expect(t.texto()).not.toMatch(/custo total/i);

    await t.clicar('Retirada nossa');
    await t.enviar();
    const req = t.http.expectOne(`${BASE}/abastecimentos`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      tipoFrete: 'PROPRIO',
      funcionarioId: 'f1',
      observacao: null,
      itens: [
        { produtoMarcaId: 'pm-a', quantidade: 10 },
        { produtoMarcaId: 'pm-g', quantidade: 5 },
      ],
      cascos: [{ tipoCascoId: 'T20', quantidade: 3 }],
    });
    expect(req.request.body).not.toHaveProperty('custoTotal');
    req.flush({ id: 'ab1' });
    await t.assentar();
    await t.carregarEstoque(); // saldos recarregados do servidor
    t.http.verify();
  });

  it('sem estoque.custos: ao criar volta a /estoque e não há "Lançar custos"', async () => {
    const t = await montar(['estoque.editar']);
    await t.digitar(t.quantidade('Água 20L — Marca A'), '2');
    await t.clicar('Fornecedor entrega');
    await t.enviar();
    t.http.expectOne(`${BASE}/abastecimentos`).flush({ id: 'ab1' });
    await t.assentar();
    await t.carregarEstoque();
    expect(t.navegar).toHaveBeenCalledWith('/estoque');
    expect(t.texto()).not.toContain('Lançar custos');
  });

  it.each([['estoque.custos'], ['*']])(
    'com %s: ao criar mostra "Lançar custos", que leva à tela de custos da carga',
    async (chave) => {
      const t = await montar([chave]);
      await t.digitar(t.quantidade('Água 20L — Marca A'), '2');
      await t.clicar('Fornecedor entrega');
      await t.enviar();
      t.http.expectOne(`${BASE}/abastecimentos`).flush({ id: 'ab9' });
      await t.assentar();
      await t.carregarEstoque();
      expect(t.navegar).not.toHaveBeenCalled();
      await t.clicar('Lançar custos');
      expect(t.navegar).toHaveBeenCalledWith('/estoque/abastecimento/ab9/custos');
    },
  );

  it('só vasilhame já basta para enviar (cascos sem itens)', async () => {
    const t = await montar(['estoque.editar']);
    await t.digitar(t.quantidade('Vasilhame Galão 20L'), '4');
    await t.clicar('Fornecedor entrega');
    await t.enviar();
    const req = t.http.expectOne(`${BASE}/abastecimentos`);
    expect(req.request.body.itens).toEqual([]);
    expect(req.request.body.cascos).toEqual([{ tipoCascoId: 'T20', quantidade: 4 }]);
    req.flush({ id: 'ab1' });
  });

  it('validação local: sem quantidade e sem frete não chama a API', async () => {
    const t = await montar(['estoque.editar']);
    await t.enviar();
    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain('ao menos um item');
    await t.digitar(t.quantidade('Água 20L — Marca A'), '1');
    await t.enviar();
    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain('tipo de frete');
    t.http.expectNone(`${BASE}/abastecimentos`);
  });

  it('lista com abaixo do mínimo primeiro e "tem N" do servidor', async () => {
    const t = await montar(['estoque.editar']);
    const nomes = Array.from(t.el.querySelectorAll('.item b')).map((b) => b.textContent);
    expect(nomes).toEqual(['Água 20L — Marca A', 'Gás P13 — sem marca', 'Vasilhame Galão 20L']);
    expect(t.texto()).toContain('tem 4 · abaixo do mínimo (5)');
    expect(t.texto()).toContain('tem 6');
  });

  it('?produtoId= pré-filtra as marcas desse produto; o filtro se limpa', async () => {
    const t = await montar(['estoque.editar'], 'g1');
    expect(t.texto()).toContain('Gás P13');
    expect(t.texto()).not.toContain('Água 20L');
    expect(t.texto()).not.toContain('Vasilhame');
    await t.clicar('Limpar filtro');
    expect(t.texto()).toContain('Água 20L');
  });

  it('produtos de mesmo nome e tamanhos diferentes têm linhas distintas e ?produtoId= filtra pelo id', async () => {
    const agua = (id: string, tamanho: string, marcaId: string) =>
      produtoResp({
        id,
        nome: 'Água',
        tamanho,
        marcas: [marcaResp({ id: marcaId, marcaNome: 'Marca A' })],
      });
    const catalogo = [agua('a10', '10L', 'pm-10'), agua('a20', '20L', 'pm-20')];

    const todos = await montar(['estoque.editar'], null, catalogo);
    const nomes = Array.from(todos.el.querySelectorAll('.item b')).map((b) => b.textContent);
    expect(nomes).toEqual(['Água 10L — Marca A', 'Água 20L — Marca A', 'Vasilhame Galão 20L']);
    await todos.digitar(todos.quantidade('Água 20L — Marca A'), '4');
    await todos.clicar('Retirada nossa');
    await todos.enviar();
    const req = todos.http.expectOne(`${BASE}/abastecimentos`);
    expect(req.request.body.itens).toEqual([{ produtoMarcaId: 'pm-20', quantidade: 4 }]);
    req.flush({ id: 'ab1' });

    TestBed.resetTestingModule();
    const repor = await montar(['estoque.editar'], 'a20', catalogo);
    const filtradas = Array.from(repor.el.querySelectorAll('.item b')).map((b) => b.textContent);
    expect(filtradas).toEqual(['Água 20L — Marca A']);
    expect(repor.texto()).toContain('Produto: Água 20L');
  });

  it('erro da API aparece em role="alert" e não navega', async () => {
    const t = await montar(['estoque.editar']);
    await t.digitar(t.quantidade('Água 20L — Marca A'), '1');
    await t.clicar('Retirada nossa');
    await t.enviar();
    t.http
      .expectOne(`${BASE}/abastecimentos`)
      .flush({ code: 'X', message: 'ruim', traceId: 't' }, { status: 500, statusText: 'err' });
    await t.assentar();
    await t.assentar();
    expect(t.el.querySelector('[role="alert"]')?.textContent).toContain('Erro ao registrar');
    expect(t.navegar).not.toHaveBeenCalled();
  });

  it('voltar navega a /estoque', async () => {
    const t = await montar(['estoque.editar']);
    (t.el.querySelector('ce-app-header button') as HTMLButtonElement).click();
    expect(t.navegar).toHaveBeenCalledWith('/estoque');
  });
});
