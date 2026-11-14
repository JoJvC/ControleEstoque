import { TestBed } from '@angular/core/testing';

import { ICONES } from '../atoms/icon';
import { ProdutoCard } from './produto-card';

async function dsDoCard(inputs: Record<string, unknown>): Promise<string[]> {
  await TestBed.configureTestingModule({ imports: [ProdutoCard] }).compileComponents();
  const fixture = TestBed.createComponent(ProdutoCard);
  fixture.componentRef.setInput('nome', 'Produto');
  fixture.componentRef.setInput('precoReferencia', 10);
  for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
  await fixture.whenStable();
  const paths: SVGPathElement[] = Array.from(
    fixture.nativeElement.querySelectorAll('ce-icon path'),
  );
  return paths.map((p) => p.getAttribute('d') ?? '');
}

describe('ProdutoCard ícone sem foto', () => {
  it('usa a categoria quando não há tipo', async () => {
    expect(await dsDoCard({ categoria: 'Gelo' })).toEqual([...ICONES.gelo]);
  });

  it('usa caixa sem tipo e sem categoria', async () => {
    expect(await dsDoCard({})).toEqual([...ICONES.caixa]);
  });

  it('o tipo define o ícone', async () => {
    expect(await dsDoCard({ tipo: 'CASCO', categoria: 'Gelo' })).toEqual([...ICONES.casco]);
  });
});
