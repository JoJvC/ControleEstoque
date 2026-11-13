import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { OperatorStore } from '../../core/operator/operator-store';
import { SheetService } from '../../core/overlay/sheet-service';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { AjusteSheet } from './ajuste-sheet';
import { BaixaCascoSheet } from './baixa-casco-sheet';
import { EstoquePage } from './estoque-page';

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

async function montar(permissoes: string[]) {
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
  TestBed.inject(HttpTestingController).expectOne('/api/estoque/v1/estoque').flush([ITEM]);
  await fixture.whenStable();
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    el,
    abrir,
    navegar,
    botao: (t: string) =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes(t)),
    linha: () => el.querySelector('ce-list-item') as HTMLElement,
  };
}

describe('EstoquePage — permissão estoque.editar', () => {
  it('sem a chave: Abastecer e Baixa de casco somem; clicar na linha não abre o ajuste', async () => {
    const t = await montar([]);
    expect(t.botao('Abastecer')).toBeUndefined();
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
    t.botao('Abastecer')!.click();
    expect(t.navegar).toHaveBeenCalledWith('/estoque/abastecimento');
  });
});
