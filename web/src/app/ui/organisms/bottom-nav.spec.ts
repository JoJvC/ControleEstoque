import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { BottomNav, BottomNavItem } from './bottom-nav';

const ITENS: readonly BottomNavItem[] = [
  { path: '/home', label: 'Hoje', icone: 'home', onde: 'ambos' },
  { path: '/clientes', label: 'Clientes', icone: 'usuario', onde: 'ambos' },
  { path: '/vendas/nova', label: 'Vender', icone: 'gota', onde: 'ambos', destaque: true },
  { path: '/estoque', label: 'Estoque', icone: 'caixa', onde: 'ambos' },
  { path: '/mais', label: 'Mais', icone: 'menu', onde: 'celular' },
  { path: '/vendas', label: 'Histórico', icone: 'cupom', onde: 'desktop', exato: true },
];

@Component({ template: '' })
class Duble {}

async function montar(acionar: () => void = () => undefined) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([...ITENS.map((i) => ({ path: i.path.slice(1), component: Duble }))]),
    ],
  });
  const fixture = TestBed.createComponent(BottomNav);
  fixture.componentRef.setInput('itens', ITENS);
  fixture.componentRef.setInput('acoes', [{ label: 'Sair', icone: 'sair', acionar }]);
  await fixture.whenStable();
  const links = Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.nav__item'),
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

  it('onde vira classe só-celular / só-desktop', async () => {
    const { links } = await montar();
    const so = (c: string) =>
      links.filter((a) => a.classList.contains(c)).map((a) => a.textContent?.trim());
    expect(so('nav__item--so-celular')).toEqual(['Mais']);
    expect(so('nav__item--so-desktop')).toEqual(['Histórico']);
  });

  it('o clique marca is-active e aria-current só no item clicado', async () => {
    const { fixture, links } = await montar();
    links[3].click();
    await fixture.whenStable();
    expect(links.filter((a) => a.classList.contains('is-active'))).toEqual([links[3]]);
    expect(links.filter((a) => a.hasAttribute('aria-current'))).toEqual([links[3]]);
  });

  it('em /vendas/nova o item exato (/vendas) não fica ativo', async () => {
    const { fixture, links } = await montar();
    const historico = links[links.length - 1];
    await TestBed.inject(Router).navigateByUrl('/vendas/nova');
    await fixture.whenStable();
    expect(links[2].classList.contains('is-active')).toBe(true);
    expect(historico.classList.contains('is-active')).toBe(false);
  });

  it('botão de ação dispara a ação', async () => {
    const acionar = vi.fn();
    const { fixture } = await montar(acionar);
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button.nav__acao')!
      .click();
    expect(acionar).toHaveBeenCalledTimes(1);
  });
});
