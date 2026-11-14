import { TestBed } from '@angular/core/testing';

import { Icon, ICONES, IconeNome } from './icon';

async function dsDe(nome: string): Promise<string[]> {
  await TestBed.configureTestingModule({ imports: [Icon] }).compileComponents();
  const fixture = TestBed.createComponent(Icon);
  fixture.componentRef.setInput('nome', nome);
  await fixture.whenStable();
  const paths: SVGPathElement[] = Array.from(fixture.nativeElement.querySelectorAll('path'));
  return paths.map((p) => p.getAttribute('d') ?? '');
}

describe('Icon', () => {
  const novos: IconeNome[] = [
    'galao-completo',
    'casco',
    'sucata',
    'casco-na-rua',
    'gelo',
    'carvao',
    'copo',
  ];

  for (const nome of novos) {
    it(`renderiza os paths de ${nome}`, async () => {
      const ds = await dsDe(nome);
      expect(ds.length).toBeGreaterThan(0);
      expect(ds).toEqual([...ICONES[nome]]);
    });
  }

  for (const nome of ['inexistente', 'toString']) {
    it(`nome desconhecido (${nome}) cai em caixa`, async () => {
      expect(await dsDe(nome)).toEqual([...ICONES.caixa]);
    });
  }
});
