import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

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
    ]);
    expect(el.querySelector('ce-page-placeholder')).toBeNull();
  });
});
