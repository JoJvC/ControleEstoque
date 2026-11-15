import { TestBed } from '@angular/core/testing';

import { VendaDetalheResponse } from '../../core/api/models/vendas';
import { corStatus, HojeUltimas, modeloUltimas, rotaVenda } from './hoje-ultimas';

const V = {
  id: 'v-1',
  clienteId: 'c-1',
  data: '2026-11-15T10:30:00',
  totalLiquido: 50,
  statusPagamento: 'PAGA',
} as VendaDetalheResponse;

describe('modeloUltimas', () => {
  it('copia valores do servidor e cai em Cliente sem nome', () => {
    expect(modeloUltimas([V], new Map([['c-1', 'Ana']]))[0]).toEqual({
      id: 'v-1',
      data: V.data,
      cliente: 'Ana',
      total: 50,
      status: 'PAGA',
    });
    expect(modeloUltimas([V], new Map())[0].cliente).toBe('Cliente');
  });

  it('rotaVenda e corStatus', () => {
    expect(rotaVenda('v-1')).toBe('/vendas/detalhe/v-1');
    expect([corStatus('PAGA'), corStatus('PARCIAL'), corStatus('PENDENTE')]).toEqual([
      'success',
      'warning',
      'danger',
    ]);
  });
});

describe('HojeUltimas', () => {
  it('lista e emite o id ao clicar', () => {
    const f = TestBed.createComponent(HojeUltimas);
    f.componentRef.setInput('itens', modeloUltimas([V], new Map([['c-1', 'Ana']])));
    let id = '';
    f.componentInstance.abrir.subscribe((x) => (id = x));
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('10:30');
    (el.querySelector('.ultimas__item') as HTMLElement).click();
    expect(id).toBe('v-1');
  });
});
