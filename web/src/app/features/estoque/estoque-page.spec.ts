import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

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

const ITEM = {
  produtoId: 'p1',
  tipo: 'CASCO',
  nome: 'Casco vazio',
  marca: null,
  categoria: null,
  tamanho: '20L',
  quantidade: 10,
  estoqueMinimo: 2,
  abaixoMinimo: false,
};

const AGUA = {
  ...ITEM,
  produtoId: 'a1',
  tipo: 'AGUA',
  nome: 'Água 20L',
  marca: 'Cristal',
  quantidade: 8,
  estoqueMinimo: 4,
};
const COPO = {
  ...ITEM,
  produtoId: 'd1',
  tipo: 'DESCARTAVEL',
  nome: 'Copo 200ml',
  categoria: null,
  quantidade: 9,
  estoqueMinimo: 5,
  abaixoMinimo: true,
};

const SUCATA = {
  ...ITEM,
  produtoId: 's1',
  tipo: 'SUCATA',
  nome: 'Sucata de casco',
  quantidade: 9,
  estoqueMinimo: 5,
  abaixoMinimo: true,
};

async function montar(permissoes: string[], resposta: object[] = [ITEM, AGUA, COPO, SUCATA]) {
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
  TestBed.inject(HttpTestingController).expectOne('/api/estoque/v1/estoque').flush(resposta);
  await fixture.whenStable();
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    el,
    abrir,
    navegar,
    botao: (t: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(t)),
    linha: () => el.querySelector('ce-chip')!.closest('button') as HTMLElement,
  };
}

describe('EstoquePage — permissão estoque.editar', () => {
  it('sem a chave: Chegou mercadoria e Baixa de casco somem; clicar na linha não abre o ajuste', async () => {
    const t = await montar([]);
    expect(t.botao('Chegou mercadoria')).toBeUndefined();
    expect(t.botao('Baixa de casco')).toBeUndefined();
    expect(t.el.textContent).toContain('Casco vazio');
    t.linha().click();
    expect(t.abrir).not.toHaveBeenCalled();
  });

  it('com estoque.editar: botões presentes e cliques abrem as sheets', async () => {
    const t = await montar(['estoque.editar']);
    t.botao('Baixa de casco')!.click();
    expect(t.abrir).toHaveBeenCalledWith(BaixaCascoSheet);
    t.linha().click();
    expect(t.abrir).toHaveBeenCalledWith(AjusteSheet, { item: ITEM });
    t.botao('Chegou mercadoria')!.click();
    expect(t.navegar).toHaveBeenCalledWith('/estoque/abastecimento');
  });
});

describe('EstoquePage — seções', () => {
  it('renderiza água, vasilhames e descartáveis, com destaque só do servidor', async () => {
    const t = await montar([]);
    expect(t.el.querySelector('ce-galao-nivel')).not.toBeNull();
    expect(t.el.querySelector('ce-chip')?.textContent).toContain('Casco');
    expect(t.el.querySelector('ce-barra-estoque')).not.toBeNull();
    expect(t.el.textContent).toContain('Sem categoria');
    expect(t.el.querySelector('ce-galao-nivel [data-abaixo-minimo]')).toBeNull();
    expect(t.el.querySelector('ce-barra-estoque [data-abaixo-minimo]')).not.toBeNull();
  });
});

describe('EstoquePage — chip e status', () => {
  it('chip de vasilhame mostra o nome e destaca só com abaixoMinimo do servidor', async () => {
    const t = await montar([]);
    const chips = Array.from(t.el.querySelectorAll('.chips button'));
    expect(chips.map((c) => c.textContent)).toEqual([
      expect.stringContaining('Casco vazio'),
      expect.stringContaining('Sucata de casco'),
    ]);
    expect(chips[0].hasAttribute('data-abaixo-minimo')).toBe(false);
    expect(chips[1].hasAttribute('data-abaixo-minimo')).toBe(true);
    expect(chips[1].textContent).toContain('abaixo do mínimo');
  });

  it('estado de erro: "Tentar novamente" recarrega o estoque', async () => {
    TestBed.resetTestingModule();
    const http = { carregar: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: EstoqueStore,
          useValue: { itens: signal([]), status: signal('error'), carregar: http.carregar },
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

describe('EstoquePage — selo vem só do flag do servidor', () => {
  it('quantidade < mínimo com flag false: sem selo; flag true: selo e resumo', async () => {
    const semFlag = await montar(
      [],
      [{ ...AGUA, quantidade: 1, estoqueMinimo: 4, abaixoMinimo: false }],
    );
    expect(semFlag.el.textContent).not.toContain('abaixo do mínimo (');
    expect(semFlag.el.querySelector('.resumo')?.textContent).toContain('Tudo acima do mínimo');
    TestBed.resetTestingModule();
    const comFlag = await montar(
      [],
      [{ ...AGUA, quantidade: 9, estoqueMinimo: 5, abaixoMinimo: true }],
    );
    expect(comFlag.el.textContent).toContain('abaixo do mínimo (5)');
    expect(comFlag.el.querySelector('.resumo')?.textContent).toContain('1 item abaixo do mínimo');
  });
});
