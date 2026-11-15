import { TestBed } from '@angular/core/testing';

import { EstoqueItemResponse } from '../../core/api/models/estoque';
import { HojeAcabando, modeloAcabando } from './hoje-acabando';

const ITEM = {
  produtoId: 'p-1',
  tipo: 'DESCARTAVEL',
  nome: 'Gelo 5kg',
  categoria: 'GELO',
  quantidade: 2,
  estoqueMinimo: 5,
} as EstoqueItemResponse;

describe('modeloAcabando', () => {
  it('mapeia nome, quantidade, mínimo e ícone', () => {
    expect(modeloAcabando([ITEM])).toEqual([
      { id: 'p-1', nome: 'Gelo 5kg', quantidade: 2, minimo: 5, icone: 'gelo' },
    ]);
  });
});

describe('HojeAcabando', () => {
  it('lista itens com quantidade/mínimo', () => {
    const f = TestBed.createComponent(HojeAcabando);
    f.componentRef.setInput('itens', modeloAcabando([ITEM]));
    f.detectChanges();
    const t = (f.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ');
    expect(t).toContain('Gelo 5kg');
    expect(t).toContain('2 / 5');
  });

  it('lista vazia mostra empty state', () => {
    const f = TestBed.createComponent(HojeAcabando);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).querySelector('ce-empty-state')).not.toBeNull();
  });
});
