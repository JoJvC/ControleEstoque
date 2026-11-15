import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';

import { OperatorStore } from '../../core/operator/operator-store';
import { ToastService } from '../../core/toast/toast-service';
import { ProdutosStore } from '../produtos/produtos-store';
import { AbastecimentoPage } from './abastecimento-page';
import { EstoqueStore } from './estoque-store';

function montar() {
  const abastecer = vi.fn().mockResolvedValue(undefined);
  const navegar = vi.fn().mockResolvedValue(true);
  TestBed.configureTestingModule({
    providers: [
      { provide: EstoqueStore, useValue: { abastecer } },
      {
        provide: ProdutosStore,
        useValue: {
          carregar: vi.fn(),
          produtos: signal([{ id: 'p1', nome: 'Copo', tamanho: null }]),
        },
      },
      { provide: OperatorStore, useValue: { operator: signal({ id: 'f1' }) } },
      { provide: ToastService, useValue: { success: vi.fn() } },
      { provide: Router, useValue: { navigateByUrl: navegar } },
    ],
  });
  const fixture = TestBed.createComponent(AbastecimentoPage);
  fixture.detectChanges();
  return { fixture, abastecer, navegar, el: fixture.nativeElement as HTMLElement };
}

describe('AbastecimentoPage', () => {
  it('título do header e do botão de submit: "Chegou mercadoria"', () => {
    const el = montar().el;
    expect(el.querySelector('ce-app-header')?.textContent).toContain('Chegou mercadoria');
    expect(el.querySelector('button[type="submit"]')?.textContent).toContain('Chegou mercadoria');
    expect(el.textContent).not.toContain('Registrar abastecimento');
  });

  it('submeter chama abastecer com o request e volta a /estoque', async () => {
    const t = montar();
    const c = t.fixture.componentInstance as unknown as {
      itens: { at(i: number): { setValue(v: unknown): void } };
      tipoFrete: { setValue(v: string): void };
      custoTotal: { setValue(v: number): void };
    };
    c.itens.at(0).setValue({ produtoId: 'p1', quantidade: 2, custoUnitario: 3 });
    c.tipoFrete.setValue('PROPRIO');
    c.custoTotal.setValue(6);
    t.el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await t.fixture.whenStable();
    expect(t.abastecer).toHaveBeenCalledWith({
      tipoFrete: 'PROPRIO',
      custoTotal: 6,
      funcionarioId: 'f1',
      observacao: null,
      itens: [{ produtoId: 'p1', quantidade: 2, custoUnitario: 3 }],
    });
    expect(t.navegar).toHaveBeenCalledWith('/estoque');
  });

  it('clique em voltar/cancelar navega a /estoque sem abastecer', () => {
    const t = montar();
    (t.el.querySelector('ce-app-header button') as HTMLButtonElement).click();
    expect(t.navegar).toHaveBeenCalledWith('/estoque');
    expect(t.abastecer).not.toHaveBeenCalled();
  });
});
