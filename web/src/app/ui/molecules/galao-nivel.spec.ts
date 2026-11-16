import { TestBed } from '@angular/core/testing';

import { EstoqueItemResponse } from '../../core/api/models/estoque';
import { GalaoNivel } from './galao-nivel';

const BASE: EstoqueItemResponse = {
  produtoMarcaId: 'pm-a1',
  produtoId: 'a1',
  tipo: 'RETORNAVEL',
  nome: 'Água 20L',
  marcaId: 'm-1',
  marca: 'Cristal',
  categoria: null,
  tamanho: null,
  quantidade: 5,
  estoqueMinimo: 4,
  abaixoMinimo: false,
};

function montar(item: EstoqueItemResponse, maior: number) {
  const f = TestBed.createComponent(GalaoNivel);
  f.componentRef.setInput('item', item);
  f.componentRef.setInput('maiorDoGrupo', maior);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('GalaoNivel', () => {
  it('nível e linha do mínimo proporcionais ao maior do grupo', () => {
    const el = montar(BASE, 10);
    expect(el.querySelector('.galao__nivel')?.getAttribute('height')).toBe('30');
    expect(el.querySelector('.galao__minimo')?.getAttribute('y1')).toBe('56');
    expect(el.textContent).toContain('Cristal');
  });

  it('sem destaque quando abaixoMinimo é false, mesmo com quantidade < mínimo', () => {
    const el = montar({ ...BASE, quantidade: 3, estoqueMinimo: 5 }, 10);
    expect(el.querySelector('[data-abaixo-minimo]')).toBeNull();
    expect(el.textContent).not.toContain('abaixo do mínimo');
  });

  it('com destaque quando abaixoMinimo é true, mesmo com quantidade > mínimo', () => {
    const el = montar({ ...BASE, quantidade: 9, estoqueMinimo: 5, abaixoMinimo: true }, 10);
    expect(el.querySelector('[data-abaixo-minimo]')).not.toBeNull();
    expect(el.textContent).toContain('abaixo do mínimo');
  });
});
