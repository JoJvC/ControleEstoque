import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { ConfigStore } from '../../core/config/app-config';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { ProdutosListaPage } from './produtos-lista-page';

const PRODUTO = {
  id: 'p1',
  nome: 'Água 20L',
  tipo: 'AGUA',
  marca: null,
  categoria: null,
  tamanho: null,
  precoReferencia: 10,
  fotoUrl: null,
};

async function montar(permissoes: string[]) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ConfigStore, useValue: { apiBaseUrl: '/api' } },
      { provide: StorageService, useValue: new FakeStorage() },
    ],
  });
  TestBed.inject(OperatorStore).select(operadorValido(permissoes));
  const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ProdutosListaPage);
  fixture.detectChanges();
  await fixture.whenStable();
  TestBed.inject(HttpTestingController)
    .expectOne((r) => r.url === '/api/estoque/v1/produtos')
    .flush([PRODUTO]);
  await fixture.whenStable();
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return {
    el,
    navegar,
    novo: () =>
      Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Novo')),
    card: () => el.querySelector('ce-produto-card') as HTMLElement,
  };
}

describe('ProdutosListaPage — permissão estoque.editar', () => {
  it('sem a chave: Novo some e clicar no card não navega para a edição', async () => {
    const t = await montar([]);
    expect(t.novo()).toBeUndefined();
    expect(t.el.textContent).toContain('Água 20L');
    t.card().click();
    expect(t.navegar).not.toHaveBeenCalled();
  });

  it('com estoque.editar: Novo navega para /produtos/novo e o card para a edição', async () => {
    const t = await montar(['estoque.editar']);
    t.novo()!.click();
    expect(t.navegar).toHaveBeenCalledWith('/produtos/novo');
    t.card().click();
    expect(t.navegar).toHaveBeenCalledWith('/produtos/p1/editar');
  });
});
