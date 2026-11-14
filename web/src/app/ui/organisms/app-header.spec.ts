import { TestBed } from '@angular/core/testing';

import { AppHeader } from './app-header';

function montar(onda?: boolean) {
  const fixture = TestBed.createComponent(AppHeader);
  fixture.componentRef.setInput('titulo', 'Clientes');
  if (onda !== undefined) fixture.componentRef.setInput('onda', onda);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('AppHeader', () => {
  it('com onda: classe de topo e svg decorativo', () => {
    const el = montar(true);
    expect(el.querySelector('.topo--onda')).not.toBeNull();
    expect(el.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(el.querySelector('h1')?.textContent).toContain('Clientes');
  });

  it('com onda: sem borda nem sombra no rodapé do cabeçalho', () => {
    const el = montar(true);
    expect(el.classList.contains('app-header--onda')).toBe(true);
    for (const alvo of [
      el,
      el.querySelector('.topo--onda'),
      el.querySelector('header.cabecalho'),
    ]) {
      const css = getComputedStyle(alvo as Element);
      expect(['', 'none']).toContain(css.borderBottomStyle);
      expect(['', '0px']).toContain(css.borderBottomWidth);
      expect(['', 'none']).toContain(css.boxShadow);
    }
  });

  it('sem onda (padrão): nem classe de topo nem svg', () => {
    for (const el of [montar(), montar(false)]) {
      expect(el.querySelector('.topo--onda')).toBeNull();
      expect(el.querySelector('svg')).toBeNull();
    }
  });
});
