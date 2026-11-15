import { TestBed } from '@angular/core/testing';

import { EstoqueItemResponse } from '../../core/api/models/estoque';
import { OperatorStore } from '../../core/operator/operator-store';
import { FakeStorage, operadorValido } from '../../core/permissions/testing';
import { StorageService } from '../../core/platform/storage-service';
import { HojeAcabando, modeloAcabando, rotaRepor } from './hoje-acabando';

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

describe('rotaRepor', () => {
  it('aponta para o abastecimento com o produto', () => {
    expect(rotaRepor('p-1')).toBe('/estoque/abastecimento?produtoId=p-1');
  });
});

function montar(permissoes: string[]) {
  TestBed.configureTestingModule({
    providers: [{ provide: StorageService, useValue: new FakeStorage() }],
  });
  TestBed.inject(OperatorStore).select(operadorValido(permissoes));
}

describe('HojeAcabando', () => {
  beforeEach(() => montar(['estoque.editar']));

  it('Repor emite o id do item; oculto sem estoque.editar', () => {
    const f = TestBed.createComponent(HojeAcabando);
    f.componentRef.setInput('itens', modeloAcabando([ITEM]));
    const emitido: string[] = [];
    f.componentInstance.repor.subscribe((id) => emitido.push(id));
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.acabando__repor')!.click();
    expect(emitido).toEqual(['p-1']);
    TestBed.inject(OperatorStore).select(operadorValido([]));
    f.detectChanges();
    expect(el.querySelector('.acabando__repor')).toBeNull();
  });

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
