import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { BottomNav, BottomNavItem } from './bottom-nav';

const ITENS: readonly BottomNavItem[] = [
  { path: '/home', label: 'Hoje', icone: 'home' },
  { path: '/clientes', label: 'Clientes', icone: 'usuario' },
  { path: '/vendas/nova', label: 'Vender', icone: 'gota', destaque: true },
  { path: '/estoque', label: 'Estoque', icone: 'caixa' },
  { path: '/mais', label: 'Mais', icone: 'menu' },
];

@Component({ template: '' })
class Duble {}

async function montar() {
  TestBed.configureTestingModule({
    providers: [provideRouter(ITENS.map((i) => ({ path: i.path.slice(1), component: Duble })))],
  });
  const fixture = TestBed.createComponent(BottomNav);
  fixture.componentRef.setInput('itens', ITENS);
  await fixture.whenStable();
  const links = Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('.nav__item'),
  );
  return { fixture, links };
}

describe('BottomNav', () => {
  it('renderiza os itens na ordem recebida', async () => {
    const { links } = await montar();
    expect(links.map((a) => a.textContent?.trim())).toEqual(ITENS.map((i) => i.label));
    expect(links.map((a) => a.getAttribute('href'))).toEqual(ITENS.map((i) => i.path));
  });

  it('aplica o destaque só no item marcado', async () => {
    const { links } = await montar();
    const destacados = links.filter((a) => a.classList.contains('nav__item--destaque'));
    expect(destacados.map((a) => a.textContent?.trim())).toEqual(['Vender']);
  });

  it('clique num item navega para a rota dele e marca aria-current', async () => {
    const { fixture, links } = await montar();
    const router = TestBed.inject(Router);
    expect(links.some((a) => a.getAttribute('aria-current') === 'page')).toBe(false);

    links[1].click();
    await fixture.whenStable();

    expect(router.url).toBe('/clientes');
    expect(links[1].getAttribute('aria-current')).toBe('page');
    expect(links.filter((a) => a.hasAttribute('aria-current'))).toHaveLength(1);
  });
});
