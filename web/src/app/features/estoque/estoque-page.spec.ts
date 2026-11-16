import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { marcaResp, produtoResp } from '../../core/api/testing';
import { ConfigStore } from '../../core/config/app-config';
import { PermissionService } from '../../core/permissions/permission-service';
import { OperatorStore } from '../../core/operator/operator-store';
import { SheetService } from '../../core/overlay/sheet-service';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { AjusteSheet } from './ajuste-sheet';
import { BaixaCascoSheet } from './baixa-casco-sheet';
import { EstoquePage } from './estoque-page';
import { EstoqueStore } from './estoque-store';

const BASE = '/api/estoque/v1';

// estoqueGeral 99 de propósito: a tela mostra o do servidor, e não a soma das marcas (3 + 4)
const AGUA = produtoResp({
  id: 'a1',
  tipo: 'RETORNAVEL',
  nome: 'Água 20L',
  estoqueGeral: 99,
  marcas: [
    marcaResp({ id: 'pm-a', marcaNome: 'Cristal', quantidade: 3, estoqueMinimo: 5 }),
    marcaResp({
      id: 'pm-g',
      marcaNome: 'Genérica',
      quantidade: 4,
      estoqueMinimo: 2,
      abaixoMinimo: true,
    }),
  ],
});
const COPO = produtoResp({
  id: 'd1',
  tipo: 'DESCARTAVEL',
  nome: 'Copo 200ml',
  estoqueGeral: 9,
  marcas: [marcaResp({ id: 'pm-c', marcaNome: 'Genérica', quantidade: 9, estoqueMinimo: 5 })],
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
const CASCOS = [
  casco('t1', 'Tipo 1', 0, 0),
  casco('t2', 'Tipo 2', 3, 0),
  casco('t3', 'Tipo 3', -1, 2),
];

async function montar(
  permissoes: string[],
  produtos: object[] = [AGUA, COPO],
  cascos: object[] = CASCOS,
) {
  const abrir = vi.fn().mockReturnValue({ closed: of(false) });
  TestBed.configureTestingModule({
    providers: [
      { provide: SheetService, useValue: { abrir } },
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: StorageService, useValue: new FakeStorage() },
    ],
  });
  TestBed.inject(OperatorStore).select(operadorValido(permissoes));
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(EstoquePage);
  fixture.detectChanges();
  await fixture.whenStable();
  const http = TestBed.inject(HttpTestingController);
  http.expectOne(`${BASE}/produtos`).flush(produtos);
  http.expectOne(`${BASE}/estoque/cascos`).flush(cascos);
  await fixture.whenStable();
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    el,
    fixture,
    http,
    abrir,
    navegar,
    botao: (t: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(t)),
    produto: (nome: string) =>
      Array.from(el.querySelectorAll<HTMLButtonElement>('.produto__cabecalho')).find((b) =>
        b.textContent?.includes(nome),
      )!,
    marcas: () => Array.from(el.querySelectorAll<HTMLElement>('.marca')),
    atualizar: async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    },
  };
}

const textoVasilhames = (el: HTMLElement) =>
  Array.from(el.querySelectorAll('.vasilhame')).map((e) =>
    Array.from(e.querySelectorAll('span'))
      .map((x) => x.textContent?.trim())
      .join(' | '),
  );

describe('EstoquePage — permissão estoque.custos', () => {
  it('sem a chave: o botão "Custos pendentes" não aparece', async () => {
    const t = await montar(['estoque.editar']);
    expect(t.botao('Custos pendentes')).toBeUndefined();
  });

  it.each([['estoque.custos'], ['*']])('com %s: o botão leva às pendentes', async (chave) => {
    const t = await montar([chave]);
    t.botao('Custos pendentes')!.click();
    expect(t.navegar).toHaveBeenCalledWith('/estoque/abastecimento/pendentes');
  });
});

describe('EstoquePage — permissão estoque.editar', () => {
  it('sem a chave: botões somem; clicar na marca não abre o ajuste', async () => {
    const t = await montar([]);
    expect(t.botao('Chegou mercadoria')).toBeUndefined();
    expect(t.botao('Baixa de casco')).toBeUndefined();
    expect(t.el.textContent).toContain('Água 20L');
    t.produto('Água 20L').click();
    await t.atualizar();
    t.marcas()[0].click();
    expect(t.abrir).not.toHaveBeenCalled();
  });

  it('com estoque.editar: botões abrem as sheets e a marca abre o ajuste com produtoMarcaId', async () => {
    const t = await montar(['estoque.editar']);
    t.botao('Baixa de casco')!.click();
    expect(t.abrir).toHaveBeenCalledWith(BaixaCascoSheet);
    t.produto('Água 20L').click();
    await t.atualizar();
    t.marcas()[0].click();
    expect(t.abrir).toHaveBeenCalledWith(AjusteSheet, { produto: AGUA, marca: AGUA.marcas[0] });
    t.botao('Chegou mercadoria')!.click();
    expect(t.navegar).toHaveBeenCalledWith('/estoque/abastecimento');
  });
});

describe('EstoquePage — produto, marcas e alerta', () => {
  it('mostra o estoque geral do servidor, e não a soma das marcas', async () => {
    const t = await montar([]);
    const geral = t.produto('Água 20L').querySelector('.produto__geral')!.textContent;
    expect(geral?.trim()).toBe('99');
    expect(geral?.trim()).not.toBe('7');
  });

  it('clique no produto expande as marcas e o segundo clique recolhe', async () => {
    const t = await montar([]);
    const cab = t.produto('Água 20L');
    expect(cab.getAttribute('aria-expanded')).toBe('false');
    expect(t.marcas()).toHaveLength(0);
    cab.click();
    await t.atualizar();
    expect(cab.getAttribute('aria-expanded')).toBe('true');
    expect(t.marcas()).toHaveLength(2);
    cab.click();
    await t.atualizar();
    expect(cab.getAttribute('aria-expanded')).toBe('false');
    expect(t.marcas()).toHaveLength(0);
  });

  it('alerta segue o abaixoMinimo da marca, nos dois sentidos; Genérica vira "sem marca"', async () => {
    const t = await montar([]);
    t.produto('Água 20L').click();
    await t.atualizar();
    const [cristal, generica] = t.marcas();
    expect(cristal.textContent).toContain('Cristal');
    expect(cristal.textContent).toContain('3');
    expect(cristal.textContent).toContain('mín. 5');
    // quantidade 3 < mínimo 5, mas o servidor disse false: sem alerta
    expect(cristal.hasAttribute('data-abaixo-minimo')).toBe(false);
    expect(cristal.textContent).not.toContain('abaixo do mínimo');
    // quantidade 4 > mínimo 2, mas o servidor disse true: com alerta
    expect(generica.textContent).toContain('sem marca');
    expect(generica.textContent).not.toContain('Genérica');
    expect(generica.hasAttribute('data-abaixo-minimo')).toBe(true);
    expect(generica.textContent).toContain('abaixo do mínimo');
  });

  it('o produto tem indicador de alerta só quando alguma marca vem abaixo do mínimo', async () => {
    const t = await montar([]);
    expect(t.produto('Água 20L').querySelector('.produto__alerta')).not.toBeNull();
    expect(t.produto('Copo 200ml').querySelector('.produto__alerta')).toBeNull();
    expect(t.el.querySelector('.resumo')?.textContent).toContain('1 item abaixo do mínimo');
  });

  it('ícone vem de iconeDoProduto (ce-icon), sem emoji', async () => {
    const t = await montar([]);
    expect(t.produto('Água 20L').querySelector('ce-icon')).not.toBeNull();
    expect(t.el.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(t.el.querySelector('[aria-labelledby="sec-descartaveis"]')?.textContent).toContain(
      'Outros',
    );
    expect(t.el.querySelector('[aria-labelledby="sec-retornaveis"] h2')?.textContent).toContain(
      'Retornáveis',
    );
  });

  it('tamanho só aparece quando o nome ainda não o contém', async () => {
    const t = await montar(
      [],
      [
        { ...AGUA, nome: 'Galão 20L', tamanho: '20L' },
        { ...COPO, nome: 'Copo', tamanho: '200ml' },
      ],
    );
    const nomes = Array.from(t.el.querySelectorAll('.produto__nome')).map((e) =>
      e.textContent?.trim(),
    );
    expect(nomes).toEqual(['Galão 20L', 'Copo 200ml']);
  });

  it('sem produtos nem vasilhames: estado vazio; não usa ce-page-placeholder', async () => {
    const t = await montar([], [], []);
    expect(t.el.textContent).toContain('Estoque vazio');
    expect(t.el.querySelector('ce-page-placeholder')).toBeNull();
  });
});

describe('EstoquePage — vasilhames por tipo', () => {
  it('lista só os tipos com saldo diferente de zero', async () => {
    const t = await montar([]);
    const itens = textoVasilhames(t.el);
    expect(itens).toEqual(['Tipo 2 | Vazios: 3 | Sucata: 0', 'Tipo 3 | Vazios: -1 | Sucata: 2']);
    expect(t.el.querySelector('[aria-labelledby="sec-vasilhames"] ce-icon')).not.toBeNull();
    expect(t.el.querySelector('ce-page-placeholder')).toBeNull();
  });

  it('todos zerados: estado vazio "Nenhum vasilhame em estoque"', async () => {
    const t = await montar([], [AGUA], [casco('t1', 'Tipo 1', 0, 0)]);
    expect(t.el.querySelectorAll('.vasilhame')).toHaveLength(0);
    expect(t.el.querySelector('[aria-labelledby="sec-vasilhames"]')?.textContent).toContain(
      'Nenhum vasilhame em estoque',
    );
  });

  it('baixa de casco: abrir, escolher o tipo e confirmar envia tipoCascoId e recarrega os números', async () => {
    const t = await montar(['estoque.editar']);
    t.botao('Baixa de casco')!.click();
    expect(t.abrir).toHaveBeenCalledWith(BaixaCascoSheet);

    // a sheet faz o POST pela store; aqui o gesto fecha o ciclo e a tela re-lê o servidor
    const store = TestBed.inject(EstoqueStore);
    const baixa = store.baixarCasco({
      tipoCascoId: 't2',
      quantidade: 1,
      motivo: null,
      responsaveisIds: ['f1'],
    });
    const req = t.http.expectOne(`${BASE}/estoque/cascos/baixas`);
    expect(req.request.body.tipoCascoId).toBe('t2');
    req.flush({ id: 'b1' });
    await baixa;
    t.http.expectOne(`${BASE}/produtos`).flush([AGUA]);
    t.http
      .expectOne(`${BASE}/estoque/cascos`)
      .flush([casco('t2', 'Tipo 2', 2, 1), casco('t3', 'Tipo 3', -1, 2)]);
    await t.atualizar();
    const itens = textoVasilhames(t.el);
    expect(itens[0]).toBe('Tipo 2 | Vazios: 2 | Sucata: 1');
  });
});

describe('EstoquePage — erro', () => {
  it('estado de erro: "Tentar novamente" recarrega o estoque', async () => {
    TestBed.resetTestingModule();
    const http = { carregar: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: EstoqueStore,
          useValue: {
            produtos: signal([]),
            cascos: signal([]),
            status: signal('error'),
            carregar: http.carregar,
          },
        },
        { provide: SheetService, useValue: { abrir: vi.fn() } },
        { provide: Router, useValue: { navigateByUrl: vi.fn() } },
        { provide: PermissionService, useValue: { has: () => true } },
      ],
    });
    const fixture = TestBed.createComponent(EstoquePage);
    fixture.detectChanges();
    http.carregar.mockClear();
    const botao = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      (b as HTMLElement).textContent?.includes('Tentar novamente'),
    ) as HTMLElement;
    botao.click();
    expect(http.carregar).toHaveBeenCalledTimes(1);
  });
});
