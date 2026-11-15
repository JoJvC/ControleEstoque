import { TestBed } from '@angular/core/testing';

import { EstoqueItemResponse } from '../../core/api/models/estoque';
import { BarraEstoque } from './barra-estoque';

const BASE: EstoqueItemResponse = {
  produtoId: 'd1',
  tipo: 'DESCARTAVEL',
  nome: 'Copo',
  marca: null,
  categoria: 'Copos',
  tamanho: null,
  quantidade: 5,
  estoqueMinimo: 4,
  abaixoMinimo: false,
};

function montar(item: EstoqueItemResponse, maior: number) {
  const f = TestBed.createComponent(BarraEstoque);
  f.componentRef.setInput('item', item);
  f.componentRef.setInput('maiorDoGrupo', maior);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('BarraEstoque', () => {
  it('largura e marca do mínimo proporcionais ao maior do grupo', () => {
    const el = montar(BASE, 10);
    expect((el.querySelector('.barra__preenchimento') as HTMLElement).style.width).toBe('50%');
    expect((el.querySelector('.barra__minimo') as HTMLElement).style.left).toBe('40%');
  });

  it('mínimo acima do maior do grupo fica limitado em 100%', () => {
    const el = montar({ ...BASE, estoqueMinimo: 20 }, 10);
    expect((el.querySelector('.barra__minimo') as HTMLElement).style.left).toBe('100%');
  });

  it('sem destaque com abaixoMinimo false (3 < 5)', () => {
    const el = montar({ ...BASE, quantidade: 3, estoqueMinimo: 5 }, 10);
    expect(el.querySelector('[data-abaixo-minimo]')).toBeNull();
  });

  it('com destaque com abaixoMinimo true (9 > 5)', () => {
    const el = montar({ ...BASE, quantidade: 9, estoqueMinimo: 5, abaixoMinimo: true }, 10);
    expect(el.querySelector('[data-abaixo-minimo]')).not.toBeNull();
    expect(el.textContent).toContain('abaixo do mínimo');
  });
});
