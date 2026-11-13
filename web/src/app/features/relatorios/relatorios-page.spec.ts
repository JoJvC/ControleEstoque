import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { RelatoriosPage } from './relatorios-page';

describe('RelatoriosPage', () => {
  it('renderiza um card por relatório com o link da rota filha e sem placeholder', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(RelatoriosPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const links = Array.from(el.querySelectorAll('a.card')).map((a) => a.getAttribute('href'));
    expect(links).toEqual([
      '/relatorios/faturamento',
      '/relatorios/vendas-por-funcionario',
      '/relatorios/caixa',
      '/relatorios/fiado',
      '/relatorios/cascos',
      '/relatorios/sucata',
      '/relatorios/estoque',
      '/relatorios/conta-funcionarios',
    ]);
    expect(el.querySelector('ce-page-placeholder')).toBeNull();
  });

  it.each([
    'faturamento',
    'vendas-por-funcionario',
    'caixa',
    'fiado',
    'cascos',
    'sucata',
    'estoque',
    'conta-funcionarios',
  ])('clicar no card "%s" navega para /relatorios/%s', async (rota) => {
    @Component({ template: '' })
    class Dubles {}
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: `relatorios/${rota}`, component: Dubles }])],
    });
    const fixture = TestBed.createComponent(RelatoriosPage);
    fixture.detectChanges();
    const a = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      `a.card[href="/relatorios/${rota}"]`,
    )!;
    a.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe(`/relatorios/${rota}`);
  });
});
